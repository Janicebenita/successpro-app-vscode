import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

// Optional free-tier relay. Never a dependency for the whole opportunities page.
const key = process.env.CAREERJET_API_KEY;
const shared = process.env.RELAY_SHARED_SECRET;
const appOrigin = process.env.SUCCESSPRO_ORIGIN;
if (!key || !shared || shared.length < 32 || !appOrigin || new URL(appOrigin).protocol !== 'https:') throw new Error('Relay secrets/origin are not configured');
const seen = new Map();
let windowStart = Date.now(), calls = 0;
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/careerjet') return send(res, 404, { error: 'Not found' });
  try {
    let text = '';
    for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 8192) return send(res, 413, { error: 'Request too large' }); }
    const timestamp = String(req.headers['x-relay-timestamp'] ?? '');
    const signature = String(req.headers['x-relay-signature'] ?? '');
    if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 30000 || !/^[a-f0-9]{64}$/.test(signature)) return send(res, 401, { error: 'Unauthorized' });
    const expected = createHmac('sha256', shared).update(`${timestamp}.${text}`).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return send(res, 401, { error: 'Unauthorized' });
    for (const [id, expiry] of seen) if (expiry < Date.now()) seen.delete(id);
    if (seen.has(signature)) return send(res, 409, { error: 'Already processed' });
    if (Date.now() - windowStart > 60000) { calls = 0; windowStart = Date.now(); }
    if (calls >= 30) return send(res, 429, { error: 'Try another source' });
    seen.set(signature, Date.now() + 60000); calls++;
    const input = JSON.parse(text);
    const visitor = input.visitor ?? {};
    if (typeof input.role !== 'string' || !input.role.trim() || input.role.length > 160 || typeof input.location !== 'string' || input.location.length > 160 || !isIP(String(visitor.ip ?? '')) || typeof visitor.userAgent !== 'string' || !visitor.userAgent || visitor.userAgent.length > 1000 || /[\r\n]/.test(visitor.userAgent) || visitor.referer !== `${new URL(appOrigin).origin}/opportunities`) return send(res, 400, { error: 'Invalid search context' });
    const params = new URLSearchParams({ locale_code: 'en_IN', keywords: input.role, location: input.location, sort: 'date', page: '1', page_size: '100', fragment_size: '1500', user_ip: visitor.ip, user_agent: visitor.userAgent });
    const response = await fetch(`https://search.api.careerjet.net/v4/query?${params}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Referer: visitor.referer, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) return send(res, 502, { error: 'Source unavailable' });
    const body = await response.json();
    if (!['JOBS', 'LOCATIONS'].includes(body?.type)) return send(res, 502, { error: 'Invalid source response' });
    send(res, 200, body);
  } catch { send(res, 502, { error: 'Source unavailable' }); }
}).listen(Number(process.env.PORT || 10000), '0.0.0.0');
