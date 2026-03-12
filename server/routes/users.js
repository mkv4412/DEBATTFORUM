const express = require('express');
const db = require('../database');

const router = express.Router();

// Get user profile
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT id, username, points, created_at FROM users WHERE id = ?', [id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's debates
    db.all(
      `SELECT id, title, status, winner_id FROM debates 
       WHERE (creator_id = ? OR opponent_id = ?) 
       ORDER BY created_at DESC`,
      [id, id],
      (err, debates) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch debates' });
        }

        const debateHistory = debates.map(debate => ({
          id: debate.id,
          title: debate.title,
          status: debate.status,
          won: debate.winner_id === id && debate.status === 'finished'
        }));

        // Calculate rank
        const rank = getRank(user.points);

        res.json({
          ...user,
          rank,
          debateCount: debates.length,
          wonCount: debates.filter(d => d.winner_id === id && d.status === 'finished').length,
          debateHistory
        });
      }
    );
  });
});

function getRank(points) {
  if (points <= 5) return 'Ny debattant';
  if (points <= 20) return 'Argumentator';
  return 'Retorikkmester';
}

module.exports = router;
