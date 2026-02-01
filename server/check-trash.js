import initSqlJs from 'sql.js';
import fs from 'fs';

const dbPath = './data/gmail-client.db';

async function checkTrash() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Összes email
  const total = db.exec('SELECT COUNT(*) as total FROM emails');
  console.log('Összes email:', total[0].values[0][0]);

  // TRASH labelű emailek
  const trashEmails = db.exec("SELECT COUNT(*) as total FROM emails WHERE labels LIKE '%TRASH%'");
  console.log('TRASH labelű emailek:', trashEmails[0]?.values[0][0] || 0);

  // Példa emailek labels mezői
  const samples = db.exec('SELECT id, subject, labels FROM emails LIMIT 5');
  console.log('\nPélda emailek labels mezői:');
  if (samples[0]) {
    samples[0].values.forEach(row => {
      console.log(`ID: ${row[0]}, Subject: ${row[1]}, Labels: ${row[2]}`);
    });
  }

  db.close();
}

checkTrash().catch(console.error);
