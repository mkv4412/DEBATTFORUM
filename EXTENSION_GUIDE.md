# EXTENSION GUIDE - How to Add New Features to Debattforum

This guide teaches you how to extend the Debattforum project by adding new features. It covers the most common tasks: adding new routes, adding new database fields, and adding new UI elements.

**Table of Contents:**
- [1. Understanding the Architecture](#1-understanding-the-architecture)
- [2. How to Add a New API Route](#2-how-to-add-a-new-api-route)
- [3. How to Add a New Database Field](#3-how-to-add-a-new-database-field)
- [4. How to Add a New Frontend Page/View](#4-how-to-add-a-new-frontend-pageview)
- [5. How to Add a New Button/Feature to an Existing Page](#5-how-to-add-a-new-buttonfeature-to-an-existing-page)
- [6. How to Modify the Voting System](#6-how-to-modify-the-voting-system)
- [7. Troubleshooting Common Issues](#7-troubleshooting-common-issues)

---

## 1. Understanding the Architecture

Before you add features, understand how data flows:

```
User clicks button in HTML
    ↓
JavaScript event listener triggers (in app.js)
    ↓
apiFetch() sends HTTP request to backend
    ↓
Express route handler processes request
    ↓
Database query (SQLite)
    ↓
Response sent back to frontend
    ↓
JavaScript updates HTML with response
    ↓
User sees result
```

**Files you'll typically edit:**
- **Frontend:** `client/app.js` (logic) + `client/index.html` (UI)
- **Backend:** `server/routes/debates.js` (or create new route file) + `server/database.js` (schema)

---

## 2. How to Add a New API Route

**Scenario:** You want to add a "favorite debate" feature where users can save debates to a favorites list.

### Step 1: Add Database Table

Edit `server/database.js`, find the `initializeDatabase()` function and add a new table:

```javascript
function initializeDatabase() {
  // ... existing tables ...

  // NEW: Favorites table - stores which debates users have favorited
  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      debate_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (debate_id) REFERENCES debates(id),
      UNIQUE(user_id, debate_id)
    )
  `);
}
```

**Explanation:**
- `user_id` and `debate_id` are foreign keys linking to other tables
- `UNIQUE(user_id, debate_id)` prevents duplicate favorites
- `created_at` tracks when they favorited it

### Step 2: Add Routes for the New Feature

Edit `server/routes/debates.js`. Find `module.exports = router;` at the bottom and add your new endpoint before it:

```javascript
// ===================================================================
// NEW SECTION: FAVORITES ENDPOINTS
// ===================================================================

// POST /api/debates/favorites - Add debate to user's favorites
router.post('/favorites', authMiddleware, (req, res) => {
  const { debate_id } = req.body;

  if (!debate_id) {
    return res.status(400).json({ error: 'Missing debate_id' });
  }

  // Check debate exists
  db.get('SELECT id FROM debates WHERE id = ?', [debate_id], (err, debate) => {
    if (err || !debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    // Try to add favorite
    db.run(
      'INSERT INTO favorites (user_id, debate_id) VALUES (?, ?)',
      [req.user.id, debate_id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Already favorited' });
          }
          return res.status(500).json({ error: 'Failed to favorite' });
        }
        res.json({ message: 'Added to favorites' });
      }
    );
  });
});

// GET /api/debates/favorites - Get user's favorite debates
router.get('/favorites', authMiddleware, (req, res) => {
  db.all(
    `SELECT d.* FROM debates d 
     INNER JOIN favorites f ON d.id = f.debate_id 
     WHERE f.user_id = ? 
     ORDER BY f.created_at DESC`,
    [req.user.id],
    (err, favorites) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch favorites' });
      }
      res.json(favorites);
    }
  );
});

// DELETE /api/debates/favorites/:debate_id - Remove from favorites
router.delete('/favorites/:debate_id', authMiddleware, (req, res) => {
  const { debate_id } = req.params;

  db.run(
    'DELETE FROM favorites WHERE user_id = ? AND debate_id = ?',
    [req.user.id, debate_id],
    () => {
      res.json({ message: 'Removed from favorites' });
    }
  );
});

module.exports = router;
```

### Step 3: Test the Routes

Start your server from terminal:
```bash
cd server
node server.js
```

Use a tool like Postman or curl to test:
```bash
# Add favorite (replace TOKEN with auth token, DEBATE_ID with actual ID)
curl -X POST http://localhost:5000/api/debates/favorites \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"debate_id": 1}'

# Get favorites
curl -X GET http://localhost:5000/api/debates/favorites \
  -H "Authorization: Bearer TOKEN"
```

---

## 3. How to Add a New Database Field

**Scenario:** You want to add a "difficulty level" field to debates (easy, medium, hard).

### Step 1: Modify the Database Schema

Edit `server/database.js`, find the `CREATE TABLE...debates` section and add your column:

```javascript
// Before adding - this is the OLD code:
db.run(`
  CREATE TABLE IF NOT EXISTS debates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    ... existing fields ...
  )
`);

// After adding - this is what you want:
db.run(`
  CREATE TABLE IF NOT EXISTS debates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    ... existing fields ...
    difficulty TEXT DEFAULT 'medium'  // NEW LINE
  )
`);
```

**Important:** If the table already exists with data, SQLite won't recreate it. Add an ALTER TABLE migration:

```javascript
// Add this AFTER the CREATE TABLE (in initializeDatabase):
db.run("ALTER TABLE debates ADD COLUMN difficulty TEXT DEFAULT 'medium'", (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding difficulty column:', err);
  }
});
```

### Step 2: Update Your API Route

When creating a debate, now accept the difficulty field:

```javascript
router.post('/', authMiddleware, (req, res) => {
  const { title, category, opponent_id, starter_id, ender_id, tags, difficulty } = req.body;

  // ... existing validation ...

  db.run(
    `INSERT INTO debates 
    (title, category, creator_id, opponent_id, starter_id, ender_id, current_turn, status, difficulty) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [title, category, req.user.id, opponent_id, starter_id, ender_id, starter_id, difficulty || 'medium'],
    // ... rest of code ...
  );
});
```

---

## 4. How to Add a New Frontend Page/View

**Scenario:** You want to add a "Top Debaters" leaderboard page.

### Step 1: Add HTML for the New View

Edit `client/index.html`, add a new view section BEFORE the `</body>` tag:

```html
<!-- Leaderboard view (NEW) -->
<div class="view" id="leaderboardView">
  <button class="btn-back" onclick="app.goHome()">← Back</button>
  <div class="container">
    <h2>🏆 Top Debaters</h2>
    <div id="leaderboard"></div>
  </div>
</div>
```

### Step 2: Add Navigation Link

Find the navbar in `client/index.html` and add a link:

```html
<div class="navbar-menu">
  <a href="#" class="nav-link" onclick="app.goLeaderboard(); return false;">🏆 Leaderboard</a>
  <!-- other nav items ... -->
</div>
```

### Step 3: Add JavaScript Logic

Edit `client/app.js`, add these methods:

```javascript
goLeaderboard() {
  this.showView('leaderboardView');
  this.loadLeaderboard();
},

async loadLeaderboard() {
  try {
    // Get all users sorted by points (highest first)
    const users = await this.apiFetch('/debates/users'); // You'll need to add this endpoint

    const leaderboard = this.getById('leaderboard');
    leaderboard.innerHTML = '';

    // Create table/list
    users.forEach((user, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-row';
      row.innerHTML = `
        <span class="medal">${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}</span>
        <span class="name">${this.escapeHtml(user.username)}</span>
        <span class="points">${user.points} pts</span>
      `;
      leaderboard.appendChild(row);
    });
  } catch (err) {
    this.showMessage('leaderboardView', `Error: ${err.message}`, 'error');
  }
}
```

### Step 4: Add CSS (if needed)

Edit `client/styles.css` and add:

```css
.leaderboard-row {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  align-items: center;
}

.leaderboard-row .medal {
  font-size: 1.5rem;
  width: 30px;
}

.leaderboard-row .name {
  flex: 1;
  font-weight: 600;
}

.leaderboard-row .points {
  color: var(--secondary-color);
  font-weight: bold;
}
```

---

## 5. How to Add a New Button/Feature to an Existing Page

**Scenario:** You want to add a "Report Debate" button on the debate detail page.

### Step 1: Add the Button to HTML

Edit `client/index.html`, find the debate view and add the button:

```html
<div class="debate-container">
  <!-- existing content ... -->
  
  <div class="debate-actions">
    <!-- NEW BUTTON -->
    <button id="reportDebateBtn" class="btn btn-secondary">
      ⚠️ Report Debate
    </button>
  </div>
</div>
```

### Step 2: Add Event Listener

Edit `client/app.js`, find the init function and add:

```javascript
async init() {
  // ... existing code ...
  
  // NEW: Setup report button
  document.getElementById('reportDebateBtn')?.addEventListener('click', () => {
    this.reportDebate();
  });
}
```

### Step 3: Add the Handler Method

Add this method to the app object in `client/app.js`:

```javascript
async reportDebate() {
  const reason = prompt('Why are you reporting this debate?');
  if (!reason) return;

  try {
    await this.apiFetch(`/debates/${this.currentDebate.id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    this.showMessage('debateView', 'Report submitted. Thank you!', 'success');
  } catch (err) {
    this.showMessage('debateView', `Error: ${err.message}`, 'error');
  }
}
```

### Step 4: Add Backend Route

Add this to `server/routes/debates.js`:

```javascript
// POST /api/debates/:id/report - Report debate for abuse
router.post('/:id/report', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Reason required' });
  }

  // In production, save to database for admin review
  // For now, just log it:
  console.log(`Report: User ${req.user.id} reported debate ${id} for: ${reason}`);

  res.json({ message: 'Report submitted' });
});
```

---

## 6. How to Modify the Voting System

**Scenario:** You want to change how points are awarded (2 points instead of 1).

### Step 1: Find the Voting Logic

Edit `server/routes/debates.js`, search for `calculateAndSetWinner` function. Find these lines:

```javascript
// Award point to new winner
if (winnerId) {
  tasks.push(cb => db.run('UPDATE users SET points = points + 1 WHERE id = ?', [winnerId], cb));
}

// If there was a previous winner and it changed, deduct their point
if (debate.winner_id && debate.winner_id !== winnerId) {
  tasks.push(cb => db.run('UPDATE users SET points = points - 1 WHERE id = ?', [debate.winner_id], cb));
}
```

### Step 2: Modify the Points

Change `+ 1` to `+ 2` and `- 1` to `- 2`:

```javascript
// Award 2 points to new winner (CHANGED)
if (winnerId) {
  tasks.push(cb => db.run('UPDATE users SET points = points + 2 WHERE id = ?', [winnerId], cb));
}

// If there was a previous winner and it changed, deduct 2 points (CHANGED)
if (debate.winner_id && debate.winner_id !== winnerId) {
  tasks.push(cb => db.run('UPDATE users SET points = points - 2 WHERE id = ?', [debate.winner_id], cb));
}
```

### Step 3: Test It

Create a debate, end it, vote, and see if the winning user gets 2 points instead of 1.

---

## 7. Troubleshooting Common Issues

### Issue: "Cannot POST /api/debates/myfeatue"

**Cause:** Route doesn't exist or is misspelled.

**Solution:**
1. Check `server/routes/debates.js` - do you have `router.post('/myfeature'`?
2. Check `server/server.js` - is `debateRoutes` imported and mounted on `/api/debates`?
3. Check spelling in both backend and frontend

### Issue: "Not your turn" error when posting message

**Cause:** The turn validation is working - you're not allowed to post yet.

**Solution:**
- Check the database: who has `current_turn` in the debates table?
- Wait for the other person to post first
- Or check if debate status is actually 'active'

### Issue: Frontend shows old data after I updated something

**Cause:** Browser caching or stale page data.

**Solution:**
- Hard refresh browser: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- Close browser tab and reopen
- Check if `loadDebate()` is being called after your change

### Issue: Frontend app.js changes "aren't working"

**Cause:** Old version still running or syntax error.

**Solution:**
1. Check browser console for errors: `F12` → Console tab
2. Check if file was saved: Look at `client/app.js` modification time
3. Validate syntax: Run `node -c client/app.js` in terminal
4. Hard refresh browser

### Issue: Database errors about "UNIQUE constraint failed"

**Cause:** You're trying to insert a duplicate value in a UNIQUE column.

**Solution:**
- Check if the combination already exists in database
- Add a check before inserting: `db.get('SELECT * FROM ...'` first
- Or use `INSERT OR IGNORE` to silently skip duplicates

---

## Quick Reference: Common Commands

```bash
# Validate JavaScript syntax
node -c server/routes/debates.js
node -c client/app.js

# Start the server
cd server
npm install  # if you added npm packages
node server.js

# Check specific database table
# Open database viewer or use terminal SQLite
sqlite3 debates.db
> SELECT * FROM debates;
> SELECT * FROM users;
> .exit
```

---

## Summary

To add features, remember this pattern:

1. **Database:** Add table/column in `database.js`
2. **Backend:** Add route in `routes/debates.js`
3. **Frontend HTML:** Add element in `index.html`
4. **Frontend JS:** Add method/event in `app.js`
5. **Test:** Run server, try in browser, check console for errors

**Always test after making changes!**

