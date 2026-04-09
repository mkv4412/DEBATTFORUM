// Initialize Express server with CORS, JSON parsing, and static file serving from client folder.
// To modify port, change process.env.PORT or the 5000 default.
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const authRoutes = require('./routes/auth');
const debateRoutes = require('./routes/debates');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware: Enable cross-origin requests, JSON body parsing, and static file serving.
// Add more middleware here to modify request/response handling globally.
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Routes: Mount all API route handlers on their respective paths.
// All debate-related operations (debates, messages, votes, users) are in /api/debates
// Add new routes by requiring them and using app.use('/api/newroute', newRoutes).
app.use('/api/auth', authRoutes);
app.use('/api/debates', debateRoutes);

// Serve frontend: Return index.html for root path to enable client-side routing.
// Modify this to serve different SPA files if needed.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware: Catch all unhandled errors and return 500 status.
// Enhance this to differentiate error types or log to external service.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server: Listen on configured port and log the URL.
// For production, use environment variables for PORT configuration.
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
