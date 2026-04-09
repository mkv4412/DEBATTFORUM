// ===================================================================
// Project Configuration - Centralized Settings
// ===================================================================
// This file contains all configuration variables for the Debattforum
// application. Modify these values here instead of scattering them
// throughout the codebase. For different environments (dev/prod),
// use environment variables (process.env.*).
//
// USAGE: const config = require('./config');
//        console.log(config.PORT);
// ===================================================================

const path = require('path');

module.exports = {
  // Server port: Change via environment variable or modify default
  PORT: process.env.PORT || 5000,

  // Database file path: Stored in server directory
  // For production, use an absolute path or cloud storage
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'debates.db'),

  // JWT secret: Used to sign authentication tokens
  // SECURITY: Change this in production! Use a strong random string.
  // Never commit production secrets to version control.
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',

  // JWT expiration time: How long tokens stay valid
  JWT_EXPIRY: '7d',

  // CORS origin: Which domains can access the API
  // For local development: http://localhost:3000 or * (allow all)
  // For production: Restrict to your domain only
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Admin default user: Created on first startup if doesn't exist
  // This user has special privileges (delete debates, manage users)
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'bob',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'bob123'
};
