const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // Register
  router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password, company } = req.body;

    if (!firstName || !lastName || !email || !password || !company) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(409).json({ success: false, error: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const result = db.prepare(
        `INSERT INTO users (first_name, last_name, email, password, company)
         VALUES (?, ?, ?, ?, ?)`
      ).run(firstName, lastName, email, hashedPassword, company);

      const user = db.prepare(
        'SELECT id, first_name, last_name, email, company, is_admin FROM users WHERE id = ?'
      ).get(result.lastInsertRowid);

      const token = jwt.sign(
        { id: user.id, email: user.email, isAdmin: !!user.is_admin, company: user.company },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            company: user.company,
            isAdmin: !!user.is_admin
          }
        }
      });
    } catch (err) {
      console.error('[Auth] Register error:', err.message);
      res.status(500).json({ success: false, error: 'Registration failed' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, isAdmin: !!user.is_admin, company: user.company },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            company: user.company,
            isAdmin: !!user.is_admin
          }
        }
      });
    } catch (err) {
      console.error('[Auth] Login error:', err.message);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  });

  // Get current user profile
  router.get('/me', authenticateToken, (req, res) => {
    try {
      const u = db.prepare(
        'SELECT id, first_name, last_name, email, company, is_admin, created_at FROM users WHERE id = ?'
      ).get(req.user.id);

      if (!u) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      res.json({
        success: true,
        data: {
          id: u.id, firstName: u.first_name, lastName: u.last_name,
          email: u.email, company: u.company, isAdmin: !!u.is_admin, createdAt: u.created_at
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
