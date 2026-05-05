/**
 * Login, registration, and logout endpoints.
 */
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { clearAuthCookie, setAuthCookie, signToken } = require('../middleware/auth');

const router = express.Router();

function sanitizeUser(row) {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    studentId: row.student_id,
    dateOfBirth: row.date_of_birth,
    institution: row.institution,
    subjectArea: row.subject_area,
  };
}

async function verifyPassword(password, storedHash) {
  if (String(storedHash || '').startsWith('plain:')) {
    return storedHash === `plain:${password}`;
  }
  return bcrypt.compare(String(password), storedHash);
}

router.post('/register', async (req, res) => {
  const {
    role,
    name,
    email,
    password,
    dateOfBirth,
    studentId,
    institution,
    subjectArea,
  } = req.body || {};

  if (!role || !name || !email || !password) {
    return res.status(400).json({ error: 'Role, name, email, and password are required.' });
  }

  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Role must be student or teacher.' });
  }

  if (role === 'student' && !dateOfBirth) {
    return res.status(400).json({ error: 'Students must provide a date of birth.' });
  }

  if (role === 'teacher' && (!institution || !subjectArea)) {
    return res.status(400).json({ error: 'Teachers must provide an institution and subject area.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const inserted = await query(
    `
      INSERT INTO users (
        role, name, email, password_hash, date_of_birth, student_id, institution, subject_area
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      role,
      String(name).trim(),
      normalizedEmail,
      passwordHash,
      dateOfBirth || null,
      studentId || null,
      institution || null,
      subjectArea || null,
    ]
  );

  const user = sanitizeUser(inserted.rows[0]);
  setAuthCookie(res, signToken(user));
  return res.status(201).json({ user });
});

router.post('/login', async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required.' });
  }

  const result = await query('SELECT * FROM users WHERE email = $1 AND role = $2', [String(email).trim().toLowerCase(), role]);
  if (!result.rows.length) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const userRow = result.rows[0];
  const passwordValid = await verifyPassword(String(password), userRow.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = sanitizeUser(userRow);
  setAuthCookie(res, signToken(user));
  return res.json({ user });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

module.exports = router;
