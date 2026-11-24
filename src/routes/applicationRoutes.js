const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const {
  VALID_APPLICATION_STATUSES,
  VALID_JOB_TYPES,
  normalizeDateToSql,
  normalizeDateTimeToSql,
} = require('../utils/validators');

const router = express.Router();

// GET /api/applications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search = '', status = 'All' } = req.query;
    const params = [req.user.user_id];
    const conditions = ['a.user_id = ?'];

    if (String(search).trim()) {
      conditions.push('(a.company_name LIKE ? OR a.job_title LIKE ?)');
      const q = `%${String(search).trim()}%`;
      params.push(q, q);
    }

    if (status && status !== 'All') {
      conditions.push('a.application_status = ?');
      params.push(status);
    }

    const [applications] = await pool.query(
      `SELECT a.*, c.file_name AS cv_file_name, c.cv_title
       FROM applications a
       LEFT JOIN cvs c ON a.cv_id = c.cv_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date_applied DESC, a.application_id DESC`,
      params
    );

    res.json({ applications });
  } catch (err) {
    console.error('Get applications error:', err);
    res.status(500).json({ message: 'Server error fetching applications.' });
  }
});

// GET /api/applications/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const appId = Number(req.params.id);
    if (!Number.isInteger(appId) || appId <= 0) {
      return res.status(400).json({ message: 'Invalid application ID.' });
    }

    const [apps] = await pool.query(
      `SELECT a.*, c.file_name AS cv_file_name, c.cv_title, c.file_path AS cv_file_path
       FROM applications a
       LEFT JOIN cvs c ON a.cv_id = c.cv_id
       WHERE a.application_id = ? AND a.user_id = ?`,
      [appId, req.user.user_id]
    );

    if (apps.length === 0) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const [history] = await pool.query(
      `SELECT history_id, status, changed_at, created_at
       FROM application_status_history
       WHERE application_id = ?
       ORDER BY changed_at DESC, history_id DESC`,
      [appId]
    );

    const [reminders] = await pool.query(
      `SELECT * FROM reminders
       WHERE application_id = ? AND user_id = ?
       ORDER BY reminder_datetime ASC`,
      [appId, req.user.user_id]
    );

    res.json({
      application: apps[0],
      status_history: history,
      reminders,
    });
  } catch (err) {
    console.error('Get application detail error:', err);
    res.status(500).json({ message: 'Server error fetching application details.' });
  }
});

// POST /api/applications
router.post('/', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      company_name,
      job_title,
      job_type = 'Full Time',
      application_status = 'Applied',
      date_applied,
      job_url,
      cv_id,
      job_id,
      notes,
      reminder,
    } = req.body;

    if (!company_name || !company_name.trim() || !job_title || !job_title.trim()) {
      await conn.rollback();
      return res.status(400).json({ message: 'Company Name and Position are required.' });
    }

    const safeJobType = VALID_JOB_TYPES.includes(job_type) ? job_type : 'Full Time';
    const safeStatus = VALID_APPLICATION_STATUSES.includes(application_status)
      ? application_status
      : 'Applied';

    const todayIso = new Date().toISOString().split('T')[0];
    const appliedDate = date_applied ? normalizeDateToSql(date_applied) : todayIso;
    if (!appliedDate) {
      await conn.rollback();
      return res.status(400).json({ message: 'Please enter a valid Date Applied (DD / MM / YYYY).' });
    }

    // Auto-attach user's default CV if none specified
    let resolvedCvId = cv_id || null;
    if (!resolvedCvId) {
      const [defaultCvs] = await conn.query(
        'SELECT cv_id FROM cvs WHERE user_id = ? AND is_default = 1 LIMIT 1',
        [req.user.user_id]
      );
      if (defaultCvs.length > 0) {
        resolvedCvId = defaultCvs[0].cv_id;
      }
    }

    const [insertRes] = await conn.query(
      `INSERT INTO applications
        (user_id, cv_id, job_id, company_name, job_title, job_type, application_status, date_applied, job_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        resolvedCvId,
        job_id || null,
        company_name.trim(),
        job_title.trim(),
        safeJobType,
        safeStatus,
        appliedDate,
        job_url || null,
        notes || null,
      ]
    );

    const applicationId = insertRes.insertId;

    await conn.query(
      `INSERT INTO application_status_history (application_id, status, changed_at)
       VALUES (?, ?, ?)`,
      [applicationId, safeStatus, appliedDate]
    );

    let createdReminder = null;
    if (reminder && reminder.reminder_datetime) {
      const normalizedRemDt = normalizeDateTimeToSql(reminder.reminder_datetime);
      if (normalizedRemDt) {
        const [remRes] = await conn.query(
          `INSERT INTO reminders
            (user_id, application_id, reminder_type, title, reminder_datetime, location, notify_offset, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.user_id,
            applicationId,
            reminder.reminder_type || 'Follow-up',
            reminder.title || `${reminder.reminder_type || 'Follow-up'} - ${company_name.trim()}`,
            normalizedRemDt,
            reminder.location || 'Colombo, Sri Lanka',
            reminder.notify_offset || '1 day before',
            reminder.notes || null,
          ]
        );
        const [remRows] = await conn.query('SELECT * FROM reminders WHERE reminder_id = ?', [
          remRes.insertId,
        ]);
        createdReminder = remRows[0] || null;
      }
    }

    await conn.commit();

    const [created] = await pool.query(
      `SELECT a.*, c.file_name AS cv_file_name, c.cv_title
       FROM applications a
       LEFT JOIN cvs c ON a.cv_id = c.cv_id
       WHERE a.application_id = ?`,
      [applicationId]
    );

    res.status(201).json({
      message: 'Application saved successfully.',
      application: created[0],
      created_reminder: createdReminder,
      created_reminder_id: createdReminder?.reminder_id || null,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Create application error:', err);
    res.status(500).json({ message: 'Server error saving application.' });
  } finally {
    conn.release();
  }
});

// PATCH /api/applications/:id/status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const appId = Number(req.params.id);
    const { application_status, changed_at } = req.body;

    if (!VALID_APPLICATION_STATUSES.includes(application_status)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid application status.' });
    }

    const [existing] = await conn.query(
      'SELECT application_id, application_status FROM applications WHERE application_id = ? AND user_id = ?',
      [appId, req.user.user_id]
    );

    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Application not found.' });
    }

    // Prevent duplicate status history entry if status did not change
    if (existing[0].application_status === application_status) {
      await conn.rollback();
      const [history] = await pool.query(
        `SELECT history_id, status, changed_at, created_at
         FROM application_status_history
         WHERE application_id = ?
         ORDER BY changed_at DESC, history_id DESC`,
        [appId]
      );
      return res.json({
        message: `Status is already "${application_status}".`,
        application_status,
        status_history: history,
      });
    }

    await conn.query(
      'UPDATE applications SET application_status = ? WHERE application_id = ?',
      [application_status, appId]
    );

    const statusDate =
      (changed_at && normalizeDateToSql(changed_at)) || new Date().toISOString().split('T')[0];

    await conn.query(
      `INSERT INTO application_status_history (application_id, status, changed_at)
       VALUES (?, ?, ?)`,
      [appId, application_status, statusDate]
    );

    await conn.commit();

    const [history] = await pool.query(
      `SELECT history_id, status, changed_at, created_at
       FROM application_status_history
       WHERE application_id = ?
       ORDER BY changed_at DESC, history_id DESC`,
      [appId]
    );

    res.json({
      message: `Status updated to "${application_status}".`,
      application_status,
      status_history: history,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Server error updating status.' });
  } finally {
    conn.release();
  }
});

// PUT /api/applications/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const appId = Number(req.params.id);
    const {
      company_name,
      job_title,
      job_type,
      application_status,
      date_applied,
      job_url,
      cv_id,
      notes,
    } = req.body;

    const [existing] = await pool.query(
      'SELECT * FROM applications WHERE application_id = ? AND user_id = ?',
      [appId, req.user.user_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const oldStatus = existing[0].application_status;
    const newStatus =
      application_status && VALID_APPLICATION_STATUSES.includes(application_status)
        ? application_status
        : oldStatus;

    const normalizedDate = date_applied
      ? normalizeDateToSql(date_applied) || existing[0].date_applied
      : existing[0].date_applied;

    await pool.query(
      `UPDATE applications
       SET company_name = ?, job_title = ?, job_type = ?, application_status = ?,
           date_applied = ?, job_url = ?, cv_id = ?, notes = ?
       WHERE application_id = ? AND user_id = ?`,
      [
        company_name ? company_name.trim() : existing[0].company_name,
        job_title ? job_title.trim() : existing[0].job_title,
        job_type && VALID_JOB_TYPES.includes(job_type) ? job_type : existing[0].job_type,
        newStatus,
        normalizedDate,
        job_url !== undefined ? job_url : existing[0].job_url,
        cv_id !== undefined ? cv_id : existing[0].cv_id,
        notes !== undefined ? notes : existing[0].notes,
        appId,
        req.user.user_id,
      ]
    );

    if (newStatus !== oldStatus) {
      await pool.query(
        `INSERT INTO application_status_history (application_id, status, changed_at)
         VALUES (?, ?, CURDATE())`,
        [appId, newStatus]
      );
    }

    const [updated] = await pool.query(
      `SELECT a.*, c.file_name AS cv_file_name, c.cv_title
       FROM applications a
       LEFT JOIN cvs c ON a.cv_id = c.cv_id
       WHERE a.application_id = ?`,
      [appId]
    );

    res.json({
      message: 'Application updated successfully.',
      application: updated[0],
    });
  } catch (err) {
    console.error('Update application error:', err);
    res.status(500).json({ message: 'Server error updating application.' });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const appId = Number(req.params.id);
    const [result] = await pool.query(
      'DELETE FROM applications WHERE application_id = ? AND user_id = ?',
      [appId, req.user.user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.json({ message: 'Application deleted successfully.' });
  } catch (err) {
    console.error('Delete application error:', err);
    res.status(500).json({ message: 'Server error deleting application.' });
  }
});

module.exports = router;
