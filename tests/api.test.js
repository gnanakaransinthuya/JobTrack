const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/server');
const pool = require('../src/config/db');
const initDb = require('../src/initDb');
const seedDemoUser = require('../src/seedDemoUser');

const testEmail = `jest.qa.${Date.now()}@biet.lk`;
const testPassword = 'WorkFlow2026';

let authToken = '';
let testUserId = null;
let tempAppId = null;
let tempReminderId = null;
let tempCvId = null;

beforeAll(async () => {
  await initDb();
  await seedDemoUser(false);

  const reg = await request(app).post('/api/auth/register').send({
    full_name: 'Jest QA User',
    email: testEmail,
    password: testPassword,
  });
  testUserId = reg.body.user?.user_id || null;
});

afterAll(async () => {
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE user_id = ?', [testUserId]);
  }
  await pool.end();
});

describe('Work Flow Backend REST API — Integration Tests', () => {
  test('1. GET /api/health confirms workflow_career_db connection', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.dbName).toBe('workflow_career_db');
  });

  test('2. POST /api/auth/login authenticates user and returns JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(testEmail);
    authToken = res.body.token;
  });

  test('3. POST /api/auth/login rejects wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword1',
    });
    expect(res.status).toBe(401);
  });

  test('4. GET /api/jobs & toggle save job return XpressJobs.lk listings', async () => {
    const jobsRes = await request(app)
      .get('/api/jobs?type=All')
      .set('Authorization', `Bearer ${authToken}`);
    expect(jobsRes.status).toBe(200);
    expect(jobsRes.body.jobs.length).toBeGreaterThanOrEqual(6);
    expect(jobsRes.body.jobs[0].source).toBe('XpressJobs.lk');

    const toggleRes = await request(app)
      .post('/api/jobs/1/save')
      .set('Authorization', `Bearer ${authToken}`);
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.is_saved).toBe(true);

    const savedRes = await request(app)
      .get('/api/jobs/saved/list')
      .set('Authorization', `Bearer ${authToken}`);
    expect(savedRes.status).toBe(200);
    expect(savedRes.body.jobs.length).toBeGreaterThanOrEqual(1);
  });

  test('5. POST, PATCH status, PUT, and DELETE /api/applications with DD / MM / YYYY date', async () => {
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        company_name: 'WSO2 Sri Lanka',
        job_title: 'Associate Software Engineer',
        job_type: 'Full Time',
        application_status: 'Applied',
        date_applied: '25 / 06 / 2026',
        job_url: 'https://xpress.jobs/jobs?search=WSO2',
        notes: 'Submitted via Work Flow Jest test',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.application.date_applied).toBe('2026-06-25');
    tempAppId = createRes.body.application.application_id;

    // Update status and confirm history timeline increments
    const patchRes = await request(app)
      .patch(`/api/applications/${tempAppId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ application_status: 'Interview', changed_at: '28 / 06 / 2026' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status_history.length).toBe(2);

    // Edit application
    const putRes = await request(app)
      .put(`/api/applications/${tempAppId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ company_name: 'WSO2 Lanka (Pvt) Ltd', job_title: 'Software Engineer' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.application.company_name).toBe('WSO2 Lanka (Pvt) Ltd');
  });

  test('6. GET /api/dashboard returns KPIs, status breakdown & recent applications', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis.totalApplications).toBe(1);
    expect(res.body.kpis.upcomingInterviews).toBe(1);
    expect(res.body.statusBreakdown).toHaveProperty('Applied');
    expect(res.body.statusBreakdown).toHaveProperty('Under Review');
    expect(res.body.statusBreakdown).toHaveProperty('Interview');
    expect(res.body.statusBreakdown).toHaveProperty('Offer');
    expect(res.body.statusBreakdown).toHaveProperty('Rejected');
    expect(Array.isArray(res.body.recentApplications)).toBe(true);
  });

  test('7. GET /api/dashboard/search returns matching applications and jobs', async () => {
    const res = await request(app)
      .get('/api/dashboard/search?q=Software')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.jobs.length).toBeGreaterThan(0);
    expect(res.body.applications.length).toBeGreaterThan(0);
  });

  test('8. POST, GET, PATCH toggle, DELETE /api/reminders', async () => {
    const createRem = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Technical Interview - Test',
        reminder_type: 'Interview',
        application_id: tempAppId,
        reminder_datetime: '20 / 07 / 2026 10:30 AM',
        location: 'Colombo, Sri Lanka',
        notify_offset: 'At the time',
      });
    expect(createRem.status).toBe(201);
    tempReminderId = createRem.body.reminder.reminder_id;

    const toggleRem = await request(app)
      .patch(`/api/reminders/${tempReminderId}/toggle`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(toggleRem.status).toBe(200);
    expect(toggleRem.body.is_completed).toBe(true);

    const delRem = await request(app)
      .delete(`/api/reminders/${tempReminderId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(delRem.status).toBe(200);

    const delApp = await request(app)
      .delete(`/api/applications/${tempAppId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(delApp.status).toBe(200);
  });

  test('9. POST (real PDF upload), GET, and DELETE /api/cvs', async () => {
    const tmpPdfPath = path.join(__dirname, 'temp_test_cv.pdf');
    fs.writeFileSync(tmpPdfPath, '%PDF-1.4\n% Jest test CV file\n');

    try {
      const uploadRes = await request(app)
        .post('/api/cvs')
        .set('Authorization', `Bearer ${authToken}`)
        .field('cv_title', 'Test Software CV')
        .field('role_type', 'Software Engineering')
        .field('is_default', 'true')
        .attach('file', tmpPdfPath);

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.cv.file_name).toBe('temp_test_cv.pdf');
      tempCvId = uploadRes.body.cv.cv_id;

      const listRes = await request(app)
        .get('/api/cvs')
        .set('Authorization', `Bearer ${authToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.cvs.length).toBe(1);

      const delCv = await request(app)
        .delete(`/api/cvs/${tempCvId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(delCv.status).toBe(200);
    } finally {
      if (fs.existsSync(tmpPdfPath)) fs.unlinkSync(tmpPdfPath);
    }
  });
});
