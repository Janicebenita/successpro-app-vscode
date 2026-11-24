const mysql = require('mysql2/promise');
const Redis = require('ioredis');

async function main() {
  const qaConn = await mysql.createConnection('mysql://successpro:successpro@127.0.0.1:3307/successpro_qa');
  const [tables] = await qaConn.execute('SHOW TABLES');
  console.log('QA tables:', tables);
  const [jobs] = await qaConn.execute('SELECT COUNT(*) as cnt FROM resume_processing_jobs');
  console.log('QA jobs:', jobs[0].cnt);
  await qaConn.end();

  const candConn = await mysql.createConnection('mysql://successpro:successpro@127.0.0.1:3307/successpro_local');
  const [candJobs] = await candConn.execute('SELECT COUNT(*) as cnt FROM resume_processing_jobs');
  const [candAssess] = await candConn.execute('SELECT COUNT(*) as cnt FROM resume_review_assessments');
  console.log(`Candidate DB: ${candJobs[0].cnt} jobs, ${candAssess[0].cnt} assessments`);
  await candConn.end();

  const redis = new Redis('redis://127.0.0.1:6380/15');
  const ping = await redis.ping();
  const keys = await redis.keys('*');
  console.log('Redis 15 ping:', ping, 'keys:', keys);
  await redis.quit();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
