const mysql = require('mysql2/promise');
const crypto = require('crypto');

async function test() {
  const conn = await mysql.createConnection('mysql://successpro:successpro@127.0.0.1:3307/successpro_qa');
  console.log('Connected to MySQL successpro_qa on 3307');

  // Verify table
  const [cols] = await conn.query("SHOW COLUMNS FROM resume_review_assessments");
  const colNames = cols.map(c => c.Field);
  console.log('Columns in resume_review_assessments:', colNames);

  const expectedCols = ['eval_dedupe_key', 'resume_hash', 'original_filename', 'evaluation_mode', 'job_description_hash', 'ats_score', 'rubric_version'];
  for (const c of expectedCols) {
    if (!colNames.includes(c)) {
      console.error('Missing expected column:', c);
      process.exit(1);
    }
  }
  console.log('All deduplication columns are verified present in MySQL!');
  await conn.end();
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
