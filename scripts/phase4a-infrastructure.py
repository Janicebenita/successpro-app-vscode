"""Read-only local infrastructure checks. Never consumes a queue or calls AI."""
import json,sys,urllib.request
from pathlib import Path
from urllib.parse import urlparse,unquote
import mysql.connector,redis
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'processing'))
from resume_worker.config import Settings
s=Settings.load();checks={}
for route in ['/api/health','/dashboard','/review']:
 try:
  with urllib.request.urlopen('http://127.0.0.1:3000'+route,timeout=30) as response:
   body=response.read();checks[route]={'status':'PASS','http':response.status,'bytes':len(body)}
 except Exception as e:checks[route]={'status':'FAIL','error':str(e)}
try:
 u=urlparse(s.mysql_url)
 db=mysql.connector.connect(host=u.hostname,port=u.port or 3306,user=unquote(u.username or ''),password=unquote(u.password or ''),database=u.path.lstrip('/'),connection_timeout=5)
 db.start_transaction(readonly=True);c=db.cursor();c.execute('SELECT 1');checks['mysql']={'status':'PASS','select1':c.fetchone()[0]};db.rollback();db.close()
except Exception as e:checks['mysql']={'status':'FAIL','error':str(e)}
try:
 r=redis.Redis.from_url(s.redis_url,socket_timeout=5,socket_connect_timeout=5)
 checks['garnet']={'status':'PASS' if r.ping() and r.eval('return 42',0)==42 else 'FAIL','queueConsumed':False};r.close()
except Exception as e:checks['garnet']={'status':'FAIL','error':str(e)}
checks['ai']={'status':'BLOCKED','configuredProvider':s.ai_provider,'configuredModel':s.gemini_model,'restartOverride':'mock + empty paid provider chain; no paid calls authorized'}
checks['workerQueueProcessing']={'status':'BLOCKED','reason':'Dedicated QA schema creation denied; worker not started on shared queues'}
(root/'.local/phase4a/infrastructure.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
print(json.dumps(checks))
