const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Post vote
router.post('/', authMiddleware, (req, res) => {
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

    // Check if voter is not a participant
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

        // Calculate winner and update points (wait for completion)
        calculateAndSetWinner(debate_id, () => {
          res.json({ id: this.lastID, message: 'Vote registered' });
        });
      }
    );
  });
});

// Get votes for debate
router.get('/debate/:debate_id', (req, res) => {
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

// Calculate winner and update points
function calculateAndSetWinner(debateId, callback) {
  db.all(
    'SELECT voted_user_id, COUNT(*) as count FROM votes WHERE debate_id = ? GROUP BY voted_user_id',
    [debateId],
    (err, results) => {
      if (!results || results.length === 0) {
        if (callback) callback();
        return;
      }

      let winnerId = null;
      if (results.length === 1) {
        winnerId = results[0].voted_user_id;
      } else if (results.length === 2) {
        winnerId = results[0].count > results[1].count 
          ? results[0].voted_user_id 
          : results[1].voted_user_id;
      }

      if (winnerId) {
        db.run(
          'UPDATE debates SET winner_id = ? WHERE id = ?',
          [winnerId, debateId],
          () => {
            // Update winner points
            db.run(
              'UPDATE users SET points = points + 1 WHERE id = ?',
              [winnerId],
              () => {
                if (callback) callback();
              }
            );
          }
        );
      } else {
        if (callback) callback();
      }
    }
  );
}

module.exports = router;
