/**
 * Central server configuration for the ASB platform.
 */
'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.AUTH_COOKIE_NAME || 'asb_token',
  db: {
    connectionString: process.env.DATABASE_URL || '',
    ssl: process.env.DATABASE_SSL === 'true',
  },
  paths: {
    root: path.join(__dirname, '..'),
    pages: path.join(__dirname, '..', 'pages'),
    examHtml: path.join(__dirname, '..', 'index.html'),
  },
};
