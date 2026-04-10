const app = {
  apiBase: 'http://localhost:5000/api',
  token: localStorage.getItem('token'),
  currentUser: null,
  currentDebate: null,
  currentDebateUsers: null,

  async init() {
    if (!this.token) {
      this.showView('homeView');
      return;
    }

    try {
      this.currentUser = await this.apiFetch('/auth/me');
      this.goDebates();
    } catch (err) {
      this.logout();
    }
  },

  async apiFetch(path, options = {}) {
    const headers = options.headers || {};
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const response = await fetch(this.apiBase + path, { ...options, headers });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }
    if (!response.ok) {
      throw new Error(data?.error || response.statusText || 'Server error');
    }
    return data;
  },

  showView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    this.getById(viewName).classList.add('active');
    const visible = this.token ? 'inline' : 'none';
    this.getById('debatesNav').style.display = visible;
    this.getById('createNav').style.display = visible;
    this.getById('profileNav').style.display = visible;
    this.getById('logoutBtn').style.display = visible;
  },

  goHome() {
    this.showView('homeView');
  },

  goDebates() {
    this.showView('debatesView');
    this.loadDebates();
    this.loadPendingInvitations();
  },

  goCreateDebate() {
    if (!this.token) {
      this.showMessage('authMessage', 'Du må være logget inn', 'error');
      return;
    }
    this.showView('createDebateView');
  },

  goDebatte(debateId) {
    this.showView('debateView');
    this.loadDebate(debateId);
  },

  goProfile() {
    if (!this.currentUser) return;
    this.showView('profileView');
    this.loadProfile(this.currentUser.id);
  },

  async register() {
    const username = this.getById('username').value.trim();
    const password = this.getById('password').value;
    if (!username || !password) {
      this.showMessage('authMessage', 'Brukernavn og passord kreves', 'error');
      return;
    }
    try {
      await this.apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      this.showMessage('authMessage', 'Registrering vellykket! Logg inn nå.', 'success');
      this.getById('password').value = '';
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  async login() {
    const username = this.getById('username').value.trim();
    const password = this.getById('password').value;
    if (!username || !password) {
      this.showMessage('authMessage', 'Brukernavn og passord kreves', 'error');
      return;
    }
    try {
      const data = await this.apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('token', this.token);
      this.getById('username').value = '';
      this.getById('password').value = '';
      this.goDebates();
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('token');
    this.getById('username').value = '';
    this.getById('password').value = '';
    this.goHome();
  },

  async loadDebates() {
    try {
      const category = this.getById('categoryFilter')?.value || '';
      const status = this.getById('statusFilter')?.value || '';
      const params = [];
      if (category) params.push(`category=${category}`);
      if (status) params.push(`status=${status}`);
      const path = `/debates${params.length ? '?' + params.join('&') : ''}`;
      const debates = await this.apiFetch(path);
      this.renderDebatesList(debates);
    } catch (err) {
      console.error('Error loading debates:', err);
    }
  },

  renderDebatesList(debates) {
    const list = this.getById('debatesList');
    list.innerHTML = '';
    if (!debates.length) {
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
        <div style="margin-top: 0.75rem; font-size: 0.9rem; color: #666;">👁 ${debate.views} visninger</div>
      `;
      list.appendChild(card);
    });
  },

  applyFilters() {
    this.loadDebates();
    this.loadPendingInvitations();
  },

  async loadPendingInvitations() {
    if (!this.currentUser) return;
    try {
      const debates = await this.apiFetch('/debates');
      const pending = debates.filter(d => d.status === 'pending' && d.opponent_id === this.currentUser.id);
      this.renderPendingInvitations(pending);
    } catch (err) {
      console.error('Error loading pending invitations:', err);
    }
  },

  renderPendingInvitations(invitations) {
    const section = this.getById('pendingInvitationsSection');
    const list = this.getById('pendingInvitationsList');
    if (!invitations.length) {
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
        <p style="font-size: 0.9rem; color: #666; margin: 0.5rem 0;">Du er invitert av: <strong id="creator-${invitation.id}">...</strong></p>
        <div class="invitation-buttons" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button onclick="app.acceptInvitation(${invitation.id});" class="btn btn-primary" style="flex: 1;">Aksepter</button>
          <button onclick="app.rejectInvitation(${invitation.id});" class="btn btn-secondary" style="flex: 1;">Avslag</button>
        </div>
      `;
      list.appendChild(card);
      fetch(`${this.apiBase}/users/${invitation.creator_id}`)
        .then(res => res.json())
        .then(user => {
          const el = this.getById(`creator-${invitation.id}`);
          if (el) el.innerText = user.username;
        });
    });
  },

  async acceptInvitation(debateId) {
    try {
      await this.apiFetch(`/debates/${debateId}/accept`, { method: 'POST' });
      this.showMessage('authMessage', 'Invitasjon akseptert! Debatten starter nå.', 'success');
      this.loadDebates();
      this.loadPendingInvitations();
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  async rejectInvitation(debateId) {
    try {
      await this.apiFetch(`/debates/${debateId}/reject`, { method: 'POST' });
      this.showMessage('authMessage', 'Invitasjon avslått.', 'success');
      this.loadDebates();
      this.loadPendingInvitations();
    } catch (err) {
      this.showMessage('authMessage', err.message, 'error');
    }
  },

  async loadDebate(debateId) {
    try {
      this.currentDebate = await this.apiFetch(`/debates/${debateId}`);
      const [creator, opponent] = await Promise.all([
        this.apiFetch(`/debates/users/${this.currentDebate.creator_id}`),
        this.apiFetch(`/debates/users/${this.currentDebate.opponent_id}`)
      ]);
      this.currentDebateUsers = { creator, opponent };
      this.getById('debateTitle').innerText = this.currentDebate.title;
      this.getById('debateCategory').innerText = this.currentDebate.category;
      this.getById('debateStatus').innerText = this.currentDebate.status === 'active' ? '🟢 Aktiv' : '✅ Ferdig';
      this.getById('debateViews').innerText = this.currentDebate.views;
      this.getById('creatorName').innerText = creator.username;
      this.getById('opponentName').innerText = opponent.username;
      this.updateTurnIndicators();
      await this.loadMessages(debateId);
      const isParticipant = [this.currentDebate.creator_id, this.currentDebate.opponent_id].includes(this.currentUser?.id);
      const isUserTurn = this.currentDebate.current_turn === this.currentUser?.id;
      this.getById('messageInputBox').style.display = this.currentDebate.status === 'active' && isParticipant && isUserTurn ? 'flex' : 'none';
      this.getById('endDebateBox').style.display = this.currentDebate.status === 'active' && this.currentDebate.ender_id === this.currentUser?.id ? 'block' : 'none';
      this.getById('adminDeleteBox').style.display = this.currentUser?.admin ? 'block' : 'none';
      this.getById('votingSection').style.display = this.currentDebate.status === 'finished' ? 'block' : 'none';
      if (this.currentDebate.status === 'finished') {
        await this.loadVotingSection();
      } else {
        this.getById('resultsSection').style.display = 'none';
      }
    } catch (err) {
      console.error('Error loading debate:', err);
    }
  },

  updateTurnIndicators() {
    const active = this.currentDebate.status === 'active';
    const creatorTurn = this.currentDebate.current_turn === this.currentDebate.creator_id;
    this.getById('creatorTurn').style.display = active && creatorTurn ? 'block' : 'none';
    this.getById('creatorWaiting').style.display = active && !creatorTurn ? 'block' : 'none';
    this.getById('opponentTurn').style.display = active && !creatorTurn ? 'block' : 'none';
    this.getById('opponentWaiting').style.display = active && creatorTurn ? 'block' : 'none';
  },

  async loadMessages(debateId) {
    try {
      const messages = await this.apiFetch(`/debates/messages/${debateId}`);
      const box = this.getById('messagesBox');
      box.innerHTML = '';
      if (!messages.length) {
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
      box.scrollTop = box.scrollHeight;
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  },

  async postMessage() {
    const content = this.getById('messageInput').value.trim();
    if (!content) return alert('Skriv noe innlegg');
    try {
      await this.apiFetch('/debates/messages', { method: 'POST', body: JSON.stringify({ debate_id: this.currentDebate.id, content }) });
      this.getById('messageInput').value = '';
      this.loadDebate(this.currentDebate.id);
    } catch (err) {
      alert('Feil: ' + err.message);
    }
  },

  async createDebate(event) {
    event.preventDefault();
    const title = this.getById('debateTitle').value.trim();
    const category = this.getById('debateCategory').value;
    const tags = this.getById('debateTags').value.split(',').map(tag => tag.trim()).filter(Boolean);
    const opponentId = this.getById('opponentId').value;
    const starter = this.getById('starterSelect').value;
    const ender = this.getById('enderSelect').value;
    if (!title || !category || !opponentId || !starter || !ender) {
      return this.showMessage('createMessage', 'Fyll ut alle feltene før du oppretter.', 'error');
    }
    const opponent = parseInt(opponentId, 10);
    const starterId = starter === 'me' ? this.currentUser.id : opponent;
    const enderId = ender === 'me' ? this.currentUser.id : opponent;
    try {
      await this.apiFetch('/debates', { method: 'POST', body: JSON.stringify({ title, category, opponent_id: opponent, starter_id: starterId, ender_id: enderId, tags }) });
      this.showMessage('createMessage', 'Debatt opprettet!', 'success');
      this.getById('debateTitle').value = '';
      this.getById('debateCategory').value = '';
      this.getById('debateTags').value = '';
      this.getById('opponentSearch').value = '';
      this.getById('opponentId').value = '';
      this.getById('selectedOpponent').style.display = 'none';
      this.getById('starterSelect').value = '';
      this.getById('enderSelect').value = '';
      setTimeout(() => this.goDebates(), 1000);
    } catch (err) {
      this.showMessage('createMessage', 'Feil: ' + err.message, 'error');
    }
  },

  async searchOpponents() {
    const query = this.getById('opponentSearch').value.trim();
    const resultsDiv = this.getById('opponentSearchResults');
    if (query.length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }
    try {
      const users = await this.apiFetch(`/auth/search?username=${encodeURIComponent(query)}`);
      resultsDiv.innerHTML = '';
      if (!users.length) {
        resultsDiv.innerHTML = '<div style="padding: 0.75rem 1rem; color: #666;">Ingen brukere funnet</div>';
        resultsDiv.style.display = 'block';
        return;
      }
      users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<span class="username">${this.escapeHtml(user.username)}</span><span class="points">(${user.points} poeng)</span>`;
        item.onclick = () => this.selectOpponent(user.id, user.username);
        resultsDiv.appendChild(item);
      });
      resultsDiv.style.display = 'block';
    } catch (err) {
      console.error('Error searching opponents:', err);
    }
  },

  selectOpponent(userId, username) {
    this.getById('opponentId').value = userId;
    this.getById('opponentSearch').value = username;
    this.getById('opponentSearchResults').style.display = 'none';
    this.getById('selectedOpponentName').innerText = username;
    this.getById('selectedOpponent').style.display = 'block';
  },

  async endDebate() {
    if (!confirm('Er du sikker på at du vil avslutte debatten?')) return;
    try {
      await this.apiFetch(`/debates/${this.currentDebate.id}/end`, { method: 'POST' });
      this.loadDebate(this.currentDebate.id);
    } catch (err) {
      alert('Feil: ' + err.message);
    }
  },

  async deleteDebate() {
    if (!confirm('Er du sikker på at du vil slette denne debatten? Dette kan ikke angres.')) return;
    try {
      await this.apiFetch(`/debates/${this.currentDebate.id}`, { method: 'DELETE' });
      this.showMessage('authMessage', 'Debatt slettet', 'success');
      this.goDebates();
    } catch (err) {
      this.showMessage('authMessage', 'Feil: ' + err.message, 'error');
    }
  },

  async loadVotingSection() {
    try {
      const votes = await this.apiFetch(`/debates/votes/${this.currentDebate.id}`);
      const creator = this.currentDebateUsers.creator;
      const opponent = this.currentDebateUsers.opponent;
      const creatorVotes = votes.filter(v => v.voted_user_id === this.currentDebate.creator_id).length;
      const opponentVotes = votes.filter(v => v.voted_user_id === this.currentDebate.opponent_id).length;
      const totalVotes = creatorVotes + opponentVotes;
      const isParticipant = [this.currentDebate.creator_id, this.currentDebate.opponent_id].includes(this.currentUser?.id);
      const hasVoted = votes.some(v => v.voter_id === this.currentUser?.id);

      this.getById('voteCreatorBtn').innerText = `Stem på ${creator.username}`;
      this.getById('voteOpponentBtn').innerText = `Stem på ${opponent.username}`;
      this.getById('votingSection').style.display = isParticipant ? 'none' : 'block';
      this.getById('votedMessage').style.display = hasVoted ? 'block' : 'none';

      this.getById('resultsSection').style.display = 'block';
      const winnerText = this.getById('winnerText');
      if (creatorVotes > opponentVotes) winnerText.innerText = `🏆 ${creator.username} vant debatten!`;
      else if (opponentVotes > creatorVotes) winnerText.innerText = `🏆 ${opponent.username} vant debatten!`;
      else if (totalVotes === 0) winnerText.innerText = 'Vent på stemmer...';
      else winnerText.innerText = 'Debatten ender uavgjort!';

      this.getById('voteStats').innerHTML = `
        <div class="vote-stat">
          <div class="name">${creator.username}</div>
          <span class="count">${creatorVotes}</span>
          <div class="vote-bar"><div class="vote-fill" style="width: ${totalVotes ? (creatorVotes / totalVotes) * 100 : 0}%"></div></div>
        </div>
        <div class="vote-stat">
          <div class="name">${opponent.username}</div>
          <span class="count">${opponentVotes}</span>
          <div class="vote-bar"><div class="vote-fill" style="width: ${totalVotes ? (opponentVotes / totalVotes) * 100 : 0}%"></div></div>
        </div>
      `;
    } catch (err) {
      console.error('Error loading voting section:', err);
    }
  },

  async vote(userId) {
    try {
      await this.apiFetch('/debates/votes', { method: 'POST', body: JSON.stringify({ debate_id: this.currentDebate.id, voted_user_id: userId }) });
      this.getById('votedMessage').style.display = 'block';
      this.loadVotingSection();
    } catch (err) {
      alert('Feil: ' + err.message);
    }
  },

  async loadProfile(userId) {
    try {
      const user = await this.apiFetch(`/debates/users/${userId}`);
      this.getById('profileUsername').innerText = user.username;
      this.getById('profilePoints').innerText = user.points;
      this.getById('profileRank').innerText = user.rank;
      this.getById('profileDebateCount').innerText = user.debateCount;
      this.getById('profileWonCount').innerText = user.wonCount;
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  },

  showMessage(elementId, message, type) {
    const el = this.getById(elementId);
    el.innerText = message;
    el.className = `message show ${type}`;
    setTimeout(() => el.classList.remove('show'), 5000);
  },

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  },

  getById(id) {
    return document.getElementById(id);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});