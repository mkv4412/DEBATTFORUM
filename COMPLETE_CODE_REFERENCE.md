# Complete Debattforum Code Walkthrough - For Professor Consultation

This document teaches you the ENTIRE codebase architecture, data flow, and how to make ANY change your professor asks for. No fluff, just deep knowledge.

---

## Table of Contents

1. [Overall Architecture](#overall-architecture)
2. [Technology Stack & Why](#technology-stack--why)
3. [Complete Data Flow: Request to Response](#complete-data-flow-request-to-response)
4. [Database Schema in Depth](#database-schema-in-depth)
5. [Frontend in Depth](#frontend-in-depth)
6. [Backend Routes in Depth](#backend-routes-in-depth)
7. [Authentication & Security](#authentication--security)
8. [How to Implement Any Change](#how-to-implement-any-change)
9. [Common Patterns](#common-patterns)
10. [File Reference Guide](#file-reference-guide)

---

## Overall Architecture

### The Big Picture

```
┌──────────────────────────────────────────────────────────────┐
│ USER BROWSER (client/)                                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  index.html (structure)           ← User sees & interacts   │
│       ↓                                                        │
│  app.js (logic)                   ← Handles app behavior    │
│       ↓                                                        │
│  styles.css (presentation)        ← Visual design           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
              ↕ HTTP JSON requests & responses
              ↕ (apiFetch function)
┌──────────────────────────────────────────────────────────────┐
│ NODE.JS SERVER (server/)                                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  server.js                        ← Express app entry point │
│       ↓                                                        │
│  Routes (auth.js, debates.js)     ← API endpoints           │
│       ↓                                                        │
│  Middleware (auth.js)             ← JWT validation          │
│       ↓                                                        │
│  database.js                      ← Database connection     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
              ↕ SQL Queries
              ↕ Database operations
┌──────────────────────────────────────────────────────────────┐
│ SQLITE DATABASE (debates.db)                                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  7 Tables: users, debates, messages, votes, tags, etc.      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

- **Separation of Concerns:** Frontend (UI), Backend (logic), Database (data)
- **Stateless Server:** Each request is independent; no session storage
- **Scalable:** Can add more routes/features without breaking existing code
- **Secure:** Password hashing, JWT tokens, validation on both client and server

---

## Technology Stack & Why

### Frontend
- **HTML5:** Semantic markup (no frameworks - simpler for learning)
- **Vanilla JavaScript:** Direct DOM manipulation, no compiler/build step
- **CSS3:** Responsive design with flexbox/grid

**Why?** Lightweight, beginner-friendly, no dependencies.

### Backend
- **Node.js:** JavaScript runtime (single language for full stack)
- **Express.js:** HTTP server framework (handles routing, middleware)
- **SQLite3:** File-based SQL database (no separate server needed)
- **bcryptjs:** Password hashing (security library)
- **jsonwebtoken (JWT):** Stateless authentication tokens
- **cors:** Cross-Origin Resource Sharing (allows frontend to call backend)

**Why?** JavaScript everywhere, minimal dependencies, easy to learn, good for school projects.

### Configuration
- **config.js:** Centralized settings (PORT, DB_PATH, JWT_SECRET)
- **Environment Variables:** Can override defaults without changing code

---

## Complete Data Flow: Request to Response

Let me show you the EXACT flow when a user creates a debate.

### Step 1: User Clicks "Create Debate" Button (Frontend)

**File:** `client/index.html`
```html
<form id="createDebateForm" class="debate-form">
  <input id="debateTitle" type="text" placeholder="Debate title">
  <input id="debateCategory" type="text" placeholder="Category">
  <!-- opponent selection UI -->
  <button type="submit">Create</button>
</form>
```

**File:** `client/app.js` - Event Handler
```javascript
async createDebate(event) {
  event.preventDefault();  // Prevent default form submission
  
  const title = this.getById('debateTitle').value.trim();
  const category = this.getById('debateCategory').value;
  // ... more field extraction ...
  
  try {
    // Make HTTP request to backend
    await this.apiFetch('/debates', { 
      method: 'POST', 
      body: JSON.stringify({ 
        title, 
        category, 
        opponent_id, 
        starter_id, 
        ender_id, 
        tags 
      }) 
    });
    this.showMessage('✅ Debate created!', 'success');
    this.loadDebates();  // Refresh debate list
  } catch (err) {
    this.showMessage('❌ ' + err.message, 'error');
  }
}
```

### Step 2: apiFetch Prepares & Sends HTTP Request

**File:** `client/app.js` - apiFetch Function
```javascript
async apiFetch(path, options = {}) {
  const url = this.apiBase + '/api' + path;  // Full URL: http://localhost:5000/api/debates
  
  const fetchOptions = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  // IMPORTANT: Add JWT token for authentication
  if (this.token) {
    fetchOptions.headers['Authorization'] = `Bearer ${this.token}`;
  }
  
  if (options.body) {
    fetchOptions.body = options.body;  // Attach request data
  }
  
  // Send HTTP request
  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();  // Parse response as JSON
}
```

**What HTTP request looks like:**
```
POST /api/debates HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "Should AI be regulated?",
  "category": "politics",
  "opponent_id": 2,
  "starter_id": 1,
  "ender_id": 2,
  "tags": ["AI", "regulation"]
}
```

### Step 3: Express Server Receives Request

**File:** `server/server.js`
```javascript
const express = require('express');
const app = express();

// Middleware: Process incoming requests
app.use(express.json());  // Parse JSON body automatically
app.use(cors());          // Allow cross-origin requests
app.use(express.static(path.join(__dirname, '../client')));  // Serve static files

// Route mounting: all requests to /api/debates go to debateRoutes
app.use('/api/debates', debateRoutes);
```

Express matches `/api/debates` and routes to the debates router.

### Step 4: Middleware Validates JWT Token

**File:** `server/middleware/auth.js`
```javascript
module.exports = authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];  // Extract token from "Bearer TOKEN"
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify token is valid and not expired
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;  // Attach user info to request
    next();  // Continue to next middleware/route
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

The middleware checks:
1. Token exists?
2. Token is valid (hasn't been tampered with)?
3. Token hasn't expired?

If all pass, `req.user` contains the user data (id, username, etc.)

### Step 5: Route Handler Processes Request

**File:** `server/routes/debates.js`
```javascript
// This matches POST /api/debates
router.post('/', authMiddleware, (req, res) => {
  const { title, category, opponent_id, starter_id, ender_id, tags } = req.body;
  
  // Validation
  if (!title || !category || !opponent_id || !starter_id || !ender_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (opponent_id == req.user.id) {  // User is already authenticated by middleware
    return res.status(400).json({ error: 'Cannot debate yourself' });
  }
  
  // Check if pending debate already exists with opponent
  db.get(
    `SELECT id FROM debates WHERE 
    ((creator_id = ? AND opponent_id = ?) OR (creator_id = ? AND opponent_id = ?)) 
    AND status = 'pending'`,
    [req.user.id, opponent_id, opponent_id, req.user.id],
    (err, existingDebate) => {
      if (existingDebate) {
        return res.status(400).json({ error: 'Already a pending invitation' });
      }
      
      // Insert into database
      db.run(
        `INSERT INTO debates 
        (title, category, creator_id, opponent_id, starter_id, ender_id, current_turn, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [title, category, req.user.id, opponent_id, starter_id, ender_id, starter_id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create debate' });
          }
          
          const debateId = this.lastID;  // Database auto-increment ID
          
          // Add tags if provided
          if (tags && tags.length > 0) {
            tags.forEach((tagName) => {
              db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tagName], () => {
                db.get('SELECT id FROM tags WHERE name = ?', [tagName], (err, tag) => {
                  if (tag) {
                    db.run(
                      'INSERT OR IGNORE INTO debate_tags (debate_id, tag_id) VALUES (?, ?)',
                      [debateId, tag.id]
                    );
                  }
                });
              });
            });
          }
          
          res.json({ id: debateId, message: 'Invitation sent!' });
        }
      );
    }
  );
});
```

This is the MOST IMPORTANT PATTERN: Callback hell. Every database operation is nested.

### Step 6: Database Stores Data

The SQLite database receives INSERT command and stores the debate record.

### Step 7: Response Sent Back to Frontend

```json
{
  "id": 5,
  "message": "Invitation sent!"
}
```

### Step 8: Frontend Processes Response

```javascript
// In createDebate function:
await this.apiFetch('/debates', { ... });
this.showMessage('✅ Debate created!', 'success');
this.loadDebates();  // Reload debate list to show new debate
```

The UI updates with a success message and refreshes the debate list.

---

## Database Schema in Depth

### 7 Tables and Their Relationships

#### 1. **users** - User accounts
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,           -- Unique identifier for login
  password_hash TEXT NOT NULL,             -- Bcryptjs hashed password
  points INTEGER DEFAULT 0,                -- Points earned from winning debates
  admin INTEGER DEFAULT 0,                 -- 1 if admin, 0 if regular user
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key points:**
- Passwords are NEVER stored plain text - always hashed with bcryptjs
- `points` tracks user rank (see getRank function for tiers)
- Only "bob" user is admin by default

#### 2. **debates** - Debate records
```sql
CREATE TABLE debates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  creator_id INTEGER NOT NULL,             -- User who started
  opponent_id INTEGER NOT NULL,            -- Other participant
  starter_id INTEGER NOT NULL,             -- Who speaks first
  ender_id INTEGER NOT NULL,               -- Who can end debate
  current_turn INTEGER NOT NULL,           -- Whose turn to post message (user_id)
  status TEXT DEFAULT 'pending',           -- pending, active, finished
  views INTEGER DEFAULT 0,                 -- View counter
  winner_id INTEGER DEFAULT NULL,          -- User who won voting
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME DEFAULT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id),
  FOREIGN KEY (opponent_id) REFERENCES users(id),
  FOREIGN KEY (winner_id) REFERENCES users(id)
);
```

**Status flow:**
1. `pending` - Created, waiting for opponent to accept
2. `active` - Opponent accepted, users can post messages
3. `finished` - One user ended debate, voting phase begins

**Turn system:**
- `current_turn` = user_id of whose turn it is
- When user posts message, `current_turn` switches to opponent

#### 3. **messages** - Debate arguments
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debate_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (debate_id) REFERENCES debates(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 4. **votes** - Who voted for whom
```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debate_id INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,               -- Who voted
  voted_user_id INTEGER NOT NULL,          -- Who they voted for
  UNIQUE(debate_id, voter_id),             -- Prevent duplicate votes
  FOREIGN KEY (debate_id) REFERENCES debates(id),
  FOREIGN KEY (voter_id) REFERENCES users(id),
  FOREIGN KEY (voted_user_id) REFERENCES users(id)
);
```

**UNIQUE constraint:** Prevents same person voting twice on same debate.

#### 5. **tags** - Debate categories
```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);
```

#### 6 & 7. **debate_tags** - Junction table (Many-to-many relationship)
```sql
CREATE TABLE debate_tags (
  debate_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  FOREIGN KEY (debate_id) REFERENCES debates(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id),
  UNIQUE(debate_id, tag_id)
);
```

This allows one debate to have multiple tags, and one tag to apply to multiple debates.

### Foreign Keys
Every reference to another table includes `FOREIGN KEY` constraint. This ensures referential integrity:
- Can't have messages for non-existent debates
- Can't have votes from deleted users
- Deleting a user cascades appropriately (or prevents deletion)

---

## Frontend in Depth

### Structure: Single Page Application (SPA)

**index.html:** Contains 5 "views" that are shown/hidden
```html
<!-- Each view is a hidden div that gets shown when user navigates -->
<div class="view" id="homeView"><!-- Login/Register form --></div>
<div class="view" id="debatesView"><!-- Debate list --></div>
<div class="view" id="debateView"><!-- Single debate detail --></div>
<div class="view" id="createDebateView"><!-- Create debate form --></div>
<div class="view" id="profileView"><!-- User profile/stats --></div>
```

**Switching views is simple:**
```javascript
showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Show requested view
  document.getElementById(viewName + 'View').classList.add('active');
}
```

CSS handles the visibility:
```css
.view { display: none; }
.view.active { display: block; }
```

### app.js: The App Object

This single JavaScript object (`app`) controls everything:

```javascript
const app = {
  // STATE: Data about current session
  apiBase: 'http://localhost:5000',
  token: null,                    // JWT token from login
  currentUser: null,              // Logged-in user object
  currentDebate: null,            // Currently viewing debate
  currentDebateUsers: null,       // Creator and opponent info

  // INITIALIZATION
  async init() {
    // Check if tokenexists in localStorage
    this.token = localStorage.getItem('token');
    
    if (this.token) {
      try {
        // Try to load current user
        this.currentUser = await this.apiFetch('/auth/me');
        this.showView('debatesView');  // Go to main page
        this.loadDebates();
      } catch (err) {
        // Token invalid, clear and go to login
        localStorage.removeItem('token');
        this.token = null;
        this.showView('homeView');
      }
    } else {
      this.showView('homeView');  // Show login
    }
  },

  // UTILITIES
  getById(id) {
    return document.getElementById(id);
  },

  async apiFetch(path, options = {}) {
    // [See earlier explanation]
  },

  showView(viewName) {
    // [See earlier explanation]
  },

  escapeHtml(text) {
    // Prevent XSS attacks
    // <script> tags won't execute - they show as text
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  showMessage(viewId, message, type) {
    // Display success/error messages
  },

  // AUTH METHODS
  async register() { /* ... */ },
  async login() { /* ... */ },
  logout() { /* ... */ },

  // DEBATE METHODS
  async loadDebates() { /* List all debates */ },
  async createDebate(event) { /* Create new */ },
  async loadDebate(debateId) { /* Load single debate */ },

  // MESSAGE METHODS
  async loadMessages(debateId) { /* Get all messages */ },
  async postMessage() { /* Post new message */ },
  updateTurnIndicators() { /* Show whose turn it is */ },

  // VOTING METHODS
  async loadVotingSection() { /* Show voting UI */ },
  async vote(userId) { /* Cast vote */ },

  // PROFILE METHODS
  async loadProfile(userId) { /* Show user stats */ }
};

// Auto-run init when page loads
document.addEventListener('DOMContentLoaded', () => app.init());
```

### Key Frontend Patterns

**Pattern 1: Form Submission → API Call → UI Update**
```javascript
async submitForm(event) {
  event.preventDefault();
  
  const formData = {
    field1: this.getById('input1').value,
    field2: this.getById('input2').value
  };
  
  try {
    const response = await this.apiFetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    this.showMessage('Success!', 'success');
    this.loadData();  // Refresh UI
  } catch (err) {
    this.showMessage('Error: ' + err.message, 'error');
  }
}
```

**Pattern 2: Conditional Rendering**
```javascript
const isParticipant = [debate.creator_id, debate.opponent_id].includes(app.currentUser?.id);
document.getElementById('postMessageBtn').style.display = isParticipant ? 'block' : 'none';
```

**Pattern 3: Array Filtering**
```javascript
// Count votes for each debater
const debaterAVotes = votes.filter(v => v.voted_user_id === debate.creator_id).length;
const debaterBVotes = votes.filter(v => v.voted_user_id === debate.opponent_id).length;
```

---

## Backend Routes in Depth

All routes are in `server/routes/debates.js` (merged from messages, votes, users).

### Authentication Routes (`server/routes/auth.js`)

#### POST /api/auth/register
```javascript
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be 6+ characters' });
  }
  
  const passwordHash = bcrypt.hashSync(password, 10);  // Hash with salt factor 10
  
  db.run(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [username, passwordHash],
    (err) => {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
      }
      res.json({ message: 'Registered successfully. Login now.' });
    }
  );
});
```

**Security:** Password is hashed BEFORE storing. Never store plain text passwords.

#### POST /api/auth/login
```javascript
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Compare entered password with stored hash
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Create JWT token valid for 7 days
    const token = jwt.sign(
      { id: user.id, username: user.username, admin: user.admin },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { id: user.id, username: user.username } });
  });
});
```

**Token payload:** Contains user id, username, admin flag. Can be decoded (but not modified without secret).

#### GET /api/auth/me
```javascript
router.get('/me', authMiddleware, (req, res) => {
  // authMiddleware attached req.user
  res.json(req.user);
});
```

**Used by:** Frontend checks if token is valid on page load.

### Debate Routes - SECTION 1: CRUD

#### POST /api/debates
Create new debate invitation.

**Key logic:**
```javascript
// Check opponent_id isn't self
// Check no pending debate already exists with opponent
// INSERT into debates table
// For each tag: INSERT into tags, INSERT into debate_tags (junction)
```

#### GET /api/debates
List all debates (can filter by category/status).

**Query building:**
```javascript
let query = 'SELECT * FROM debates';
const params = [];

if (category) {
  query += ' WHERE category = ?';
  params.push(category);
}

if (status) {
  query += query.includes('WHERE') ? ' AND status = ?' : ' WHERE status = ?';
  params.push(status);
}

query += ' ORDER BY created_at DESC';

db.all(query, params, (err, debates) => {
  res.json(debates);
});
```

**Pattern:** Build query dynamically based on parameters.

#### GET /api/debates/:id
Get single debate and increment view counter.

**Two-step process:**
```javascript
// Step 1: Update view count
db.run('UPDATE debates SET views = views + 1 WHERE id = ?', [id], ...);

// Step 2: Fetch updated debate
db.get('SELECT * FROM debates WHERE id = ?', [id], ...);
```

#### POST /api/debates/:id/accept
Opponent accepts pending invitation.

**Validation:**
- User is opponent? (`debate.opponent_id === req.user.id`)
- Debate is pending? (`debate.status === 'pending'`)

**Update:**
```javascript
db.run('UPDATE debates SET status = ? WHERE id = ?', ['active', id], ...);
```

#### POST /api/debates/:id/end
Mark debate as finished (enables voting).

**Validation:**
- User is ender? (`debate.ender_id === req.user.id`)
- Debate is active? (`debate.status === 'active'`)

**Update:**
```javascript
db.run(
  'UPDATE debates SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?',
  ['finished', id],
  ...
);
```

#### DELETE /api/debates/:id
Delete debate (admin or creator only).

```javascript
if (!req.user.admin && debate.creator_id !== req.user.id) {
  return res.status(403).json({ error: 'Not authorized' });
}

db.run('DELETE FROM debates WHERE id = ?', [id], ...);
```

### Debate Routes - SECTION 2: Messages

#### POST /api/debates/messages
Post message in debate (auto-switches turn).

**Critical logic:**
```javascript
// 1. Validate it's user's turn
if (debate.current_turn !== req.user.id) {
  return res.status(403).json({ error: 'Not your turn' });
}

// 2. Insert message
db.run('INSERT INTO messages (...) VALUES (...)', ...);

// 3. Switch turn to opponent
const nextTurn = debate.current_turn === debate.opponent_id 
  ? debate.creator_id 
  : debate.opponent_id;

db.run('UPDATE debates SET current_turn = ? WHERE id = ?', [nextTurn, debate_id], ...);
```

**Important:** Turn is switched AFTER message is inserted, in the callback.

#### GET /api/debates/messages/:debate_id
Get all messages for debate (with usernames).

```javascript
db.all(
  'SELECT m.*, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.debate_id = ? ORDER BY m.created_at ASC',
  [debate_id],
  ...
);
```

**JOIN:** Fetches messages with username directly (instead of fetching separately).

### Debate Routes - SECTION 3: Voting

#### POST /api/debates/votes
Cast a vote on finished debate.

**Validations:**
```javascript
if (debate.status !== 'finished') {
  return res.status(400).json({ error: 'Can only vote on finished debates' });
}

// Participants cannot vote
if (req.user.id === debate.creator_id || req.user.id === debate.opponent_id) {
  return res.status(403).json({ error: 'Participants cannot vote' });
}

// Voted_user must be a participant
if (voted_user_id !== debate.creator_id && voted_user_id !== debate.opponent_id) {
  return res.status(400).json({ error: 'Invalid vote target' });
}
```

**Unique constraint prevents duplicate votes:**
```javascript
db.run(
  'INSERT INTO votes (debate_id, voter_id, voted_user_id) VALUES (?, ?, ?)',
  [debate_id, req.user.id, voted_user_id],
  (err) => {
    if (err && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'You already voted' });
    }
  }
);
```

Then calls `calculateAndSetWinner()` to recount votes.

#### THE WINNER CALCULATION LOGIC (MOST COMPLEX)

```javascript
function calculateAndSetWinner(debateId, callback) {
  // 1. Get current winner from database
  db.get('SELECT winner_id FROM debates WHERE id = ?', [debateId], (err, debate) => {
    
    // 2. Count votes for each participant
    db.all(
      'SELECT voted_user_id, COUNT(*) as count FROM votes WHERE debate_id = ? GROUP BY voted_user_id',
      [debateId],
      (voteErr, results) => {
        
        // 3. Determine new winner
        let winnerId = null;
        if (results.length === 1) {
          winnerId = results[0].voted_user_id;  // Only one person got votes
        } else if (results.length === 2) {
          if (results[0].count > results[1].count) {
            winnerId = results[0].voted_user_id;
          } else if (results[1].count > results[0].count) {
            winnerId = results[1].voted_user_id;
          }
          // If tie, winnerId stays null
        }
        
        // 4. IF WINNER CHANGED, adjust points
        if (debate.winner_id === winnerId) {
          // No change, skip
          if (callback) callback();
          return;
        }
        
        const tasks = [];
        
        // Remove point from old winner
        if (debate.winner_id && debate.winner_id !== winnerId) {
          tasks.push(cb => {
            db.run('UPDATE users SET points = points - 1 WHERE id = ?', [debate.winner_id], cb);
          });
        }
        
        // Award point to new winner
        if (winnerId) {
          tasks.push(cb => {
            db.run('UPDATE users SET points = points + 1 WHERE id = ?', [winnerId], cb);
          });
        }
        
        // Update debate with new winner
        db.run('UPDATE debates SET winner_id = ? WHERE id = ?', [winnerId, debateId], (updateErr) => {
          
          // Execute callbacks in parallel
          let remaining = tasks.length;
          tasks.forEach(task => {
            task(() => {
              remaining--;
              if (remaining === 0 && callback) callback();
            });
          });
        });
      }
    );
  });
}
```

**Why this complexity?**
- Prevents point duplication if same winner keeps winning
- Deducts points if winner changes (no exploits)
- Handles edge case where vote changes leader position

### Debate Routes - SECTION 4: User Profiles

#### GET /api/debates/users/:id
Get user profile with stats.

```javascript
// 1. Get user basic info
db.get('SELECT id, username, points, created_at FROM users WHERE id = ?', [id], (err, user) => {
  
  // 2. Get all debates for this user
  db.all(
    `SELECT id, status, winner_id FROM debates 
     WHERE (creator_id = ? OR opponent_id = ?) 
     ORDER BY created_at DESC`,
    [id, id],
    (err, debates) => {
      
      // 3. Calculate stats
      const rank = getRank(user.points);
      const debateCount = debates.length;
      const wonCount = debates.filter(d => d.winner_id === id && d.status === 'finished').length;
      
      // 4. Return combined data
      res.json({
        ...user,
        rank,
        debateCount,
        wonCount
      });
    }
  );
});

function getRank(points) {
  if (points <= 5) return 'Ny debattant';
  if (points <= 20) return 'Argumentator';
  return 'Retorikkmester';
}
```

---

## Authentication & Security

### How JWT Works

1. **User Logs In:**
   - Sends username + password
   - Server verifies credentials
   - Server creates JWT token:
     ```javascript
     const token = jwt.sign(
       { id: user.id, username: user.username, admin: user.admin },  // Payload
       'secret-key-only-server-knows',                                 // Secret
       { expiresIn: '7d' }                                              // Expires
     );
     ```

2. **Token Sent to Client:**
   ```json
   { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNjE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" }
   ```

3. **Client Stores Token:**
   ```javascript
   localStorage.setItem('token', token);
   ```

4. **Client Uses Token for Future Requests:**
   ```javascript
   headers: {
     'Authorization': `Bearer ${token}`
   }
   ```

5. **Server Validates Token:**
   ```javascript
   const decoded = jwt.verify(token, 'same-secret-key');
   // If tampering detected or expired: throws error
   // If valid: decoded contains original payload
   ```

### Why JWT is Secure

- Token can be READ but not MODIFIED without the secret
- If attacker changes payload, signature becomes invalid
- Server won't accept modified token
- Expires automatically (7 days)

### Security Practices Used

1. **Password Hashing (bcryptjs)**
   ```javascript
   const hash = bcrypt.hashSync(password, 10);  // 10 is salt rounds
   // Later: bcrypt.compareSync(enteredPassword, hash);  // True/False
   ```
   **Why:** Can't reverse-engineer password from hash.

2. **JWT Secret**
   ```javascript
   JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
   ```
   **Production:** Must be strong random string, never hardcoded.

3. **Input Validation**
   ```javascript
   if (!title || !category) {
     return res.status(400).json({ error: 'Missing fields' });
   }
   ```

4. **XSS Prevention (Frontend)**
   ```javascript
   escapeHtml(text) {
     const div = document.createElement('div');
     div.textContent = text;  // Treats as text, not HTML
     return div.innerHTML;
   }
   ```

5. **Role-based Access Control**
   ```javascript
   if (!req.user.admin && debate.creator_id !== req.user.id) {
     return res.status(403).json({ error: 'Not authorized' });
   }
   ```

---

## How to Implement Any Change

Your professor might ask: "Add a feature to..." Here's the universal process.

### Change Type 1: Add New Database Field

**Example: Add "difficulty" field to debates**

**Step 1: Update Schema (database.js)**
```javascript
db.run("ALTER TABLE debates ADD COLUMN difficulty TEXT DEFAULT 'medium'", (err) => {
  // Migration: if table exists but column doesn't, add it
});
```

**Step 2: Accept in Create Route (routes/debates.js)**
```javascript
const { title, category, opponent_id, starter_id, ender_id, tags, difficulty } = req.body;

db.run(
  `INSERT INTO debates 
  (title, category, creator_id, opponent_id, starter_id, ender_id, current_turn, status, difficulty) 
  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  [title, category, req.user.id, opponent_id, starter_id, ender_id, starter_id, difficulty || 'medium'],
  ...
);
```

**Step 3: Update Frontend Form (index.html)**
```html
<select id="debateDifficulty">
  <option value="easy">Easy</option>
  <option value="medium" selected>Medium</option>
  <option value="hard">Hard</option>
</select>
```

**Step 4: Extract in JavaScript (app.js)**
```javascript
const difficulty = this.getById('debateDifficulty').value;
// Include in API call
```

### Change Type 2: Add New API Endpoint

**Example: Add GET /api/debates/top-debaters**

**Step 1: Add Route (routes/debates.js)**
```javascript
// GET /api/debates/top-debaters - Get leaderboard
router.get('/top-debaters', (req, res) => {
  db.all(
    'SELECT id, username, points FROM users ORDER BY points DESC LIMIT 10',
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch' });
      }
      res.json(users);
    }
  );
});
```

**Step 2: Add Frontend Method (app.js)**
```javascript
async loadLeaderboard() {
  try {
    const users = await this.apiFetch('/debates/top-debaters');
    // Render users in UI
  } catch (err) {
    this.showMessage('Error: ' + err.message, 'error');
  }
}
```

### Change Type 3: Add Permission Check

**Example: Only ender can end debate**

```javascript
router.post('/:id/end', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM debates WHERE id = ?', [id], (err, debate) => {
    
    // ADD THIS CHECK
    if (debate.ender_id !== req.user.id) {
      return res.status(403).json({ error: 'Only ender can finish' });
    }
    
    // Process if check passes
  });
});
```

### Change Type 4: Add Input Validation

**Example: Title must be 5-200 characters**

```javascript
const title = req.body.title.trim();

if (title.length < 5 || title.length > 200) {
  return res.status(400).json({ error: 'Title must be 5-200 characters' });
}
```

### Change Type 5: Modify Data Before Storing

**Example: Auto-capitalize category**

```javascript
const category = req.body.category.trim().toUpperCase();
```

### Change Type 6: Add New Table/Relationship

**Example: Add favorites feature**

**Step 1: Create Table (database.js)**
```javascript
db.run(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    debate_id INTEGER NOT NULL,
    UNIQUE(user_id, debate_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (debate_id) REFERENCES debates(id)
  )
`);
```

**Step 2: Add Routes (routes/debates.js)**
```javascript
// Add favorite
router.post('/favorites/:debate_id', authMiddleware, (req, res) => {
  const { debate_id } = req.params;
  
  db.run(
    'INSERT INTO favorites (user_id, debate_id) VALUES (?, ?)',
    [req.user.id, debate_id],
    (err) => {
      if (err && err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Already favorited' });
      }
      res.json({ message: 'Added to favorites' });
    }
  );
});

// Get user's favorites
router.get('/favorites', authMiddleware, (req, res) => {
  db.all(
    `SELECT d.* FROM debates d INNER JOIN favorites f ON d.id = f.debate_id WHERE f.user_id = ?`,
    [req.user.id],
    (err, debates) => {
      res.json(debates);
    }
  );
});
```

---

## Common Patterns

### Pattern: Check Before Insert

```javascript
db.get('SELECT * FROM table WHERE condition', params, (err, result) => {
  if (result) {
    return res.status(400).json({ error: 'Already exists' });
  }
  
  // Safe to insert
  db.run('INSERT INTO table VALUES (...)', params, ...);
});
```

### Pattern: Update With Condition

```javascript
db.get('SELECT * FROM table WHERE id = ?', [id], (err, record) => {
  if (!record) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  if (record.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  db.run('UPDATE table SET field = ? WHERE id = ?', [newValue, id], ...);
});
```

### Pattern: JOIN for Related Data

```javascript
db.all(
  'SELECT m.*, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.debate_id = ?',
  [debate_id],
  (err, messages) => {
    // messages now have: m.id, m.content, u.username, etc.
  }
);
```

### Pattern: Nested Callbacks (Callback Hell)

```javascript
db.get('SELECT * FROM table1 WHERE id = ?', [id], (err, result1) => {
  if (!result1) return res.status(404).json({ error: 'Not found' });
  
  db.run('INSERT INTO table2 VALUES (?)', [result1.field], (err) => {
    
    db.get('SELECT * FROM table3 WHERE id = ?', [someId], (err, result3) => {
      
      res.json(result3);
    });
  });
});
```

**To improve:** Use helper functions to break nesting.

### Pattern: Error Handling

```javascript
try {
  // Frontend try-catch
  await this.apiFetch('/api/endpoint', options);
  this.showMessage('Success!', 'success');
} catch (err) {
  this.showMessage('Error: ' + err.message, 'error');
}
```

```javascript
// Backend error handling
if (!required_field) {
  return res.status(400).json({ error: 'Missing field' });  // Client error
}

if (!record) {
  return res.status(404).json({ error: 'Not found' });  // Not found
}

if (not_authorized) {
  return res.status(403).json({ error: 'Not authorized' });  // Permission denied
}

if (db_error) {
  return res.status(500).json({ error: 'Server error' });  // Server error
}
```

---

## File Reference Guide

### `server/config.js`
**Purpose:** Centralized configuration  
**Use when:** Adding new settings (new PORT, new SECRET, new DB path)  
**Key exports:** PORT, DB_PATH, JWT_SECRET, CORS_ORIGIN, ADMIN_USERNAME, ADMIN_PASSWORD

### `server/server.js`
**Purpose:** Express app setup and middleware  
**Use when:** Adding global middleware, new route mounts, error handling  
**Key parts:**
- `app.use()` - middleware
- `app.use('/api/route', routeFile)` - mount routes
- `app.listen()` - start server

### `server/database.js`
**Purpose:** SQLite connection and schema initialization  
**Use when:** Adding new tables, altering table columns, running migrations  
**Key function:** `initializeDatabase()` where all CREATE TABLE statements go

### `server/middleware/auth.js`
**Purpose:** JWT token validation  
**Use when:** Need to protect routes from unauthenticated users  
**Adds to request:** `req.user` object with id, username, admin flag

### `server/routes/auth.js`
**Purpose:** Authentication endpoints (register, login, me, search)  
**Endpoints:**
- POST /api/auth/register - Create account
- POST /api/auth/login - Get JWT token
- GET /api/auth/me - Get current user
- GET /api/auth/search - Find users by username

### `server/routes/debates.js`
**Purpose:** ALL debate-related API endpoints  
**Sections:**
- SECTION 1: Debate CRUD
- SECTION 2: Messages  
- SECTION 3: Voting
- SECTION 4: User Profiles

### `client/index.html`
**Purpose:** Page structure and HTML elements  
**Key parts:**
- 5 view divs (homeView, debatesView, debateView, createDebateView, profileView)
- Forms with ids (debateTitle, messageInput, etc.)
- Navbar with navigation

### `client/app.js`
**Purpose:** ALL JavaScript logic  
**Key object:** `app` with 30+ methods  
**Key functions:** apiFetch, showView, all business logic

### `client/styles.css`
**Purpose:** All styling  
**Key sections:**
- CSS variables (:root)
- Responsive layouts (@media)
- Accessibility (focus states, ARIA labels)

---

## Summary: What You Need to Know

1. **Architecture:** User → Frontend (HTML/JS) → Backend API → Database (SQLite)

2. **Frontend Flow:** User action → Event handler → apiFetch() → API call → Response → Update DOM

3. **Backend Flow:** Request → Middleware validation → Route handler → Database query → Response

4. **Database:** 7 tables with foreign keys ensuring data integrity

5. **Authentication:** JWT tokens stored on client, validated on server

6. **Security:** Passwords hashed, input validated, roles checked

7. **To add features:** Database → Backend route → Frontend HTML → Frontend JS method

This knowledge is enough to implement ANY change your professor asks for. The patterns are consistent throughout the codebase.

