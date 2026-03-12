const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Create debate
router.post('/', authMiddleware, (req, res) => {
  const { title, category, opponent_id, starter_id, ender_id, tags } = req.body;

  if (!title || !category || !opponent_id || !starter_id || !ender_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (opponent_id == req.user.id) {
    return res.status(400).json({ error: 'Cannot debate yourself' });
  }

  db.run(
    `INSERT INTO debates 
    (title, category, creator_id, opponent_id, starter_id, ender_id, current_turn) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, category, req.user.id, opponent_id, starter_id, ender_id, starter_id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create debate' });
      }

      const debateId = this.lastID;

      // Add tags if provided
      if (tags && tags.length > 0) {
        tags.forEach((tagName) => {
          db.run(
            'INSERT OR IGNORE INTO tags (name) VALUES (?)',
            [tagName],
            () => {
              db.get('SELECT id FROM tags WHERE name = ?', [tagName], (err, tag) => {
                if (tag) {
                  db.run(
                    'INSERT OR IGNORE INTO debate_tags (debate_id, tag_id) VALUES (?, ?)',
                    [debateId, tag.id]
                  );
                }
              });
            }
          );
        });
      }

      res.json({ id: debateId, message: 'Debate created' });
    }
  );
});

// Get all debates with filtering
router.get('/', (req, res) => {
  const { category, status, tags } = req.query;
  let query = 'SELECT * FROM debates';
  const params = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  if (status) {
    if (query.includes('WHERE')) {
      query += ' AND status = ?';
    } else {
      query += ' WHERE status = ?';
    }
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, debates) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch debates' });
    }
    res.json(debates);
  });
});

// Get debate by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM debates WHERE id = ?', [id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    // Increment views
    db.run('UPDATE debates SET views = views + 1 WHERE id = ?', [id]);

    res.json(debate);
  });
});

// End debate (only by ender_id)
router.post('/:id/end', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM debates WHERE id = ?', [id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    if (debate.ender_id !== req.user.id) {
      return res.status(403).json({ error: 'Only ender can finish debate' });
    }

    if (debate.status !== 'active') {
      return res.status(400).json({ error: 'Debate already finished' });
    }

    db.run(
      'UPDATE debates SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['finished', id],
      () => {
        res.json({ message: 'Debate finished' });
      }
    );
  });
});

module.exports = router;
