const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pool = require('./config/db');
const initDb = require('./initDb');
const seedDemoUser = require('./seedDemoUser');

const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const cvRoutes = require('./routes/cvRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded CV files & profile photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root status route (confirms cloud deployment is live in browser)
app.get('/', (req, res) => {
  res.json({
    service: 'JobTrack — Smart Career Path Tracking System API',
    status: 'running',
    healthEndpoint: '/api/health',
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS dbName');
    res.json({
      status: 'ok',
      service: 'JobTrack — Smart Career Path Tracking System API',
      database: 'connected',
      dbName: rows[0]?.dbName || process.env.DB_NAME || 'workflow_career_db',
      port: Number(PORT),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/cvs', cvRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ message: err.message || 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Work Flow Backend API running on http://localhost:${PORT}`);
    await initDb();
    await seedDemoUser(false);
  });
}

module.exports = app;
