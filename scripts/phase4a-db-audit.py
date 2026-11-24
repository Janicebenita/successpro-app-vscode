"""Read-only full-row hash snapshots. No assessment content is emitted or saved."""
import hashlib,json,sys
from pathlib import Path
from urllib.parse import urlparse,unquote
import mysql.connector
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'processing'))
from resume_worker.config import Settings
url=urlparse(Settings.load().mysql_url)
db=mysql.connector.connect(host=url.hostname,port=url.port or 3306,user=unquote(url.username or ''),password=unquote(url.password or ''),database=url.path.lstrip('/'),connection_timeout=5)
db.start_transaction(readonly=True,consistent_snapshot=True)
cursor=db.cursor(dictionary=True);snapshot={}
for table in ['resume_processing_jobs','resume_review_assessments']:
 cursor.execute(f'SELECT * FROM {table} ORDER BY id')
 snapshot[table]={str(row['id']):hashlib.sha256(json.dumps(row,sort_keys=True,default=str).encode()).hexdigest() for row in cursor.fetchall()}
db.rollback();db.close()
phase=sys.argv[1] if len(sys.argv)>1 else 'before'
assert phase in ['before','after']
path=root/f'.local/phase4a/database-{phase}.json'
if path.exists():raise SystemExit('Refusing to overwrite preservation snapshot')
path.write_text(json.dumps(snapshot,indent=2),encoding='utf-8')
print(json.dumps({table:len(rows) for table,rows in snapshot.items()}))
