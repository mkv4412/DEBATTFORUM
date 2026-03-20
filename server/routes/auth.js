// Auth routes: Handle user registration, login, profile retrieval, and user search.
// Change password minimum length by modifying the password.length check.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Register endpoint: Creates new user account with hashed password and basic validation.
// To strengthen security, add email verification or password complexity requirements.
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [username, hashedPassword],
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      res.json({ id: this.lastID, username });
    }
  );
});

// Login endpoint: Validates credentials against database and returns JWT token if valid.
// To add account lockout, track failed login attempts and add rate limiting.
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, {
      expiresIn: '7d'
    });

    res.json({ token, user: { id: user.id, username: user.username, points: user.points } });
  });
});

// Get current user endpoint: Returns authenticated user's profile data using JWT token from middleware.
// Add additional fields like email, bio, or avatar by expanding the SELECT query.
router.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT id, username, points FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Search users endpoint: Returns users matching search query with limit of 10 results (no auth needed).
// Increase limit or add pagination by modifying the LIMIT value or adding offset parameter.
router.get('/search', (req, res) => {
  const { username } = req.query;

  if (!username || username.length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }

  db.all(
    'SELECT id, username, points FROM users WHERE username LIKE ? LIMIT 10',
    [`%${username}%`],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Search failed' });
      }
      res.json(users);
    }
  );
});

module.exports = router;
