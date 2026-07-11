import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const { password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    // Platform is for educators and admins only. Public signups become
    // educators; admins are provisioned separately (seed / DB).
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'educator')",
      [name, email, password_hash]
    );

    const user = { id: result.insertId, name, email, role: 'educator' };
    return res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const row = rows[0];
    // Same generic message whether the email or the password is wrong.
    const ok = row && (await bcrypt.compare(password, row.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Access is restricted to educators and administrators.
    if (row.role !== 'educator' && row.role !== 'admin') {
      return res.status(403).json({
        error: 'Access is restricted to educators and administrators',
      });
    }

    return res.status(200).json({ token: signToken(row), user: publicUser(row) });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
