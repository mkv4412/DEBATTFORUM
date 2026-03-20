// Message routes: Handle posting debate messages and retrieving message threads.
// To add message editing, add UPDATE route and timestamp tracking for edits.
const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Post message endpoint: Inserts message, validates turn, and switches turn to opponent.
// To add message moderation, validate content against spam/profanity filters before insertion.
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

        // Switch turn
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

// Get messages endpoint: Retrieves all messages for debate with username joins in chronological order.
// To paginate messages, add LIMIT and OFFSET parameters to prevent loading thousands of messages.
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

module.exports = router;
