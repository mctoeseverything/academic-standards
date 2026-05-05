/**
 * JWT cookie authentication helpers and role guards.
 */
'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, { path: '/' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth || req.auth.role !== role) {
      return res.status(403).json({ error: 'You do not have access to this resource.' });
    }
    return next();
  };
}

module.exports = {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireRole,
};
