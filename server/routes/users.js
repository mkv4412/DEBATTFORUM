// User routes: Handle user profile retrieval with stats and ranking.
// To add leaderboard, create GET /ranking endpoint that orders users by points DESC.
const express = require('express');
const db = require('../database');

const router = express.Router();

// Get user profile endpoint: Returns user data with calculated stats (debates, wins) and rank.
// To add win percentage, calculate wonCount divided by debateCount before returning.
router.get('/:id', (req, res) => {
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

// Get rank function: Returns user rank tier based on points (3 tiers: Ny, Argumentator, Retorikkmester).
// To add more ranks, add additional if conditions or move ranks to database table for flexibility.
function getRank(points) {
  if (points <= 5) return 'Ny debattant';
  if (points <= 20) return 'Argumentator';
  return 'Retorikkmester';
}

module.exports = router;
