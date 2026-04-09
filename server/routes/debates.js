// ===================================================================
// DEBATES ROUTES - Comprehensive Debate Management API
// ===================================================================
// This file consolidates all debate-related operations:
// - Debate CRUD operations (create, read, update, delete)
// - Message posting and retrieval (turn-based messaging)
// - Voting system (recording votes and calculating winners)
// - User profiles and ranking (user statistics)
//
// Organized into sections: DEBATES, MESSAGES, VOTES, USERS
// ===================================================================

const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ===================================================================
// SECTION 1: DEBATE CRUD OPERATIONS
// ===================================================================

// POST /api/debates - Create new debate invitation
// Body: { title, category, opponent_id, starter_id, ender_id, tags }
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

    db.run('UPDATE debates SET views = views + 1 WHERE id = ?', [id], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ error: 'Failed to update views' });
      }

      db.get('SELECT * FROM debates WHERE id = ?', [id], (getErr, updatedDebate) => {
        if (getErr || !updatedDebate) {
          return res.status(500).json({ error: 'Failed to load debate' });
        }
        res.json(updatedDebate);
      });
    });
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

// Delete debate endpoint: Allows admin or debate creator to delete any debate.
// Bob is assigned admin role in database initialization and can delete any debate.
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM debates WHERE id = ?', [id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    if (!req.user.admin && debate.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this debate' });
    }

    db.run('DELETE FROM debates WHERE id = ?', [id], (deleteErr) => {
      if (deleteErr) {
        return res.status(500).json({ error: 'Failed to delete debate' });
      }

      res.json({ message: 'Debate deleted' });
    });
  });
});

// ===================================================================
// SECTION 2: MESSAGE ENDPOINTS (Turn-based messaging)
// ===================================================================

// POST /api/debates/messages - Post message in debate (auto-switches turn)
router.post('/messages', authMiddleware, (req, res) => {
  const { debate_id, content } = req.body;

  if (!debate_id || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get debate info
  db.get('SELECT * FROM debates WHERE id = ?', [debate_id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    // Validate turn
    if (debate.current_turn !== req.user.id) {
      return res.status(403).json({ error: 'Not your turn' });
    }

    // Check if debate is active
    if (debate.status !== 'active') {
      return res.status(400).json({ error: 'Debate is not active' });
    }

    // Insert message
    db.run(
      'INSERT INTO messages (debate_id, user_id, content) VALUES (?, ?, ?)',
      [debate_id, req.user.id, content],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to post message' });
        }

        // Switch turn to opponent
        const nextTurn = debate.current_turn === debate.opponent_id 
          ? debate.creator_id 
          : debate.opponent_id;

        db.run(
          'UPDATE debates SET current_turn = ? WHERE id = ?',
          [nextTurn, debate_id],
          () => {
            res.json({ id: this.lastID, message: 'Message posted' });
          }
        );
      }
    );
  });
});

// GET /api/debates/messages/:debate_id - Get all messages for a debate
router.get('/messages/:debate_id', (req, res) => {
  const { debate_id } = req.params;

  db.all(
    'SELECT m.*, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.debate_id = ? ORDER BY m.created_at ASC',
    [debate_id],
    (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch messages' });
      }
      res.json(messages);
    }
  );
});

// ===================================================================
// SECTION 3: VOTING ENDPOINTS
// ===================================================================

// POST /api/debates/votes - Record a vote on finished debate
router.post('/votes', authMiddleware, (req, res) => {
  const { debate_id, voted_user_id } = req.body;

  if (!debate_id || !voted_user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get debate
  db.get('SELECT * FROM debates WHERE id = ?', [debate_id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    // Check if debate is finished
    if (debate.status !== 'finished') {
      return res.status(400).json({ error: 'Can only vote on finished debates' });
    }

    // Check if voter is not a participant (participants cannot vote)
    if (req.user.id === debate.creator_id || req.user.id === debate.opponent_id) {
      return res.status(403).json({ error: 'Participants cannot vote' });
    }

    // Check if voted user is a participant
    if (voted_user_id !== debate.creator_id && voted_user_id !== debate.opponent_id) {
      return res.status(400).json({ error: 'Invalid vote target' });
    }

    // Insert vote
    db.run(
      'INSERT INTO votes (debate_id, voter_id, voted_user_id) VALUES (?, ?, ?)',
      [debate_id, req.user.id, voted_user_id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'You already voted' });
          }
          return res.status(500).json({ error: 'Failed to post vote' });
        }

        // Calculate winner and update points
        calculateAndSetWinner(debate_id, () => {
          res.json({ id: this.lastID, message: 'Vote registered' });
        });
      }
    );
  });
});

// GET /api/debates/votes/:debate_id - Get all votes for a debate
router.get('/votes/:debate_id', (req, res) => {
  const { debate_id } = req.params;

  db.all(
    'SELECT voter_id, voted_user_id FROM votes WHERE debate_id = ?',
    [debate_id],
    (err, votes) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch votes' });
      }
      res.json(votes);
    }
  );
});

// Helper function: Calculate winner from votes and award points
// This function handles tie-breaking and point adjustments
function calculateAndSetWinner(debateId, callback) {
  db.get('SELECT winner_id FROM debates WHERE id = ?', [debateId], (err, debate) => {
    if (err || !debate) {
      if (callback) callback();
      return;
    }

    db.all(
      'SELECT voted_user_id, COUNT(*) as count FROM votes WHERE debate_id = ? GROUP BY voted_user_id',
      [debateId],
      (voteErr, results) => {
        if (voteErr) {
          if (callback) callback();
          return;
        }

        // Determine winner: 1 vote counts as win, or highest vote count
        let winnerId = null;
        if (results.length === 1) {
          winnerId = results[0].voted_user_id;
        } else if (results.length === 2) {
          if (results[0].count > results[1].count) winnerId = results[0].voted_user_id;
          else if (results[1].count > results[0].count) winnerId = results[1].voted_user_id;
        }

        // If winner hasn't changed, no need to update points
        if (debate.winner_id === winnerId) {
          if (callback) callback();
          return;
        }

        const tasks = [];
        
        // If there was a previous winner and it changed, deduct their point
        if (debate.winner_id && debate.winner_id !== winnerId) {
          tasks.push(cb => db.run('UPDATE users SET points = points - 1 WHERE id = ?', [debate.winner_id], cb));
        }
        
        // Award point to new winner
        if (winnerId) {
          tasks.push(cb => db.run('UPDATE users SET points = points + 1 WHERE id = ?', [winnerId], cb));
        }

        // Update debate winner
        db.run('UPDATE debates SET winner_id = ? WHERE id = ?', [winnerId, debateId], (updateErr) => {
          if (updateErr) {
            if (callback) callback();
            return;
          }

          if (!tasks.length) {
            if (callback) callback();
            return;
          }

          // Execute point adjustments
          let remaining = tasks.length;
          tasks.forEach(task => task(() => {
            remaining -= 1;
            if (remaining === 0 && callback) callback();
          }));
        });
      }
    );
  });
}

// ===================================================================
// SECTION 4: USER PROFILE ENDPOINTS
// ===================================================================

// GET /api/debates/users/:id - Get user profile with stats and ranking
router.get('/users/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT id, username, points, created_at FROM users WHERE id = ?', [id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's debates for stats
    db.all(
      `SELECT id, status, winner_id FROM debates 
       WHERE (creator_id = ? OR opponent_id = ?) 
       ORDER BY created_at DESC`,
      [id, id],
      (err, debates) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch debates' });
        }

        // Calculate rank
        const rank = getRank(user.points);

        res.json({
          ...user,
          rank,
          debateCount: debates.length,
          wonCount: debates.filter(d => d.winner_id === id && d.status === 'finished').length
        });
      }
    );
  });
});

// Helper function: Determine user rank tier based on points
function getRank(points) {
  if (points <= 5) return 'Ny debattant';
  if (points <= 20) return 'Argumentator';
  return 'Retorikkmester';
}

module.exports = router;

