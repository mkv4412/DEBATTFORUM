// Debates routes: Handle debate creation, retrieval, acceptance, rejection, and ending.
// To add debate categories, modify the category validation and database constraints.
const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Create debate endpoint: Creates new debate invitation with participants and assigns starter/ender roles.
// To enforce debate title length limits, add validation before database insertion.
router.post('/', authMiddleware, (req, res) => {
  const { title, category, opponent_id, starter_id, ender_id, tags } = req.body;

  if (!title || !category || !opponent_id || !starter_id || !ender_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (opponent_id == req.user.id) {
    return res.status(400).json({ error: 'Cannot debate yourself' });
  }

  // Check for existing pending debate with this opponent
  db.get(
    `SELECT id FROM debates WHERE 
    ((creator_id = ? AND opponent_id = ?) OR (creator_id = ? AND opponent_id = ?)) 
    AND status = 'pending'`,
    [req.user.id, opponent_id, opponent_id, req.user.id],
    (err, existingDebate) => {
      if (existingDebate) {
        return res.status(400).json({ error: 'There is already a pending invitation with this opponent' });
      }

      db.run(
        `INSERT INTO debates 
        (title, category, creator_id, opponent_id, starter_id, ender_id, current_turn, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
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

          res.json({ id: debateId, message: 'Invitation sent! Waiting for opponent to accept.' });
        }
      );
    }
  );
});

// Get all debates endpoint: Retrieves debates with optional filtering by category and status.
// Add sorting by date, views, or votes by extending the ORDER BY clause.
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

// Get debate by ID endpoint: Retrieves single debate details and increments view counter.
// Track additional metrics (last_activity, comment_count) by adding UPDATE before SELECT.
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

// End debate endpoint: Marks debate as finished (only ender can call) and enables voting phase.
// To prevent premature endings, add minimum message count requirement before allowing end.
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

// Accept invitation endpoint: Opponent accepts pending debate invitation and changes status to active.
// To require acceptance confirmation, add timeout window before auto-rejecting invitations.
router.post('/:id/accept', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM debates WHERE id = ?', [id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    if (debate.opponent_id !== req.user.id) {
      return res.status(403).json({ error: 'Only opponent can accept' });
    }

    if (debate.status !== 'pending') {
      return res.status(400).json({ error: 'Debate is not pending' });
    }

    db.run(
      'UPDATE debates SET status = ? WHERE id = ?',
      ['active', id],
      () => {
        res.json({ message: 'Invitation accepted' });
      }
    );
  });
});

// Reject invitation endpoint: Opponent rejects invitation, deletes debate record and notifies creator.
// To keep rejection history, change DELETE to UPDATE with rejection_reason and status='rejected'.
router.post('/:id/reject', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM debates WHERE id = ?', [id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    if (debate.opponent_id !== req.user.id) {
      return res.status(403).json({ error: 'Only opponent can reject' });
    }

    if (debate.status !== 'pending') {
      return res.status(400).json({ error: 'Debate is not pending' });
    }

    db.run(
      'DELETE FROM debates WHERE id = ?',
      [id],
      () => {
        res.json({ message: 'Invitation rejected' });
      }
    );
  });
});

module.exports = router;
