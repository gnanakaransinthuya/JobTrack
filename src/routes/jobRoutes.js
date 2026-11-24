const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// GET /api/jobs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search = '', type = 'All' } = req.query;
    const params = [req.user.user_id];
    const whereClauses = [];

    if (String(search).trim()) {
      whereClauses.push('(j.title LIKE ? OR j.company_name LIKE ? OR j.location LIKE ?)');
      const q = `%${String(search).trim()}%`;
      params.push(q, q, q);
    }

    if (type && type !== 'All') {
      whereClauses.push('j.job_type = ?');
      params.push(type);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [jobs] = await pool.query(
      `SELECT j.*,
              CASE WHEN sj.saved_id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
       FROM jobs j
       LEFT JOIN saved_jobs sj ON j.job_id = sj.job_id AND sj.user_id = ?
       ${whereSql}
       ORDER BY j.posted_at DESC`,
      params
    );

    res.json({ jobs });
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ message: 'Server error fetching jobs.' });
  }
});

// GET /api/jobs/saved/list
router.get('/saved/list', authenticateToken, async (req, res) => {
  try {
    const [savedJobs] = await pool.query(
      `SELECT j.*, 1 AS is_saved, sj.saved_at
       FROM saved_jobs sj
       INNER JOIN jobs j ON sj.job_id = j.job_id
       WHERE sj.user_id = ?
       ORDER BY sj.saved_at DESC`,
      [req.user.user_id]
    );
    res.json({ jobs: savedJobs });
  } catch (err) {
    console.error('Get saved jobs error:', err);
    res.status(500).json({ message: 'Server error fetching saved jobs.' });
  }
});

// GET /api/jobs/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ message: 'Invalid job ID.' });
    }

    const [jobs] = await pool.query(
      `SELECT j.*,
              CASE WHEN sj.saved_id IS NOT NULL THEN 1 ELSE 0 END AS is_saved
       FROM jobs j
       LEFT JOIN saved_jobs sj ON j.job_id = sj.job_id AND sj.user_id = ?
       WHERE j.job_id = ?`,
      [req.user.user_id, jobId]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    res.json({ job: jobs[0] });
  } catch (err) {
    console.error('Get job detail error:', err);
    res.status(500).json({ message: 'Server error fetching job details.' });
  }
});

// POST /api/jobs/:id/save
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    if (!Number.isInteger(jobId) || jobId <= 0) {
      return res.status(400).json({ message: 'Invalid job ID.' });
    }

    const [jobRows] = await pool.query('SELECT job_id FROM jobs WHERE job_id = ?', [jobId]);
    if (jobRows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const [existing] = await pool.query(
      'SELECT saved_id FROM saved_jobs WHERE user_id = ? AND job_id = ?',
      [req.user.user_id, jobId]
    );

    if (existing.length > 0) {
      await pool.query('DELETE FROM saved_jobs WHERE saved_id = ?', [existing[0].saved_id]);
      return res.json({ message: 'Removed from Saved Jobs.', is_saved: false });
    } else {
      await pool.query('INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)', [
        req.user.user_id,
        jobId,
      ]);
      return res.json({ message: 'Added to Saved Jobs.', is_saved: true });
    }
  } catch (err) {
    console.error('Toggle save job error:', err);
    res.status(500).json({ message: 'Server error toggling saved job.' });
  }
});

module.exports = router;
