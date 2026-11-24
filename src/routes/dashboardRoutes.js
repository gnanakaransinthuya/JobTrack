const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [statusRows] = await pool.query(
      `SELECT application_status, COUNT(*) AS count
       FROM applications
       WHERE user_id = ?
       GROUP BY application_status`,
      [userId]
    );

    const statusCounts = {
      Applied: 0,
      'Under Review': 0,
      Interview: 0,
      Offer: 0,
      Rejected: 0,
    };

    let totalApplications = 0;
    for (const row of statusRows) {
      const cnt = Number(row.count) || 0;
      if (statusCounts[row.application_status] !== undefined) {
        statusCounts[row.application_status] = cnt;
      }
      totalApplications += cnt;
    }

    const pendingApplications =
      statusCounts['Under Review'] > 0
        ? statusCounts['Under Review']
        : statusCounts['Applied'];
    const upcomingInterviews = statusCounts['Interview'];
    const successfulOutcomes = statusCounts['Offer'];

    const [recentApplications] = await pool.query(
      `SELECT a.*, c.file_name AS cv_file_name
       FROM applications a
       LEFT JOIN cvs c ON a.cv_id = c.cv_id
       WHERE a.user_id = ?
       ORDER BY a.date_applied DESC, a.application_id DESC
       LIMIT 5`,
      [userId]
    );

    const [upcomingReminders] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM reminders
       WHERE user_id = ? AND is_completed = 0`,
      [userId]
    );

    res.json({
      kpis: {
        totalApplications,
        pendingApplications,
        upcomingInterviews,
        successfulOutcomes,
        upcomingRemindersCount: Number(upcomingReminders[0]?.count || 0),
      },
      statusBreakdown: statusCounts,
      recentApplications,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Server error loading dashboard.' });
  }
});

// GET /api/dashboard/search?q=... (Searches across both jobs and user applications)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ applications: [], jobs: [] });
    }
    const like = `%${q}%`;

    const [applications] = await pool.query(
      `SELECT a.*, c.file_name AS cv_file_name
       FROM applications a
       LEFT JOIN cvs c ON a.cv_id = c.cv_id
       WHERE a.user_id = ? AND (a.company_name LIKE ? OR a.job_title LIKE ? OR a.application_status LIKE ?)
       ORDER BY a.date_applied DESC
       LIMIT 10`,
      [req.user.user_id, like, like, like]
    );

    const [jobs] = await pool.query(
      `SELECT j.*,
              CASE WHEN sj.saved_id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
       FROM jobs j
       LEFT JOIN saved_jobs sj ON j.job_id = sj.job_id AND sj.user_id = ?
       WHERE j.title LIKE ? OR j.company_name LIKE ? OR j.location LIKE ?
       ORDER BY j.posted_at DESC
       LIMIT 10`,
      [req.user.user_id, like, like, like]
    );

    res.json({ applications, jobs });
  } catch (err) {
    console.error('Dashboard search error:', err);
    res.status(500).json({ message: 'Server error performing search.' });
  }
});

module.exports = router;
