const pool = require('./config/db');

/**
 * Automatically creates all 7 Work Flow MySQL tables and seeds the 6 initial
 * XpressJobs.lk job listings on first boot. Safe to run on every startup
 * (uses CREATE TABLE IF NOT EXISTS & INSERT IGNORE — never overwrites user data).
 */
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone_number VARCHAR(30) DEFAULT NULL,
        university VARCHAR(150) DEFAULT 'BIET Campus',
        interested_field VARCHAR(120) DEFAULT 'Software Engineering',
        profile_photo VARCHAR(255) DEFAULT NULL,
        notify_interviews TINYINT(1) DEFAULT 1,
        notify_deadlines TINYINT(1) DEFAULT 1,
        notify_followups TINYINT(1) DEFAULT 0,
        notify_daily_summary TINYINT(1) DEFAULT 0,
        default_reminder_offset VARCHAR(50) DEFAULT '1 hour before',
        daily_summary_time VARCHAR(20) DEFAULT '8:00 AM',
        reset_token VARCHAR(255) DEFAULT NULL,
        reset_token_expiry DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cvs (
        cv_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        cv_title VARCHAR(150) NOT NULL,
        role_type VARCHAR(100) DEFAULT 'Software Engineering',
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INT NOT NULL,
        is_default TINYINT(1) DEFAULT 0,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cvs_user (user_id),
        CONSTRAINT fk_wf_cvs_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        job_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        company_name VARCHAR(150) NOT NULL,
        location VARCHAR(120) NOT NULL,
        job_type ENUM('Full Time', 'Part Time', 'Internship', 'Contract') NOT NULL DEFAULT 'Full Time',
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        closing_date DATE NOT NULL,
        source VARCHAR(100) DEFAULT 'XpressJobs.lk',
        source_url VARCHAR(500) NOT NULL,
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_jobs_type (job_type),
        INDEX idx_jobs_posted (posted_at)
      ) ENGINE=InnoDB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_jobs (
        saved_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        job_id INT NOT NULL,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wf_user_saved_job (user_id, job_id),
        CONSTRAINT fk_wf_saved_jobs_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE,
        CONSTRAINT fk_wf_saved_jobs_job
          FOREIGN KEY (job_id) REFERENCES jobs(job_id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        application_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        cv_id INT DEFAULT NULL,
        job_id INT DEFAULT NULL,
        company_name VARCHAR(150) NOT NULL,
        job_title VARCHAR(150) NOT NULL,
        job_type ENUM('Full Time', 'Part Time', 'Internship', 'Contract') NOT NULL DEFAULT 'Full Time',
        application_status ENUM('Applied', 'Under Review', 'Interview', 'Offer', 'Rejected') NOT NULL DEFAULT 'Applied',
        date_applied DATE NOT NULL,
        job_url VARCHAR(500) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_apps_user_status (user_id, application_status),
        INDEX idx_apps_date (date_applied),
        CONSTRAINT fk_wf_applications_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE,
        CONSTRAINT fk_wf_applications_cv
          FOREIGN KEY (cv_id) REFERENCES cvs(cv_id)
          ON DELETE SET NULL,
        CONSTRAINT fk_wf_applications_job
          FOREIGN KEY (job_id) REFERENCES jobs(job_id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS application_status_history (
        history_id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        status ENUM('Applied', 'Under Review', 'Interview', 'Offer', 'Rejected') NOT NULL,
        changed_at DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_history_app (application_id),
        CONSTRAINT fk_wf_history_application
          FOREIGN KEY (application_id) REFERENCES applications(application_id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        reminder_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        application_id INT DEFAULT NULL,
        reminder_type ENUM('Interview', 'Follow-up', 'Application Deadline', 'Other') NOT NULL DEFAULT 'Interview',
        title VARCHAR(200) NOT NULL,
        reminder_datetime DATETIME NOT NULL,
        location VARCHAR(255) DEFAULT NULL,
        meeting_link VARCHAR(500) DEFAULT NULL,
        notify_offset VARCHAR(50) DEFAULT '1 hour before',
        notes TEXT DEFAULT NULL,
        is_completed TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reminders_user (user_id, is_completed, reminder_datetime),
        CONSTRAINT fk_wf_reminders_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE,
        CONSTRAINT fk_wf_reminders_application
          FOREIGN KEY (application_id) REFERENCES applications(application_id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // Seed the 6 initial XpressJobs.lk job listings once (INSERT IGNORE preserves existing rows)
    await pool.query(`
      INSERT IGNORE INTO jobs
        (job_id, title, company_name, location, job_type, description, requirements, closing_date, source, source_url, posted_at)
      VALUES
        (1, 'Software Engineer', 'ABC Company', 'Colombo, Sri Lanka', 'Full Time',
         'Develop, test, and maintain software applications. Work with the development team to design solutions, fix bugs and improve system performance.',
         'Bachelor''s degree in relevant field\nGood Knowledge in Kotlin / Java\nMinimum 2 years experience',
         '2026-07-31', 'XpressJobs.lk', 'https://xpress.jobs/jobs?search=Software+Engineer', DATE_SUB(NOW(), INTERVAL 2 DAY)),
        (2, 'UI / UX Designer', 'Tech Solutions (Pvt) Ltd', 'Jaffna, Sri Lanka', 'Full Time',
         'Design intuitive, user-centered mobile and web interfaces. Collaborate with product managers and engineers to create wireframes, prototypes, and high-fidelity mockups in Figma.',
         'Proficiency in Figma and modern UI/UX design principles\nStrong portfolio demonstrating mobile app design\n1+ years experience in UI/UX or HND/Degree in Computing',
         '2026-09-30', 'XpressJobs.lk', 'https://xpress.jobs/jobs?search=UI+UX+Designer', DATE_SUB(NOW(), INTERVAL 3 DAY)),
        (3, 'Mobile App Developer', 'YZ Hub', 'Colombo, Sri Lanka', 'Part Time',
         'Build and maintain cross-platform Android and iOS mobile applications using React Native and RESTful APIs.',
         'Hands-on experience with React Native and JavaScript/TypeScript\nFamiliarity with REST API integration and JWT authentication\nAbility to work 20 hours per week',
         '2026-08-15', 'XpressJobs.lk', 'https://xpress.jobs/jobs?search=Mobile+App+Developer', DATE_SUB(NOW(), INTERVAL 5 DAY)),
        (4, 'Software Engineering Intern', 'InnovaX (Pvt) Ltd', 'Colombo, Sri Lanka', 'Internship',
         'Join our engineering team for a 6-month paid internship working on full-stack web and mobile applications using Node.js, React Native, and MySQL.',
         'Currently pursuing or completed HND / BSc in Software Engineering or Computer Science\nBasic knowledge of JavaScript, Node.js, and SQL databases\nStrong problem-solving and teamwork skills',
         '2026-08-31', 'XpressJobs.lk', 'https://xpress.jobs/jobs?search=Software+Engineering+Intern', DATE_SUB(NOW(), INTERVAL 10 DAY)),
        (5, 'Backend Developer (Node.js)', 'Digital Hub', 'Colombo, Sri Lanka', 'Full Time',
         'Design and implement scalable REST APIs, database schemas, and background notification services using Node.js, Express, and MySQL.',
         'Strong proficiency in Node.js, Express.js, and relational databases (MySQL)\nExperience with JWT authentication and file handling\n1-2 years of backend development experience',
         '2026-09-15', 'XpressJobs.lk', 'https://xpress.jobs/jobs?search=Node.js+Developer', DATE_SUB(NOW(), INTERVAL 7 DAY)),
        (6, 'QA Automation Intern', 'ST Solutions', 'Colombo, Sri Lanka', 'Internship',
         'Assist the Quality Assurance team in writing unit tests, API tests in Postman, and conducting mobile usability testing on Android devices.',
         'Undergraduate or HND student in IT / Software Engineering\nFamiliarity with Postman, Jest, or manual test case writing\nKeen attention to detail',
         '2026-10-10', 'XpressJobs.lk', 'https://xpress.jobs/jobs?search=QA+Intern', DATE_SUB(NOW(), INTERVAL 4 DAY))
    `);

    console.log('Work Flow database schema verified & ready.');
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

module.exports = initDb;
