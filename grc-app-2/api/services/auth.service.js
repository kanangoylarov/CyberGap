const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../config/database');

function formatUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    company: row.company,
    isAdmin: !!row.is_admin,
  };
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: !!user.is_admin, company: user.company },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

async function register({ firstName, lastName, email, password, company }) {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

  const result = db.prepare(
    `INSERT INTO users (first_name, last_name, email, password, company)
     VALUES (?, ?, ?, ?, ?)`
  ).run(firstName, lastName, email, hashedPassword, company);

  const user = db.prepare(
    'SELECT id, first_name, last_name, email, company, is_admin FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);

  const token = generateToken(user);

  return { token, user: formatUser(user) };
}

async function login({ email, password }) {
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const token = generateToken(user);

  return { token, user: formatUser(user) };
}

function getProfile(userId) {
  const db = getDb();

  const user = db.prepare(
    'SELECT id, first_name, last_name, email, company, is_admin, created_at FROM users WHERE id = ?'
  ).get(userId);

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    company: user.company,
    isAdmin: !!user.is_admin,
    createdAt: user.created_at,
  };
}

module.exports = { register, login, getProfile };
