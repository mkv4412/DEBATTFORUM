// Global App Object: Main application state and methods for forum functionality.
// Modify apiBase to connect to different server URL or port.
const app = {
  apiBase: 'http://localhost:5000/api',
  token: localStorage.getItem('token') || null,
  currentUser: null,
  currentDebate: null,

  // Initialize app: Loads current user and shows debates if authenticated.
  // Call during DOMContentLoaded to initialize on page load.
  init() {
    if (this.token) {
      this.getCurrentUser();
      this.goDebates();
    }
  },

  // Switch views: Hides all views except specified one and updates navbar visibility based on auth.
  // To add new view, create new div with class 'view' and pass its id to this method.
  showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewName).classList.add('active');

    // Update navbar
    document.getElementById('debatesNav').style.display = this.token ? 'inline' : 'none';
    document.getElementById('createNav').style.display = this.token ? 'inline' : 'none';
    document.getElementById('profileNav').style.display = this.token ? 'inline' : 'none';
    document.getElementById('logoutBtn').style.display = this.token ? 'inline' : 'none';
  },

  // Go home: Switches to home/login view.
  // Call when user wants to return to login screen.
  goHome() {
    this.showView('homeView');
  },

  // Go debates: Switches to debates list and loads debates with pending invitations.
  // Call after login or when user clicks Debatter in navbar.
  goDebates() {
    this.showView('debatesView');
    this.loadDebates();
    this.loadPendingInvitations();
  },

  // Create debate view: Switches to debate creation form, requires authentication.
  // Modify form validation or debate fields by editing validateCreateDebateForm().
  goCreateDebate() {
    if (!this.token) {
      this.showMessage('authMessage', 'Du må være logget inn', 'error');
      return;
    }
    this.showView('createDebateView');
  },

  // Go to debate: Switches to single debate view and loads all debate details.
  // Called when users click debate card in debates list.
  goDebatte(debateId) {
    this.showView('debateView');
    this.loadDebate(debateId);
  },

  // Go profile: Switches to user profile view and loads current user's stats.
  // Add additional profile sections by extending loadProfile() function.
  goProfile() {
    if (!this.currentUser) return;
    this.showView('profileView');
    this.loadProfile(this.currentUser.id);
  },

  // Authentication
  // Register: Creates new user account with validation, then clears password field.
  // Add email field or password confirmation by extending username/password validation.
  async register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
      this.showMessage('authMessage', 'Brukernavn og passord kreves', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registrering mislyktes');
      }

      this.showMessage('authMessage', 'Registrering vellykket! Logg inn nå.', 'success');
      document.getElementById('password').value = '';
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  // Login: Authenticates user with credentials, stores JWT token, and transitions to debates view.
  // Token is saved to localStorage and used in subsequent API requests via authMiddleware.
  async login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
      this.showMessage('authMessage', 'Brukernavn og passord kreves', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Innlogging mislyktes');
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('token', this.token);

      document.getElementById('username').value = '';
      document.getElementById('password').value = '';

      this.goDebates();
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  // Logout: Clears token, user data, form fields, and returns to home view.
  // Call when user clicks logout button in navbar.
  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('token');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    this.goHome();
  },

  // Get current user: Fetches authenticated user profile data using stored token.
  // Updates this.currentUser with username and points; fails silently if not authenticated.
  async getCurrentUser() {
    if (!this.token) return;

    try {
      const response = await fetch(`${this.apiBase}/auth/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (response.ok) {
        this.currentUser = await response.json();
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  },

  // Debates
  // Load debates: Fetches debate list from API with optional category and status filters.
  // Filters are read from select elements; add new filter selects to extend functionality.
  async loadDebates() {
    try {
      const category = document.getElementById('categoryFilter')?.value || '';
      const status = document.getElementById('statusFilter')?.value || '';

      let url = `${this.apiBase}/debates`;
      const params = [];
      if (category) params.push(`category=${category}`);
      if (status) params.push(`status=${status}`);
      if (params.length) url += '?' + params.join('&');

      const response = await fetch(url);
      const debates = await response.json();

      this.renderDebatesList(debates);
    } catch (err) {
      console.error('Error loading debates:', err);
    }
  },

  // Render debates list: Displays fetched debates as clickable cards with title, category, and views.
  // Modify card layout or add additional debate info by editing the card.innerHTML template.
  renderDebatesList(debates) {
    const list = document.getElementById('debatesList');
    list.innerHTML = '';

    if (debates.length === 0) {
      list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Ingen debatter funnet</p>';
      return;
    }

    debates.forEach(debate => {
      const card = document.createElement('div');
      card.className = 'debate-card';
      card.onclick = () => this.goDebatte(debate.id);

      card.innerHTML = `
        <h3>${this.escapeHtml(debate.title)}</h3>
        <div class="debate-info">
          <span class="category">${this.escapeHtml(debate.category)}</span>
          <span class="status ${debate.status}">${debate.status === 'active' ? 'Aktiv' : 'Ferdig'}</span>
        </div>
        <div style="margin-top: 0.75rem; font-size: 0.9rem; color: #666;">
          👁 ${debate.views} visninger
        </div>
      `;

      list.appendChild(card);
    });
  },

  // Apply filters: Reloads both debates list and pending invitations when filters change.
  // Call when user changes category or status filter dropdowns.
  applyFilters() {
    this.loadDebates();
    this.loadPendingInvitations();
  },

  // Load pending invitations: Fetches all debates and filters for those pending for current user.
  // Displayed separately from main debate list in 'pendingInvitationsSection'.
  async loadPendingInvitations() {
    try {
      const response = await fetch(`${this.apiBase}/debates`);
      const allDebates = await response.json();

      // Filter for pending debates where current user is the opponent
      const pendingInvitations = allDebates.filter(debate => 
        debate.status === 'pending' && debate.opponent_id === this.currentUser?.id
      );

      this.renderPendingInvitations(pendingInvitations);
    } catch (err) {
      console.error('Error loading pending invitations:', err);
    }
  },

  // Render pending invitations: Shows debate cards with accept/reject buttons and creator names.
  // Creator names are fetched individually per invitation via separate API call.
  renderPendingInvitations(invitations) {
    const section = document.getElementById('pendingInvitationsSection');
    const list = document.getElementById('pendingInvitationsList');

    if (invitations.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    invitations.forEach(invitation => {
      const card = document.createElement('div');
      card.className = 'debate-card invitation-card';

      card.innerHTML = `
        <h3>${this.escapeHtml(invitation.title)}</h3>
        <div class="debate-info">
          <span class="category">${this.escapeHtml(invitation.category)}</span>
          <span class="status pending">Ventet</span>
        </div>
        <p style="font-size: 0.9rem; color: #666; margin: 0.5rem 0;">
          Du er invitert av: <strong id="creator-${invitation.id}">...</strong>
        </p>
        <div class="invitation-buttons" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button onclick="app.acceptInvitation(${invitation.id});" class="btn btn-primary" style="flex: 1;">Aksepter</button>
          <button onclick="app.rejectInvitation(${invitation.id});" class="btn btn-secondary" style="flex: 1;">Avslag</button>
        </div>
      `;

      list.appendChild(card);

      // Load creator name
      fetch(`${this.apiBase}/users/${invitation.creator_id}`)
        .then(r => r.json())
        .then(user => {
          const el = document.getElementById(`creator-${invitation.id}`);
          if (el) el.innerText = user.username;
        });
    });
  },

  // Accept invitation: Submits acceptance to backend, which changes debate status to 'active'.
  // Call when user clicks Aksepter on pending invitation card.
  async acceptInvitation(debateId) {
    try {
      const response = await fetch(`${this.apiBase}/debates/${debateId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Aksept mislyktes');
      }

      this.showMessage('authMessage', 'Invitasjon akseptert! Debatten starter nå.', 'success');
      this.loadDebates();
      this.loadPendingInvitations();
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  // Reject invitation: Deletes debate record from database.
  // Call when user clicks Avslag on pending invitation card.
  async rejectInvitation(debateId) {
    try {
      const response = await fetch(`${this.apiBase}/debates/${debateId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Avslag mislyktes');
      }

      this.showMessage('authMessage', 'Invitasjon avslått.', 'success');
      this.loadDebates();
      this.loadPendingInvitations();
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  // Load debate: Fetches debate details, participants, messages, and displays UI based on debate status.
  // Handles showing/hiding message input box, end button, and voting section based on user role.
  async loadDebate(debateId) {
    try {
      const response = await fetch(`${this.apiBase}/debates/${debateId}`);
      this.currentDebate = await response.json();

      // Load debate details
      document.getElementById('debateTitle').innerText = this.currentDebate.title;
      document.getElementById('debateCategory').innerText = this.currentDebate.category;
      document.getElementById('debateStatus').innerText = 
        this.currentDebate.status === 'active' ? '🟢 Aktiv' : '✅ Ferdig';
      document.getElementById('debateViews').innerText = this.currentDebate.views;

      // Load participants
      const creatorResp = await fetch(`${this.apiBase}/users/${this.currentDebate.creator_id}`);
      const opponentResp = await fetch(`${this.apiBase}/users/${this.currentDebate.opponent_id}`);
      const creator = await creatorResp.json();
      const opponent = await opponentResp.json();

      document.getElementById('creatorName').innerText = creator.username;
      document.getElementById('opponentName').innerText = opponent.username;

      // Update turn indicators
      this.updateTurnIndicators();

      // Load messages
      await this.loadMessages(debateId);

      // Show message input if user's turn and active
      const isUserTurn = this.currentDebate.current_turn === this.currentUser?.id;
      const isParticipant = this.currentDebate.creator_id === this.currentUser?.id ||
        this.currentDebate.opponent_id === this.currentUser?.id;
      
      document.getElementById('messageInputBox').style.display =
        (isUserTurn && isParticipant && this.currentDebate.status === 'active') ? 'flex' : 'none';

      // Show end debate button if user is ender
      document.getElementById('endDebateBox').style.display =
        (this.currentDebate.ender_id === this.currentUser?.id && this.currentDebate.status === 'active') ? 'block' : 'none';

      // Show admin delete button for admin user regardless of dispute owner
      document.getElementById('adminDeleteBox').style.display =
        (this.currentUser?.admin) ? 'block' : 'none';

      // Show voting if finished
      if (this.currentDebate.status === 'finished') {
        await this.loadVotingSection();
      }

    } catch (err) {
      console.error('Error loading debate:', err);
    }
  },

  // Update turn indicators: Displays turn status (🟢 Din tur or ⏳ Venter) for each participant.
  // Called after loading debate to reflect current turn state.
  updateTurnIndicators() {
    const isCreatorTurn = this.currentDebate.current_turn === this.currentDebate.creator_id;

    document.getElementById('creatorTurn').style.display =
      isCreatorTurn && this.currentDebate.status === 'active' ? 'block' : 'none';
    document.getElementById('creatorWaiting').style.display =
      !isCreatorTurn && this.currentDebate.status === 'active' ? 'block' : 'none';

    document.getElementById('opponentTurn').style.display =
      !isCreatorTurn && this.currentDebate.status === 'active' ? 'block' : 'none';
    document.getElementById('opponentWaiting').style.display =
      isCreatorTurn && this.currentDebate.status === 'active' ? 'block' : 'none';
  },

  // Load messages: Fetches all messages for debate and displays them with usernames and timestamps.
  // Auto-scrolls to bottom after rendering messages.
  async loadMessages(debateId) {
    try {
      const response = await fetch(`${this.apiBase}/messages/debate/${debateId}`);
      const messages = await response.json();

      const box = document.getElementById('messagesBox');
      box.innerHTML = '';

      if (messages.length === 0) {
        box.innerHTML = '<p style="text-align: center; color: #999;">Ingen meldinger ennå</p>';
        return;
      }

      messages.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = 'message-box';
        msgEl.innerHTML = `
          <div class="username">${this.escapeHtml(msg.username)}</div>
          <div class="content">${this.escapeHtml(msg.content)}</div>
          <div class="timestamp">${new Date(msg.created_at).toLocaleString('no-NO')}</div>
        `;
        box.appendChild(msgEl);
      });

      // Auto scroll to bottom
      box.scrollTop = box.scrollHeight;
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  },

  // Post message: Validates input, sends message to API, and refreshes debate view.
  // Only available when it's user's turn and debate is active.
  async postMessage() {
    const content = document.getElementById('messageInput').value;

    if (!content.trim()) {
      alert('Skriv noe innlegg');
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          debate_id: this.currentDebate.id,
          content
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Feil ved posting');
      }

      document.getElementById('messageInput').value = '';
      
      // Reload debate to update turn and messages
      this.loadDebate(this.currentDebate.id);
    } catch (err) {
      alert('Feil: ' + err.message);
    }
  },

  // Validate create debate form: Checks all required fields and marks missing ones invalid.
  // Returns object with hasErrors flag and array of missing field names.
  validateCreateDebateForm() {
    const fields = [
      { id: 'debateTitle', name: 'Tittel' },
      { id: 'debateCategory', name: 'Kategori' },
      { id: 'opponentSearch', name: 'Motstander' },
      { id: 'starterSelect', name: 'Hvem starter' },
      { id: 'enderSelect', name: 'Hvem avslutter' }
    ];

    let hasErrors = false;
    const errors = [];

    fields.forEach(field => {
      const element = document.getElementById(field.id);
      const formGroup = element.closest('.form-group');
      const value = element.value.trim();

      if (!value) {
        formGroup.classList.add('invalid');
        errors.push(field.name);
        hasErrors = true;
      } else {
        formGroup.classList.remove('invalid');
      }
    });

    return { hasErrors, errors };
  },

  // Create debate: Validates form, sends debate creation request, and redirects to debates list.
  // Debate tags are split from comma-separated input and sent as array.
  async createDebate(event) {
    event.preventDefault();

    // Validate form
    const validation = this.validateCreateDebateForm();
    if (validation.hasErrors) {
      this.showMessage('createMessage', `Manglende felt: ${validation.errors.join(', ')}`, 'error');
      return;
    }

    const title = document.getElementById('debateTitle').value;
    const category = document.getElementById('debateCategory').value;
    const tags = document.getElementById('debateTags').value
      .split(',')
      .map(t => t.trim())
      .filter(t => t);
    const opponentId = document.getElementById('opponentId').value;
    const starter = document.getElementById('starterSelect').value;
    const ender = document.getElementById('enderSelect').value;

    try {
      const starterId = starter === 'me' ? this.currentUser.id : parseInt(opponentId);
      const enderId = ender === 'me' ? this.currentUser.id : parseInt(opponentId);

      const response = await fetch(`${this.apiBase}/debates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          title,
          category,
          opponent_id: parseInt(opponentId),
          starter_id: starterId,
          ender_id: enderId,
          tags
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Feil ved opprettelse');
      }

      this.showMessage('createMessage', 'Debatt opprettet!', 'success');
      document.querySelector('.debate-form').reset();
      document.getElementById('opponentId').value = '';
      document.getElementById('selectedOpponent').style.display = 'none';
      document.querySelectorAll('.debate-form .form-group').forEach(fg => fg.classList.remove('invalid'));
      
      setTimeout(() => this.goDebates(), 1500);
    } catch (err) {
      this.showMessage('createMessage', 'Feil: ' + err.message, 'error');
    }
  },

  // Search opponents: Queries users by username and displays results as clickable list.
  // Requires minimum 2 characters; limit 10 results returned by API.
  async searchOpponents() {
    const query = document.getElementById('opponentSearch').value;
    const resultsDiv = document.getElementById('opponentSearchResults');

    if (query.length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/search?username=${encodeURIComponent(query)}`);
      const users = await response.json();

      resultsDiv.innerHTML = '';

      if (users.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 0.75rem 1rem; color: #666;">Ingen brukere funnet</div>';
        resultsDiv.style.display = 'block';
        return;
      }

      users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <span class="username">${this.escapeHtml(user.username)}</span>
          <span class="points">(${user.points} poeng)</span>
        `;
        item.onclick = () => this.selectOpponent(user.id, user.username);
        resultsDiv.appendChild(item);
      });

      resultsDiv.style.display = 'block';
    } catch (err) {
      console.error('Error searching opponents:', err);
    }
  },

  // Select opponent: Populates opponent ID and name fields, hides search results.
  // Called when user clicks opponent result card.
  selectOpponent(userId, username) {
    document.getElementById('opponentId').value = userId;
    document.getElementById('opponentSearch').value = username;
    document.getElementById('opponentSearchResults').style.display = 'none';
    document.getElementById('selectedOpponentName').innerText = username;
    document.getElementById('selectedOpponent').style.display = 'block';
  },

  // End debate: Asks confirmation then marks debate as finished, enabling voting phase.
  // Only ender_id user can call this endpoint.
  async endDebate() {
    if (!confirm('Er du sikker på at du vil avslutte debatten?')) return;

    try {
      const response = await fetch(`${this.apiBase}/debates/${this.currentDebate.id}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (!response.ok) {
        throw new Error('Feil ved avslutting');
      }

      this.loadDebate(this.currentDebate.id);
    } catch (err) {
      alert('Feil: ' + err.message);
    }
  },

  // Admin delete debate: Allows admin to delete arbitrary debate
  async deleteDebate() {
    if (!confirm('Er du sikker på at du vil slette denne debatten? Dette kan ikke angres.')) return;

    try {
      const response = await fetch(`${this.apiBase}/debates/${this.currentDebate.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sletting mislyktes');
      }

      this.showMessage('authMessage', 'Debatt slettet', 'success');
      this.goDebates();
    } catch (err) {
      this.showMessage('authMessage', 'Feil: ' + err.message, 'error');
    }
  },

  // Voting
  // Load voting section: Displays voting buttons for non-participants or results for participants.
  // Fetches participant names and initializes vote buttons with their names.
  async loadVotingSection() {
    try {
      const isParticipant = this.currentDebate.creator_id === this.currentUser?.id ||
        this.currentDebate.opponent_id === this.currentUser?.id;

      if (isParticipant) {
        document.getElementById('votingSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';
      } else {
        document.getElementById('votingSection').style.display = 'block';
      }

      // Get creator and opponent names
      const creatorResp = await fetch(`${this.apiBase}/users/${this.currentDebate.creator_id}`);
      const opponentResp = await fetch(`${this.apiBase}/users/${this.currentDebate.opponent_id}`);
      const creator = await creatorResp.json();
      const opponent = await opponentResp.json();

      document.getElementById('voteCreatorBtn').innerText = `Stem på ${creator.username}`;
      document.getElementById('voteCreatorBtn').dataset.userId = this.currentDebate.creator_id;
      document.getElementById('voteOpponentBtn').innerText = `Stem på ${opponent.username}`;
      document.getElementById('voteOpponentBtn').dataset.userId = this.currentDebate.opponent_id;

      // Load results
      await this.loadDebateResults();
    } catch (err) {
      console.error('Error loading voting section:', err);
    }
  },

  // Vote: Submits vote for user, prevents duplicate voting via UNIQUE constraint.
  // Updates results display after vote submission.
  async vote(userId) {
    try {
      const response = await fetch(`${this.apiBase}/votes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          debate_id: this.currentDebate.id,
          voted_user_id: userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Stemming mislyktes');
      }

      document.getElementById('votedMessage').style.display = 'block';
      document.getElementById('votingSection').style.display = 'none';
      
      // Reload results
      this.loadDebateResults();
    } catch (err) {
      alert('Feil: ' + err.message);
    }
  },

  // Load debate results: Fetches votes and displays vote counts with winner determination.
  // Shows different message for no votes, tied votes, or clear winner.
  async loadDebateResults() {
    try {
      const response = await fetch(`${this.apiBase}/votes/debate/${this.currentDebate.id}`);
      const votes = await response.json() || [];

      const creatorVotes = votes.filter(v => v.voted_user_id === this.currentDebate.creator_id).length;
      const opponentVotes = votes.filter(v => v.voted_user_id === this.currentDebate.opponent_id).length;
      const totalVotes = creatorVotes + opponentVotes;

      // Get names
      const creatorResp = await fetch(`${this.apiBase}/users/${this.currentDebate.creator_id}`);
      const opponentResp = await fetch(`${this.apiBase}/users/${this.currentDebate.opponent_id}`);
      const creator = await creatorResp.json();
      const opponent = await opponentResp.json();

      let winner = null;
      if (creatorVotes > opponentVotes) winner = creator.username;
      if (opponentVotes > creatorVotes) winner = opponent.username;

      const winnerText = document.getElementById('winnerText');
      if (winner) {
        winnerText.innerText = `🏆 ${winner} vant debatten!`;
      } else if (totalVotes === 0) {
        winnerText.innerText = 'Vent på stemmer...';
      } else {
        winnerText.innerText = 'Debatten ender uavgjort!';
      }

      const statsHtml = `
        <div class="vote-stat">
          <div class="name">${creator.username}</div>
          <span class="count">${creatorVotes}</span>
          <div class="vote-bar">
            <div class="vote-fill" style="width: ${totalVotes ? (creatorVotes / totalVotes * 100) : 0}%"></div>
          </div>
        </div>
        <div class="vote-stat">
          <div class="name">${opponent.username}</div>
          <span class="count">${opponentVotes}</span>
          <div class="vote-bar">
            <div class="vote-fill" style="width: ${totalVotes ? (opponentVotes / totalVotes * 100) : 0}%"></div>
          </div>
        </div>
      `;

      document.getElementById('voteStats').innerHTML = statsHtml;
      document.getElementById('resultsSection').style.display = 'block';
    } catch (err) {
      console.error('Error loading results:', err);
    }
  },

  // Profile
  // Load profile: Fetches user data, points, rank, and debate statistics.
  // Add new profile sections by extending response with additional user query.
  async loadProfile(userId) {
    try {
      const response = await fetch(`${this.apiBase}/users/${userId}`);
      const user = await response.json();

      document.getElementById('profileUsername').innerText = user.username;
      document.getElementById('profilePoints').innerText = user.points;
      document.getElementById('profileRank').innerText = user.rank;
      document.getElementById('profileDebateCount').innerText = user.debateCount;
      document.getElementById('profileWonCount').innerText = user.wonCount;
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  },

  // Utilities
  // Show message: Displays temporary message (success or error) in specified element.
  // Message auto-hides after 5 seconds; type can be 'success' or 'error'.
  showMessage(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.innerText = message;
    el.className = `message show ${type}`;
    
    setTimeout(() => {
      el.classList.remove('show');
    }, 5000);
  },

  // Escape HTML: Prevents XSS attacks by converting HTML characters to entities.
  // Use this when inserting user-supplied text into DOM via innerHTML.
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  },

  // Init form validation: Adds listeners to form fields to remove invalid styling when corrected.
  // Call during DOMContentLoaded to enable real-time validation feedback.
  initFormValidation() {
    const formFields = [
      'debateTitle',
      'debateCategory',
      'opponentSearch',
      'starterSelect',
      'enderSelect'
    ];

    formFields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.addEventListener('input', () => {
          const formGroup = element.closest('.form-group');
          if (element.value.trim()) {
            formGroup.classList.remove('invalid');
          }
        });

        element.addEventListener('change', () => {
          const formGroup = element.closest('.form-group');
          if (element.value.trim()) {
            formGroup.classList.remove('invalid');
          }
        });
      }
    });
  }
};

// Initialize on page load: Calls app.init() to check authentication and init form validation.
// This code runs automatically when HTML DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
  app.init();
  app.initFormValidation();
});
