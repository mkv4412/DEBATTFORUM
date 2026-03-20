// Initialize SQLite database connection and create tables if they don't exist.
// Change DB_PATH to use a different database file or location.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'debates.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // Users table: Stores user accounts with username, hashed password, and points earned from debate wins.
  // Add new user fields (email, bio, avatar) to this table structure.
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Debates table: Stores debate metadata including participants, status, and turn information.
  // Modify status values or add scoring columns based on debate rule changes.
  db.run(`
    CREATE TABLE IF NOT EXISTS debates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      opponent_id INTEGER NOT NULL,
      starter_id INTEGER NOT NULL,
      ender_id INTEGER NOT NULL,
      current_turn INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      views INTEGER DEFAULT 0,
      winner_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      FOREIGN KEY (creator_id) REFERENCES users(id),
      FOREIGN KEY (opponent_id) REFERENCES users(id),
      FOREIGN KEY (starter_id) REFERENCES users(id),
      FOREIGN KEY (ender_id) REFERENCES users(id),
      FOREIGN KEY (winner_id) REFERENCES users(id)
    )
  `);

  // Messages table: Stores debate messages with timestamps and foreign keys linking to debates and users.
  // Add message_type column to support different message types (normal, system, etc).
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (debate_id) REFERENCES debates(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Votes table: Stores votes on finished debates with UNIQUE constraint to prevent duplicate voting.
  // Modify UNIQUE constraint if allowing multiple votes per user per debate.
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id INTEGER NOT NULL,
      voter_id INTEGER NOT NULL,
      voted_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(debate_id, voter_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id),
      FOREIGN KEY (voter_id) REFERENCES users(id),
      FOREIGN KEY (voted_user_id) REFERENCES users(id)
    )
  `);

  // Tags table: Stores debate topic tags that can be associated with multiple debates.
  // Add tag_color, tag_category columns to organize tags better.
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

  // Debate_Tags junction table: Links debates to multiple tags in a many-to-many relationship.
  // This structure allows tag reuse and flexible debate categorization.
  db.run(`
    CREATE TABLE IF NOT EXISTS debate_tags (
      debate_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (debate_id, tag_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    )
  `);
}

module.exports = db;
