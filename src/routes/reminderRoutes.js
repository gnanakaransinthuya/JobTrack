const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { VALID_REMINDER_TYPES, normalizeDateTimeToSql } = require('../utils/validators');

const router = express.Router();

// GET /api/reminders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tab = 'all' } = req.query;
    let filterSql = '';

    if (tab === 'upcoming') {
      filterSql = 'AND r.is_completed = 0';
    } else if (tab === 'completed') {
      filterSql = 'AND r.is_completed = 1';
    }

    const [reminders] = await pool.query(
      `SELECT r.*, a.company_name, a.job_title
       FROM reminders r
       LEFT JOIN applications a ON r.application_id = a.application_id
       WHERE r.user_id = ? ${filterSql}
       ORDER BY r.reminder_datetime ASC`,
      [req.user.user_id]
    );

    res.json({ reminders });
  } catch (err) {
    console.error('Get reminders error:', err);
    res.status(500).json({ message: 'Server error fetching reminders.' });
  }
});

// POST /api/reminders
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      reminder_type = 'Interview',
      application_id,
      reminder_datetime,
      location,
      meeting_link,
      notify_offset = '1 hour before',
      notes,
    } = req.body;

    if (!title || !title.trim() || !reminder_datetime) {
      return res.status(400).json({ message: 'Title and Date/Time are required.' });
    }

    const normalizedDt = normalizeDateTimeToSql(reminder_datetime);
    if (!normalizedDt) {
      return res.status(400).json({ message: 'Please enter a valid Date (DD / MM / YYYY) and Time.' });
    }

    const safeType = VALID_REMINDER_TYPES.includes(reminder_type) ? reminder_type : 'Interview';

    // If the user enters a URL in location, also preserve it in meeting_link
    const rawLocation = (location || '').trim();
    const isUrl = /^https?:\/\//i.test(rawLocation);
    const resolvedLocation = rawLocation || 'Colombo, Sri Lanka.';
    const resolvedMeetingLink = meeting_link || (isUrl ? rawLocation : null);

    const [result] = await pool.query(
      `INSERT INTO reminders
        (user_id, application_id, reminder_type, title, reminder_datetime, location, meeting_link, notify_offset, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        application_id || null,
        safeType,
        title.trim(),
        normalizedDt,
        resolvedLocation,
        resolvedMeetingLink,
        notify_offset,
        notes || null,
      ]
    );

    const [created] = await pool.query(
      `SELECT r.*, a.company_name, a.job_title
       FROM reminders r
       LEFT JOIN applications a ON r.application_id = a.application_id
       WHERE r.reminder_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'Reminder saved successfully.',
      reminder: created[0],
    });
  } catch (err) {
    console.error('Create reminder error:', err);
    res.status(500).json({ message: 'Server error creating reminder.' });
  }
});

// PATCH /api/reminders/:id/toggle
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const reminderId = Number(req.params.id);
    const [existing] = await pool.query(
      'SELECT reminder_id, is_completed FROM reminders WHERE reminder_id = ? AND user_id = ?',
      [reminderId, req.user.user_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Reminder not found.' });
    }

    const newState = existing[0].is_completed ? 0 : 1;
    await pool.query('UPDATE reminders SET is_completed = ? WHERE reminder_id = ?', [
      newState,
      reminderId,
    ]);

    res.json({
      message: newState ? 'Reminder marked as completed.' : 'Reminder moved back to upcoming.',
      is_completed: Boolean(newState),
    });
  } catch (err) {
    console.error('Toggle reminder error:', err);
    res.status(500).json({ message: 'Server error updating reminder.' });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const reminderId = Number(req.params.id);
    const [result] = await pool.query(
      'DELETE FROM reminders WHERE reminder_id = ? AND user_id = ?',
      [reminderId, req.user.user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Reminder not found.' });
    }

    res.json({ message: 'Reminder deleted successfully.' });
  } catch (err) {
    console.error('Delete reminder error:', err);
    res.status(500).json({ message: 'Server error deleting reminder.' });
  }
});

module.exports = router;
