"""Provision a new, isolated local QA schema only; never recreate or clear a schema."""
import json,sys
from pathlib import Path
from urllib.parse import urlparse,unquote,urlunparse
import mysql.connector,redis
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'processing'))
from resume_worker.config import Settings
s=Settings.load();u=urlparse(s.mysql_url)
name='successpro_phase4a_01a1e3f5'
conn=mysql.connector.connect(host=u.hostname,port=u.port or 3306,user=unquote(u.username or ''),password=unquote(u.password or ''),connection_timeout=5)
cursor=conn.cursor();cursor.execute('SHOW DATABASES LIKE %s',(name,))
if cursor.fetchone():raise SystemExit('QA schema already exists; refusing to recreate or reset it')
redis_url=urlunparse(urlparse(s.redis_url)._replace(path='/15'))
r=redis.Redis.from_url(redis_url,socket_connect_timeout=5,socket_timeout=5)
assert r.ping() and r.dbsize()==0,'Redis logical DB15 is unavailable or nonempty; do not touch it'
cursor.execute(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4');cursor.execute(f'USE `{name}`')
schema=(root/'processing/schema.sql').read_text(encoding='utf-8')
assert 'DROP ' not in schema.upper() and 'TRUNCATE ' not in schema.upper()
for statement in schema.split(';'):
 if statement.strip():cursor.execute(statement)
conn.commit();conn.close()
qa=root/'.local/phase4a/isolated';qa.mkdir(parents=True,exist_ok=True)
for folder in ['resumes','tmp']:(qa/folder).mkdir(exist_ok=True)
env={'DEV_BYPASS_AUTH':'true','GOOGLE_CLOUD_PROJECT':'successpro-local','RESUME_NATIVE_PIPELINE_ENABLED':'true','NEXT_PUBLIC_RESUME_NATIVE_PIPELINE_ENABLED':'true','RESUME_NATIVE_LOCAL_USER_ID':'local-developer','RESUME_AI_PROVIDER':'mock','GEMINI_API_KEY':'','GEMINI_MODEL':'','AI_PROVIDER_CHAIN_JSON':json.dumps({'policyVersion':'phase4a-no-paid','providers':[],'cacheTtlHours':0}),'RESUME_MYSQL_URL':urlunparse(u._replace(path='/'+name)),'RESUME_REDIS_URL':redis_url,'RESUME_LOCAL_STORAGE_ROOT':str(qa/'resumes'),'RESUME_TEMP_ROOT':str(qa/'tmp'),'NEXT_DIST_DIR':'.next-phase4a'}
# Contains existing local DB credentials; never print this file or copy it into the final report.
(qa/'environment.private.json').write_text(json.dumps(env),encoding='utf-8')
print(json.dumps({'database':name,'redisDatabase':15,'provider':'mock/no paid providers','status':'READY'}))
