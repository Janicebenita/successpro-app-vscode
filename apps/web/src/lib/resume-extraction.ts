import { inspectDocxPackage } from "./docx-safety";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type ResumeLayoutSignals = {
  multiColumn: boolean;
  tableHeavy: boolean;
  crowdedLayout: boolean;
  excessiveWhitespace: boolean;
  inconsistentMargins: boolean;
  excessiveColor: boolean;
  smallText: boolean;
  criticalContentInHeaderFooter?: boolean;
};

export type ResumeSourceLanguage = "en" | "hi" | "bn" | "ta" | "te" | "ar" | "ru" | "zh" | "ja" | "ko" | "und";

/**
 * A small, privacy-preserving script detector. It never translates or rewrites
 * source text; it tells downstream extraction and the member UI which script
 * was actually present. Latin-script resumes are marked English only when they
 * contain common resume vocabulary, otherwise they remain undetermined.
 */
export function detectResumeSourceLanguage(text: string): ResumeSourceLanguage {
  const score = (pattern: RegExp) => (text.match(pattern) ?? []).join("").length;
  const candidates: Array<[ResumeSourceLanguage, number]> = [
    ["hi", score(/[\u0900-\u097F]/g)], ["bn", score(/[\u0980-\u09FF]/g)], ["ta", score(/[\u0B80-\u0BFF]/g)], ["te", score(/[\u0C00-\u0C7F]/g)],
    ["ar", score(/[\u0600-\u06FF]/g)], ["ru", score(/[\u0400-\u04FF]/g)], ["zh", score(/[\u4E00-\u9FFF]/g)], ["ja", score(/[\u3040-\u30FF]/g)], ["ko", score(/[\uAC00-\uD7AF]/g)],
  ];
  const [language, count] = candidates.sort((a, b) => b[1] - a[1])[0] ?? ["und", 0];
  if (count >= 12) return language;
  return /\b(experience|education|skills|professional|resume|curriculum vitae|employment)\b/i.test(text) ? "en" : "und";
}

type PdfExtraction = {
  text: string;
  pageCount: number;
  method: "embedded-text" | "cloud-ocr";
  layout: ResumeLayoutSignals;
};

const neutralPdfLayout: ResumeLayoutSignals = { multiColumn: false, tableHeavy: false, crowdedLayout: false, excessiveWhitespace: false, inconsistentMargins: false, excessiveColor: false, smallText: false };

async function withinExtractionDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("PDF processing timed out")), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}

export async function resolvePdfVisualInspection<T>(embeddedText: string, inspector: () => Promise<T>, timeoutMs = 8_000) {
  try { return await withinExtractionDeadline(inspector(), timeoutMs); }
  catch { if (embeddedText.length >= 80) return null; throw new Error("PDF content and visual inspection both failed"); }
}

export async function extractPdfTextWithPoppler(bytes: Uint8Array) {
  const directory = await mkdtemp(path.join(tmpdir(), "successpro-pdf-"));
  const inputPath = path.join(directory, "resume.pdf");
  const outputPath = path.join(directory, "resume.txt");
  try {
    await writeFile(inputPath, bytes);
    await new Promise<void>((resolve, reject) => {
      const process = spawn("pdftotext", ["-layout", inputPath, outputPath], { stdio: ["ignore", "ignore", "pipe"] });
      const errors: Buffer[] = []; let settled = false;
      const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve(); };
      const timer = setTimeout(() => { process.kill("SIGKILL"); finish(new Error("Poppler text extraction timed out")); }, 12_000);
      process.stderr.on("data", (chunk: Buffer) => { if (errors.reduce((sum, item) => sum + item.length, 0) < 4_096) errors.push(chunk); });
      process.on("error", finish);
      process.on("close", (code) => code === 0 ? finish() : finish(new Error(`Poppler text extraction exited with ${code}: ${Buffer.concat(errors).toString("utf8").slice(0, 200)}`)));
    });
    const raw = await readFile(outputPath, "utf8");
    if (Buffer.byteLength(raw) > 2_000_000) throw new Error("Poppler text output exceeded its limit");
    const pages = raw.split("\f").filter((page) => page.trim()).length;
    return { text: cleanExtractedText(raw), pageCount: Math.max(1, pages) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export type DocxExtraction = { text: string; pageCount: number | null; layout: ResumeLayoutSignals };

export async function extractLegacyDocResume(buffer: Buffer): Promise<DocxExtraction> {
  const WordExtractor = (await import("word-extractor")).default;
  const document = await new WordExtractor().extract(buffer);
  const body = cleanExtractedText(document.getBody());
  const headers = cleanExtractedText(`${document.getHeaders()}\n${document.getFooters()}`);
  const explicitPages = body.split("\f").length;
  const wordCount = body.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const pageCount = explicitPages > 1 ? explicitPages : Math.max(1, Math.ceil(wordCount / 650));
  const wordsPerPage = wordCount / pageCount;
  return {
    text: body,
    pageCount,
    layout: {
      multiColumn: false,
      tableHeavy: false,
      crowdedLayout: wordsPerPage > 750,
      excessiveWhitespace: wordCount >= 80 && wordsPerPage < 180,
      inconsistentMargins: false,
      excessiveColor: false,
      smallText: false,
      criticalContentInHeaderFooter: /(?:@|linkedin|\+?\d[\d\s()-]{7,}|experience|education|skills)/i.test(headers),
    },
  };
}

function xmlAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`(?:w:)?${name}="([^"]+)"`, "i"))?.[1];
}

function countMatches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

export async function extractDocxResume(buffer: Buffer): Promise<DocxExtraction> {
  const archive = await inspectDocxPackage(buffer);
  const raw = await import("mammoth").then((module) => module.default.extractRawText({ buffer }));
  const readXml = async (name: string) => archive.file(name)?.async("string") ?? "";
  const [documentXml, stylesXml, appXml, ...headerFooterXml] = await Promise.all([
    readXml("word/document.xml"),
    readXml("word/styles.xml"),
    readXml("docProps/app.xml"),
    ...Object.keys(archive.files).filter((name) => /^word\/(?:header|footer)\d+\.xml$/i.test(name)).map(readXml),
  ]);
  if (!documentXml) throw new Error("DOCX body is missing");
  const text = cleanExtractedText(raw.value);
  const pageCountValue = Number(appXml.match(/<Pages>(\d+)<\/Pages>/i)?.[1] ?? 0);
  const explicitBreaks = countMatches(documentXml, /<w:(?:br[^>]+w:type="page"|lastRenderedPageBreak)\b/gi);
  const pageCount = pageCountValue > 0 ? pageCountValue : explicitBreaks > 0 ? explicitBreaks + 1 : null;
  const tables = countMatches(documentXml, /<w:tbl\b/gi);
  const columns = [...documentXml.matchAll(/<w:cols\b[^>]*>/gi)].map((match) => Number(xmlAttribute(match[0], "num") ?? 1));
  const margins = [...documentXml.matchAll(/<w:pgMar\b[^>]*>/gi)].map((match) => ({ left: Number(xmlAttribute(match[0], "left") ?? 0), right: Number(xmlAttribute(match[0], "right") ?? 0) }));
  const marginSpread = margins.length > 1 ? Math.max(...margins.map((item) => item.left)) - Math.min(...margins.map((item) => item.left)) : 0;
  const halfPointSizes = [...`${stylesXml}${documentXml}`.matchAll(/<w:sz\b[^>]*w:val="(\d+)"/gi)].map((match) => Number(match[1])).filter((size) => size > 0);
  const bodySizes = halfPointSizes.filter((size) => size <= 28).sort((a, b) => a - b);
  const medianBodyPt = bodySizes.length ? bodySizes[Math.floor(bodySizes.length / 2)] / 2 : null;
  const colors = new Set([...`${stylesXml}${documentXml}`.matchAll(/<w:color\b[^>]*w:val="([0-9A-F]{6})"/gi)].map((match) => match[1].toUpperCase()).filter((color) => color !== "000000" && color !== "AUTO"));
  const headerFooterText = headerFooterXml.join(" ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const effectivePages = pageCount ?? Math.max(1, Math.ceil(wordCount / 650));
  const wordsPerPage = wordCount / effectivePages;
  return {
    text,
    pageCount,
    layout: {
      multiColumn: columns.some((count) => count > 1),
      tableHeavy: tables >= 2,
      crowdedLayout: wordsPerPage > 750,
      excessiveWhitespace: wordCount >= 80 && wordsPerPage < 180,
      inconsistentMargins: marginSpread > 180 || margins.some((margin) => Math.abs(margin.left - margin.right) > 720),
      excessiveColor: colors.size > 4,
      smallText: medianBodyPt !== null && medianBodyPt < 8,
      criticalContentInHeaderFooter: /(?:@|linkedin|\+?\d[\d\s()-]{7,}|experience|education|skills)/i.test(headerFooterText),
    },
  };
}

type PdfTextItem = { str: string; width: number; height: number; transform: number[] };
type PageMeasure = { textAreaRatio: number; leftMargin: number; rightMargin: number; hasColumnGutter: boolean; smallText: boolean };

function probableColumnSplit(items: PdfTextItem[], viewportWidth: number) {
  const starts = [...new Set(items.map((item) => item.transform[4]).filter((x) => x > viewportWidth * 0.01 && x < viewportWidth * 0.82).map((x) => Math.round(x)))].sort((a, b) => a - b);
  let split = viewportWidth * 0.36; let largestGap = 0;
  for (let index = 1; index < starts.length; index += 1) { const gap = starts[index] - starts[index - 1]; if (gap > largestGap) { largestGap = gap; split = (starts[index] + starts[index - 1]) / 2; } }
  // Repeated column starts outweigh isolated contact links or right-aligned
  // dates, which can otherwise create the largest but irrelevant x-gap.
  const columnStarts = starts.filter((x) => x >= viewportWidth * 0.28 && x <= viewportWidth * 0.75).map((x) => ({ x, count: items.filter((item) => Math.abs(item.transform[4] - x) <= 6).length })).sort((a, b) => b.count - a.count);
  if (columnStarts[0]?.count >= 4) {
    const leftStart = starts.filter((x) => x < viewportWidth * 0.28).map((x) => ({ x, count: items.filter((item) => Math.abs(item.transform[4] - x) <= 6).length })).sort((a, b) => b.count - a.count)[0];
    const rightStart = Math.min(...columnStarts.filter((candidate) => candidate.count >= 4 && candidate.x >= columnStarts[0].x - 24 && candidate.x <= columnStarts[0].x).map((candidate) => candidate.x));
    if (leftStart) { split = rightStart - 12; largestGap = rightStart - leftStart.x; }
  }
  const leftCount = items.filter((item) => item.transform[4] < split).length; const rightCount = items.length - leftCount;
  return { split, credible: largestGap >= viewportWidth * 0.06 && leftCount >= 8 && rightCount >= 8 };
}

export function itemsToReadingOrder(items: PdfTextItem[], viewportWidth: number, hasColumnGutter: boolean) {
  const visible = items.filter((item) => item.str.trim() && item.transform.length >= 6);
  const renderColumn = (column: PdfTextItem[]) => {
    const ordered = column.slice().sort((left, right) => {
      const vertical = right.transform[5] - left.transform[5];
      return Math.abs(vertical) > Math.max(2, Math.min(Math.abs(left.height), Math.abs(right.height)) * 0.45) ? vertical : left.transform[4] - right.transform[4];
    });
    const lines: Array<{ y: number; items: PdfTextItem[] }> = [];
    for (const item of ordered) {
      const tolerance = Math.max(2, Math.abs(item.height || item.transform[3] || 0) * 0.45);
      const line = lines.find((candidate) => Math.abs(candidate.y - item.transform[5]) <= tolerance);
      if (line) line.items.push(item); else lines.push({ y: item.transform[5], items: [item] });
    }
    return lines.sort((left, right) => right.y - left.y).map((line) => line.items.sort((left, right) => left.transform[4] - right.transform[4]).map((item) => item.str.trim()).filter(Boolean).join(" ")).filter(Boolean).join("\n");
  };
  if (!hasColumnGutter) return renderColumn(visible);
  const { split } = probableColumnSplit(visible, viewportWidth);
  const renderColumns = (region: PdfTextItem[]) => [renderColumn(region.filter((item) => item.transform[4] < split)), renderColumn(region.filter((item) => item.transform[4] >= split))].filter(Boolean).join("\n");
  // A page can switch between full-width experience and two-column details.
  // Full-width lines divide reading regions; a page-wide column split would
  // detach right-aligned employment dates and append them after all sections.
  const rowGroups = new Map<number, PdfTextItem[]>();
  for (const item of visible) {
    const y = Math.round(item.transform[5]);
    rowGroups.set(y, [...(rowGroups.get(y) ?? []), item]);
  }
  const spanningRows = [...rowGroups].filter(([, row]) => {
    const ordered = row.slice().sort((a, b) => a.transform[4] - b.transform[4]);
    let start = ordered[0].transform[4];
    let end = start;
    for (const item of ordered) {
      if (item.transform[4] - end > 8) start = item.transform[4];
      end = Math.max(end, item.transform[4] + item.width);
      if (start < split && end - start >= viewportWidth * 0.55 && end > split + 20) return true;
    }
    return false;
  }).map(([y]) => y).sort((a, b) => b - a);
  if (!spanningRows.length) return renderColumns(visible);
  const output: string[] = [];
  let remaining = visible;
  for (const y of spanningRows) {
    output.push(renderColumns(remaining.filter((item) => item.transform[5] > y + 2)));
    output.push(renderColumn(remaining.filter((item) => Math.abs(item.transform[5] - y) <= 2)));
    remaining = remaining.filter((item) => item.transform[5] < y - 2);
  }
  output.push(renderColumns(remaining));
  return output.filter(Boolean).join("\n");
}

async function inspectLayout(parser: { load: () => Promise<{ numPages: number; getPage: (page: number) => Promise<{ getViewport: (input: { scale: number }) => { width: number; height: number }; getTextContent: () => Promise<{ items: unknown[] }>; cleanup: () => void }> }>; getTable: () => Promise<{ pages: Array<{ tables: unknown[] }> }>; getImage: (input: Record<string, unknown>) => Promise<{ pages: Array<{ pageNumber: number; images: Array<{ data: Uint8Array; width: number; height: number }> }> }> }) {
  const document = await parser.load();
  const pages: PageMeasure[] = [];
  const pageItems: Array<{ items: PdfTextItem[]; width: number }> = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is PdfTextItem => typeof item === "object" && item !== null && "str" in item && "transform" in item) as PdfTextItem[];
    const visible = items.filter((item) => item.str.trim() && item.transform.length >= 6);
    pageItems.push({ items: visible, width: viewport.width });
    const minX = visible.length ? Math.min(...visible.map((item) => item.transform[4])) : viewport.width / 2;
    const maxX = visible.length ? Math.max(...visible.map((item) => item.transform[4] + Math.max(0, item.width))) : viewport.width / 2;
    const heights = visible.map((item) => Math.abs(item.height || item.transform[3] || 0)).filter(Boolean).sort((a, b) => a - b);
    const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
    const bands = Array.from({ length: 24 }, () => ({ left: false, middle: false, right: false }));
    for (const item of visible) {
      const y = item.transform[5];
      const band = bands[Math.max(0, Math.min(bands.length - 1, Math.floor((1 - y / viewport.height) * bands.length)))];
      const start = item.transform[4]; const end = start + item.width;
      if (start < viewport.width * 0.43) band.left = true;
      if (end > viewport.width * 0.57) band.right = true;
      if (end > viewport.width * 0.43 && start < viewport.width * 0.57) band.middle = true;
    }
    const activeBands = bands.filter((band) => band.left || band.middle || band.right);
    const splitBands = activeBands.filter((band) => band.left && band.right && !band.middle);
    const textArea = visible.reduce((sum, item) => sum + Math.max(0, item.width) * Math.max(0, Math.abs(item.height || item.transform[3] || 0)), 0);
    const clusteredColumns = probableColumnSplit(visible, viewport.width).credible;
    pages.push({ textAreaRatio: textArea / (viewport.width * viewport.height), leftMargin: minX / viewport.width, rightMargin: (viewport.width - maxX) / viewport.width, hasColumnGutter: (activeBands.length >= 5 && splitBands.length / activeBands.length >= 0.35) || clusteredColumns, smallText: medianHeight > 0 && medianHeight < 7.8 });
    page.cleanup();
  }
  const tables = await parser.getTable().catch(() => ({ pages: [] as Array<{ tables: unknown[] }> }));
  const marginSpread = pages.length > 1 ? Math.max(...pages.map((page) => page.leftMargin)) - Math.min(...pages.map((page) => page.leftMargin)) : 0;
  const imageResult = await parser.getImage({ imageBuffer: true, imageDataUrl: false, imageThreshold: 200 }).catch(() => ({ pages: [] as Array<{ pageNumber: number; images: Array<{ data: Uint8Array; width: number; height: number }> }> }));
  const ocrImages = imageResult.pages.map((page) => page.images.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0]?.data).filter((image): image is Uint8Array => Boolean(image?.length));
  return {
    ocrImages,
    structuredText: cleanExtractedText(pageItems.map((page, index) => itemsToReadingOrder(page.items, page.width, pages[index]?.hasColumnGutter ?? false)).join("\n\n")),
    signals: {
      multiColumn: pages.some((page) => page.hasColumnGutter),
      tableHeavy: tables.pages.reduce((sum, page) => sum + page.tables.length, 0) >= 2,
      crowdedLayout: pages.some((page) => page.textAreaRatio > 0.28),
      excessiveWhitespace: pages.some((page) => page.textAreaRatio > 0 && page.textAreaRatio < 0.025),
      inconsistentMargins: marginSpread > 0.08 || pages.some((page) => Math.abs(page.leftMargin - page.rightMargin) > 0.18),
      excessiveColor: false,
      smallText: pages.some((page) => page.smallText),
    },
  };
}

function cleanExtractedText(value: string) {
  return value.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n").trim();
}

async function cloudRunAccessToken() {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error("Cloud identity is unavailable");
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Cloud identity did not return an access token");
  return body.access_token;
}

export async function readImagesWithOcr(images: Uint8Array[]) {
  const accessToken = await cloudRunAccessToken();
  const response = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "x-goog-user-project": process.env.GOOGLE_CLOUD_PROJECT ?? "" },
    body: JSON.stringify({
      requests: images.map((image) => ({
        image: { content: Buffer.from(image).toString("base64") },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        imageContext: { languageHints: ["en", "hi"] },
      })),
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`OCR service returned ${response.status}`);
  const body = await response.json() as { responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }> };
  return cleanExtractedText((body.responses ?? []).map((item) => item.fullTextAnnotation?.text ?? "").join("\n\n"));
}

export async function extractPdfResume(bytes: Uint8Array): Promise<PdfExtraction> {
  try {
    try {
      const canvas = await import("@napi-rs/canvas");
      const globals = globalThis as unknown as Record<string, unknown>;
      globals.DOMMatrix ??= canvas.DOMMatrix; globals.ImageData ??= canvas.ImageData; globals.Path2D ??= canvas.Path2D;
      const { PDFParse } = await import("pdf-parse"); const parser = new PDFParse({ data: bytes });
      try {
        const result = await withinExtractionDeadline(parser.getText(), 12_000); const embeddedText = cleanExtractedText(result.text);
        if (result.total > 12) return { text: embeddedText, pageCount: result.total, method: "embedded-text", layout: neutralPdfLayout };
        const visual = await resolvePdfVisualInspection(embeddedText, () => inspectLayout(parser as unknown as Parameters<typeof inspectLayout>[0]));
        if (!visual) return { text: embeddedText, pageCount: result.total, method: "embedded-text", layout: neutralPdfLayout };
        if (embeddedText.length >= 80) {
          const structuredText = visual.structuredText.length >= 80 && visual.signals.multiColumn ? visual.structuredText : embeddedText;
          return { text: structuredText, pageCount: result.total, method: "embedded-text", layout: visual.signals };
        }
        try { if (!visual.ocrImages.length) throw new Error("No embedded page image was available for OCR"); const ocrText = await readImagesWithOcr(visual.ocrImages); return { text: ocrText.length > embeddedText.length ? ocrText : embeddedText, pageCount: result.total, method: ocrText.length > embeddedText.length ? "cloud-ocr" : "embedded-text", layout: visual.signals }; }
        catch { return { text: embeddedText, pageCount: result.total, method: "embedded-text", layout: visual.signals }; }
      } finally { await withinExtractionDeadline(parser.destroy(), 1_000).catch(() => undefined); }
    } catch (primaryError) {
      const fallback = await extractPdfTextWithPoppler(bytes).catch(() => { throw primaryError; });
      return { text: fallback.text, pageCount: fallback.pageCount, method: "embedded-text", layout: neutralPdfLayout };
    }
  } catch (error) {
    throw error;
  }
}

export { cleanExtractedText };
