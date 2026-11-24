const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const { validatePasswordPolicy, validateEmail } = require('../utils/validators');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'work_flow_biet_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const SAFE_USER_FIELDS = `
  user_id, full_name, email, phone_number, university, interested_field, profile_photo,
  notify_interviews, notify_deadlines, notify_followups, notify_daily_summary,
  default_reminder_offset, daily_summary_time, created_at, updated_at
`;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, university, interested_field, phone_number } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Full name, email, and password are required.' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!validatePasswordPolicy(password)) {
      return res.status(400).json({
        message: 'Use at least 8 characters with a number, upper case and lower case letter.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password, phone_number, university, interested_field)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        full_name.trim(),
        normalizedEmail,
        hashedPassword,
        phone_number || null,
        university || 'BIET Campus',
        interested_field || 'Software Engineering',
      ]
    );

    const [users] = await pool.query(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE user_id = ?`, [
      result.insertId,
    ]);

    const user = users[0];
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const { password: _, reset_token: __, reset_token_expiry: ___, ...safeUser } = user;

    res.json({
      message: 'Login successful.',
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid registered email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [users] = await pool.query('SELECT user_id, email FROM users WHERE email = ?', [normalizedEmail]);

    const resetToken = crypto.randomBytes(20).toString('hex');
    if (users.length > 0) {
      await pool.query(
        'UPDATE users SET reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE user_id = ?',
        [resetToken, users[0].user_id]
      );
    }

    res.json({
      message: `We sent a password reset link to ${normalizedEmail}. The link expires in 30 minutes.`,
      expiresInMinutes: 30,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error processing password reset request.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE user_id = ?`, [
      req.user.user_id,
    ]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user: users[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error fetching profile.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone_number, university, interested_field, profile_photo } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ message: 'Full Name is required.' });
    }

    await pool.query(
      `UPDATE users
       SET full_name = ?, phone_number = ?, university = ?, interested_field = ?,
           profile_photo = COALESCE(?, profile_photo)
       WHERE user_id = ?`,
      [
        full_name.trim(),
        phone_number || null,
        university || 'BIET Campus',
        interested_field || 'Software Engineering',
        profile_photo || null,
        req.user.user_id,
      ]
    );

    const [updated] = await pool.query(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE user_id = ?`, [
      req.user.user_id,
    ]);

    res.json({
      message: 'Profile updated successfully.',
      user: updated[0],
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
});

// POST /api/auth/profile/photo
router.post('/profile/photo', authenticateToken, (req, res) => {
  uploadAvatar.single('photo')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Image upload failed (Max 3MB).' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
      }
      const photoUrl = `/uploads/avatars/${req.file.filename}`;
      await pool.query('UPDATE users SET profile_photo = ? WHERE user_id = ?', [
        photoUrl,
        req.user.user_id,
      ]);

      const [updated] = await pool.query(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE user_id = ?`, [
        req.user.user_id,
      ]);

      res.json({
        message: 'Profile photo updated.',
        profile_photo: photoUrl,
        user: updated[0],
      });
    } catch (err) {
      console.error('Upload avatar error:', err);
      res.status(500).json({ message: 'Failed to upload profile photo.' });
    }
  });
});

// PUT /api/auth/change-password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    if (current_password === new_password) {
      return res.status(400).json({ message: 'New password must not be the same as your current password.' });
    }

    if (!validatePasswordPolicy(new_password)) {
      return res.status(400).json({
        message: 'Password must have at least 8 characters, 1 number, and upper & lower case letters.',
      });
    }

    const [users] = await pool.query('SELECT password FROM users WHERE user_id = ?', [req.user.user_id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const matches = await bcrypt.compare(current_password, users[0].password);
    if (!matches) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, req.user.user_id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error changing password.' });
  }
});

// PUT /api/auth/notification-settings
router.put('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const {
      notify_interviews,
      notify_deadlines,
      notify_followups,
      notify_daily_summary,
      default_reminder_offset,
      daily_summary_time,
    } = req.body;

    await pool.query(
      `UPDATE users
       SET notify_interviews = ?,
           notify_deadlines = ?,
           notify_followups = ?,
           notify_daily_summary = ?,
           default_reminder_offset = ?,
           daily_summary_time = ?
       WHERE user_id = ?`,
      [
        notify_interviews ? 1 : 0,
        notify_deadlines ? 1 : 0,
        notify_followups ? 1 : 0,
        notify_daily_summary ? 1 : 0,
        default_reminder_offset || '1 hour before',
        daily_summary_time || '8:00 AM',
        req.user.user_id,
      ]
    );

    const [updated] = await pool.query(`SELECT ${SAFE_USER_FIELDS} FROM users WHERE user_id = ?`, [
      req.user.user_id,
    ]);

    res.json({
      message: 'Notification settings saved.',
      user: updated[0],
    });
  } catch (err) {
    console.error('Update notification settings error:', err);
    res.status(500).json({ message: 'Server error saving notification settings.' });
  }
});

module.exports = router;
