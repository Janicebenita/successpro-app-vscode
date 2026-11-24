import mysql.connector
import redis

qa = mysql.connector.connect(host="127.0.0.1", port=3307, user="successpro", password="successpro", database="successpro_qa")
cur = qa.cursor()
cur.execute("SHOW TABLES")
print("QA tables:", cur.fetchall())
cur.execute("SELECT count(*) FROM resume_processing_jobs")
print("QA jobs:", cur.fetchone()[0])
qa.close()

cand = mysql.connector.connect(host="127.0.0.1", port=3307, user="successpro", password="successpro", database="successpro_local")
cur_c = cand.cursor()
cur_c.execute("SELECT count(*) FROM resume_processing_jobs")
print("Cand jobs:", cur_c.fetchone()[0])
cur_c.execute("SELECT count(*) FROM resume_review_assessments")
print("Cand assessments:", cur_c.fetchone()[0])
cand.close()

r = redis.Redis.from_url("redis://127.0.0.1:6380/15")
print("Redis 15 ping:", r.ping(), "keys:", r.keys())
