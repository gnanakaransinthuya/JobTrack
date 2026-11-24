const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const pool = require('./config/db');
const { uploadsDir } = require('./middleware/upload');

/**
 * Seeds demo account (sinthuya@gmail.com / Password123) ONCE when it does not exist.
 * Unlike destructive seeders, this NEVER wipes or resets your changes on server restart
 * unless explicitly invoked with forceReset = true (`npm run seed:reset`).
 */
async function seedDemoUser(forceReset = false) {
  try {
    const email = 'sinthuya@gmail.com';
    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);

    if (existing.length > 0) {
      if (!forceReset) {
        return existing[0].user_id;
      }
      await pool.query('DELETE FROM users WHERE user_id = ?', [existing[0].user_id]);
    }

    const hashedPassword = await bcrypt.hash('Password123', 10);
    const [userRes] = await pool.query(
      `INSERT INTO users
        (full_name, email, password, phone_number, university, interested_field,
         notify_interviews, notify_deadlines, notify_followups, notify_daily_summary,
         default_reminder_offset, daily_summary_time)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 0, '1 hour before', '8:00 AM')`,
      [
        'Sinthuya Gnanakaran',
        email,
        hashedPassword,
        '+94 77 123 4567',
        'BIET Campus',
        'Software Engineering',
      ]
    );
    const userId = userRes.insertId;

    // 1. Seed 3 CVs matching My CVs UI Sample
    const demoCvs = [
      {
        cv_title: 'For general roles',
        role_type: 'Software Engineering',
        file_name: 'My_CV.pdf',
        file_size: 312400,
        is_default: 1,
        uploaded_at: '2025-05-18 10:00:00',
      },
      {
        cv_title: 'For UI/UX Design roles',
        role_type: 'UI / UX Design',
        file_name: 'UI_UX_Resume.pdf',
        file_size: 428900,
        is_default: 0,
        uploaded_at: '2025-05-10 14:30:00',
      },
      {
        cv_title: 'For software developer roles',
        role_type: 'Software Engineering',
        file_name: 'Software_Developer.pdf',
        file_size: 289100,
        is_default: 0,
        uploaded_at: '2025-04-12 09:15:00',
      },
    ];

    const cvIds = {};
    for (const c of demoCvs) {
      const diskPath = path.join(uploadsDir, c.file_name);
      if (!fs.existsSync(diskPath)) {
        fs.writeFileSync(diskPath, `%PDF-1.4\n% Work Flow Demo CV: ${c.file_name} (${c.cv_title})\n`);
      }
      const [cvRes] = await pool.query(
        `INSERT INTO cvs (user_id, cv_title, role_type, file_name, file_path, file_type, file_size, is_default, uploaded_at)
         VALUES (?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?)`,
        [
          userId,
          c.cv_title,
          c.role_type,
          c.file_name,
          `/uploads/cvs/${c.file_name}`,
          c.file_size,
          c.is_default,
          c.uploaded_at,
        ]
      );
      cvIds[c.file_name] = cvRes.insertId;
    }

    // 2. Seed Saved Jobs matching Saved Jobs UI Sample
    await pool.query(
      'INSERT IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, 4), (?, 2)',
      [userId, userId]
    );

    // 3. Seed 24 Applications matching Dashboard UI Sample counts
    // Total = 24 | Applied = 6 | Under Review = 8 | Interview = 5 | Offer = 2 | Rejected = 3
    const demoApps = [
      {
        company_name: 'ABC Company',
        job_title: 'Software Engineer',
        job_type: 'Full Time',
        application_status: 'Under Review',
        date_applied: '2026-05-17',
        job_url: 'https://xpress.jobs/jobs?search=Software+Engineer',
        cv_id: cvIds['Software_Developer.pdf'],
        job_id: 1,
        history: [
          { status: 'Applied', changed_at: '2026-05-17' },
          { status: 'Under Review', changed_at: '2026-05-20' },
        ],
      },
      {
        company_name: 'ST Solutions',
        job_title: 'UI / UX Designer',
        job_type: 'Full Time',
        application_status: 'Interview',
        date_applied: '2026-04-04',
        job_url: 'https://xpress.jobs/jobs?search=UI+UX+Designer',
        cv_id: cvIds['UI_UX_Resume.pdf'],
        job_id: null,
        history: [
          { status: 'Applied', changed_at: '2026-04-04' },
          { status: 'Interview', changed_at: '2026-04-12' },
        ],
      },
      {
        company_name: 'Digital Hub',
        job_title: 'Backend Developer',
        job_type: 'Full Time',
        application_status: 'Applied',
        date_applied: '2025-06-19',
        job_url: 'https://xpress.jobs/jobs?search=Node.js+Developer',
        cv_id: cvIds['Software_Developer.pdf'],
        job_id: 5,
        history: [{ status: 'Applied', changed_at: '2025-06-19' }],
      },
      {
        company_name: 'Tech Solutions (Pvt) Ltd',
        job_title: 'UI / UX Designer',
        job_type: 'Full Time',
        application_status: 'Rejected',
        date_applied: '2025-04-17',
        job_url: 'https://xpress.jobs/jobs?search=UI+UX+Designer',
        cv_id: cvIds['UI_UX_Resume.pdf'],
        job_id: 2,
        history: [
          { status: 'Applied', changed_at: '2025-04-17' },
          { status: 'Rejected', changed_at: '2025-04-28' },
        ],
      },
      { company_name: 'YZ Hub', job_title: 'Mobile App Developer', job_type: 'Part Time', application_status: 'Applied', date_applied: '2025-03-20', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'CodeGen International', job_title: 'Software Engineering Intern', job_type: 'Internship', application_status: 'Applied', date_applied: '2025-03-18', cv_id: cvIds['My_CV.pdf'] },
      { company_name: '99x', job_title: 'Trainee Full Stack Engineer', job_type: 'Internship', application_status: 'Applied', date_applied: '2025-03-15', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'Dialog Axiata', job_title: 'Digital Product Intern', job_type: 'Internship', application_status: 'Applied', date_applied: '2025-03-12', cv_id: cvIds['My_CV.pdf'] },
      { company_name: 'Virtusa', job_title: 'Associate Engineer', job_type: 'Full Time', application_status: 'Applied', date_applied: '2025-03-10', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'WSO2', job_title: 'Software Engineer Intern', job_type: 'Internship', application_status: 'Under Review', date_applied: '2025-03-08', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'IFS Sri Lanka', job_title: 'Undergraduate Trainee', job_type: 'Internship', application_status: 'Under Review', date_applied: '2025-03-06', cv_id: cvIds['My_CV.pdf'] },
      { company_name: 'Sysco LABS', job_title: 'Quality Engineering Intern', job_type: 'Internship', application_status: 'Under Review', date_applied: '2025-03-04', cv_id: cvIds['My_CV.pdf'] },
      { company_name: 'LSEG Technology', job_title: 'Software Engineer', job_type: 'Full Time', application_status: 'Under Review', date_applied: '2025-03-02', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'Rootcode Labs', job_title: 'UI / UX Engineer', job_type: 'Full Time', application_status: 'Under Review', date_applied: '2025-02-26', cv_id: cvIds['UI_UX_Resume.pdf'] },
      { company_name: 'Surge Global', job_title: 'React Native Developer', job_type: 'Full Time', application_status: 'Under Review', date_applied: '2025-02-24', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'PickMe', job_title: 'Mobile Engineering Intern', job_type: 'Internship', application_status: 'Under Review', date_applied: '2025-02-22', cv_id: cvIds['My_CV.pdf'] },
      { company_name: 'Creative Software', job_title: 'Associate Software Engineer', job_type: 'Full Time', application_status: 'Interview', date_applied: '2025-02-18', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'Calcey Technologies', job_title: 'Frontend Developer Intern', job_type: 'Internship', application_status: 'Interview', date_applied: '2025-02-15', cv_id: cvIds['My_CV.pdf'] },
      { company_name: 'hSenid Mobile', job_title: 'Software Developer', job_type: 'Full Time', application_status: 'Interview', date_applied: '2025-02-12', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'Arimac', job_title: 'UI / UX Designer', job_type: 'Full Time', application_status: 'Interview', date_applied: '2025-02-10', cv_id: cvIds['UI_UX_Resume.pdf'] },
      { company_name: 'InnovaX (Pvt) Ltd', job_title: 'Software Engineering Intern', job_type: 'Internship', application_status: 'Offer', date_applied: '2025-02-05', cv_id: cvIds['My_CV.pdf'], job_id: 4 },
      { company_name: 'Pearson Lanka', job_title: 'Associate Software Engineer', job_type: 'Full Time', application_status: 'Offer', date_applied: '2025-02-02', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'Zone24x7', job_title: 'Backend Engineer', job_type: 'Full Time', application_status: 'Rejected', date_applied: '2025-01-25', cv_id: cvIds['Software_Developer.pdf'] },
      { company_name: 'Epic Lanka', job_title: 'Java Developer', job_type: 'Full Time', application_status: 'Rejected', date_applied: '2025-01-18', cv_id: cvIds['Software_Developer.pdf'] },
    ];

    const appIdsByCompany = {};
    for (const app of demoApps) {
      const [appRes] = await pool.query(
        `INSERT INTO applications
          (user_id, cv_id, job_id, company_name, job_title, job_type, application_status, date_applied, job_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          app.cv_id || cvIds['My_CV.pdf'],
          app.job_id || null,
          app.company_name,
          app.job_title,
          app.job_type,
          app.application_status,
          app.date_applied,
          app.job_url || 'https://xpress.jobs',
        ]
      );
      const appId = appRes.insertId;
      appIdsByCompany[app.company_name] = appId;

      const histList = app.history || [{ status: app.application_status, changed_at: app.date_applied }];
      for (const h of histList) {
        await pool.query(
          `INSERT INTO application_status_history (application_id, status, changed_at)
           VALUES (?, ?, ?)`,
          [appId, h.status, h.changed_at]
        );
      }
    }

    // 4. Seed 3 Reminders matching My Reminders UI Sample
    const demoReminders = [
      {
        application_id: appIdsByCompany['ST Solutions'],
        reminder_type: 'Interview',
        title: 'Interview with ST Solutions',
        reminder_datetime: '2026-05-15 10:00:00',
        location: 'Colombo, Sri Lanka.',
        notify_offset: '1 hour before',
        is_completed: 0,
      },
      {
        application_id: appIdsByCompany['ABC Company'],
        reminder_type: 'Follow-up',
        title: 'Follow up - ABC Company',
        reminder_datetime: '2026-06-04 09:00:00',
        location: 'Colombo, Sri Lanka.',
        notify_offset: '1 day before',
        is_completed: 0,
      },
      {
        application_id: appIdsByCompany['InnovaX (Pvt) Ltd'],
        reminder_type: 'Application Deadline',
        title: 'Application Deadline',
        reminder_datetime: '2026-11-25 23:59:00',
        location: 'InnovaX (Pvt) Ltd',
        notify_offset: '1 day before',
        is_completed: 0,
      },
    ];

    for (const rem of demoReminders) {
      await pool.query(
        `INSERT INTO reminders
          (user_id, application_id, reminder_type, title, reminder_datetime, location, notify_offset, is_completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          rem.application_id,
          rem.reminder_type,
          rem.title,
          rem.reminder_datetime,
          rem.location,
          rem.notify_offset,
          rem.is_completed,
        ]
      );
    }

    console.log('Seeded Work Flow demo user (sinthuya@gmail.com) cleanly.');
    return userId;
  } catch (err) {
    console.error('Error seeding demo user:', err);
  }
}

if (require.main === module) {
  const shouldReset = process.argv.includes('--reset');
  seedDemoUser(shouldReset).then(() => process.exit(0));
}

module.exports = seedDemoUser;
