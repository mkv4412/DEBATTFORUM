const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'debates.db');
const db = new sqlite3.Database(dbPath);

db.run('UPDATE users SET points = 50 WHERE username = "bob"', (err) => {
  if (err) console.error('Error updating bob:', err);
  else console.log('Updated bob: 50 points');
});

db.run('UPDATE users SET points = 15 WHERE username = "alice"', (err) => {
  if (err) console.error('Error updating alice:', err);
  else console.log('Updated alice: 15 points');
});

setTimeout(() => {
  db.all('SELECT username, points FROM users ORDER BY username', (err, rows) => {
    if (rows) {
      console.log('\nAll users:');
      rows.forEach(r => console.log(`  ${r.username}: ${r.points} points`));
    }
    db.close();
  });
}, 500);
