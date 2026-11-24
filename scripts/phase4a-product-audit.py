"""Read-only product audit: service responses, grants, source hashes and original-row preservation."""
import hashlib,json,re,sys,urllib.request
from pathlib import Path
from urllib.parse import urlparse,unquote
import mysql.connector
root=Path(__file__).resolve().parents[1];out=root/'.local/phase4a/product-acceptance';out.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(root/'processing'))
from resume_worker.config import Settings
s=Settings.load();result={}
for route in ['/api/health','/dashboard','/review']:
 try:
  with urllib.request.urlopen('http://127.0.0.1:3000'+route,timeout=15) as response:result[route]={'http':response.status,'bytes':len(response.read())}
 except Exception as error:result[route]={'error':str(error)}
u=urlparse(s.mysql_url)
try:
 db=mysql.connector.connect(host=u.hostname,port=u.port or 3306,user=unquote(u.username or ''),password=unquote(u.password or ''),database=u.path.lstrip('/'),connection_timeout=5)
 c=db.cursor();c.execute('SHOW GRANTS');grants=[str(row[0]) for row in c.fetchall()]
 result['qaProvisioning']={'globalCreateGranted':any(re.search(r'GRANT (?:ALL PRIVILEGES|[^;]*\bCREATE\b[^;]*) ON \*\.\*',g,re.I) for g in grants),'previousAttempt':'CREATE dedicated QA schema denied with MySQL 1044','writeTests':'BLOCKED; no grants changed'}
 c.execute('SHOW DATABASES LIKE %s',('successpro_phase4a_01a1e3f5',));result['qaProvisioning']['schemaVisible']=bool(c.fetchone())
 db.rollback()
 db.start_transaction(readonly=True,consistent_snapshot=True)
 c=db.cursor(dictionary=True);before=json.loads((root/'.local/phase4a/database-before.json').read_text());preservation={}
 for table,original in before.items():
  c.execute(f'SELECT * FROM {table} ORDER BY id');now={str(row['id']):hashlib.sha256(json.dumps(row,sort_keys=True,default=str).encode()).hexdigest() for row in c.fetchall()}
  preservation[table]={'originalRows':len(original),'changedOriginalRows':sum(now.get(k)!=v for k,v in original.items()),'additionalRows':len(set(now)-set(original))}
 db.rollback();db.close();result['databasePreservation']=preservation
except Exception as error:result['databaseError']=str(error)
workbook=Path(r'C:\Users\janic\Documents\Codex\2026-11-14\continue-successpro-v2-remediation-first-verify\outputs\PHASE3_ORIGINAL_WORKBOOK_BASELINE.xlsx')
result['workbookSha256']=hashlib.sha256(workbook.read_bytes()).hexdigest()
manifest={}
for base in ['apps/web/src','packages','processing/resume_worker']:
 for p in (root/base).rglob('*'):
  if p.is_file() and p.suffix in {'.ts','.tsx','.py','.json'} and 'node_modules' not in p.parts:manifest[p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
(out/'source-at-audit.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
batch=json.loads((root/'.local/phase4a/vitest-batched-final/vitest-batches.json').read_text())
result['previousFullSuite']={'files':batch['files'],'batches':len(batch['batches']),'allBatchesPassed':all(b['exitCode']==0 for b in batch['batches'])}
previous=out/'read-only-audit.json'
if previous.exists() and not (out/'read-only-audit-initial.json').exists():(out/'read-only-audit-initial.json').write_bytes(previous.read_bytes())
previous.write_text(json.dumps(result,indent=2),encoding='utf-8')
(out/'invalid-upload.txt').write_text('Synthetic invalid upload only. No candidate data.',encoding='utf-8')
print(json.dumps(result))
