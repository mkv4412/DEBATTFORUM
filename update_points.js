// Update points script: Directly modifies user points in database using path relative to project root.
// Use this in management scripts or admin endpoints; in production, award points through vote system.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database: Uses path.join to construct database path from root folder.
// Modify dbPath if database location changes relative to project structure.
const dbPath = path.join(__dirname, 'server', 'debates.db');
const db = new sqlite3.Database(dbPath);

// Update bob's points: Set bob's points to 50 (useful for testing or admin operations).
// Modify username and points value as needed for different users.
db.run('UPDATE users SET points = 50 WHERE username = "bob"', (err) => {
  if (err) console.error('Error updating bob:', err);
  else console.log('Updated bob: 50 points');
});

// Update alice's points: Set alice's points to 15.
// Run multiple similar queries to update multiple users' points in batch.
db.run('UPDATE users SET points = 15 WHERE username = "alice"', (err) => {
  if (err) console.error('Error updating alice:', err);
  else console.log('Updated alice: 15 points');
});

// Display all users: Wait briefly then query and display all users' points after updates.
// Remove 500ms timeout or increase if database writes haven't completed.
setTimeout(() => {
  db.all('SELECT username, points FROM users ORDER BY username', (err, rows) => {
    if (rows) {
      console.log('\nAll users:');
      rows.forEach(r => console.log(`  ${r.username}: ${r.points} points`));
    }
    db.close();
  });
}, 500);
