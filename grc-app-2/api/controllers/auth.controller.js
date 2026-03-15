const authService = require('../services/auth.service');

async function register(req, res, next) {
  const { firstName, lastName, email, password, company } = req.body;

  if (!firstName || !lastName || !email || !password || !company) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  try {
    const data = await authService.register({ firstName, lastName, email, password, company });
    res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
}

async function login(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    const data = await authService.login({ email, password });
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
}

function getMe(req, res, next) {
  try {
    const data = authService.getProfile(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { register, login, getMe };
