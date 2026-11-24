# JobTrack — Smart Career Path Tracking System for Internships & Job Applications

> **Researcher:** Sinthuya Gnanakaran  
> **Supervisor:** Eng. Nisanthan  
> **Program:** Advanced Program in Software Engineering  
> **Institution:** Faculty of Computing, BIET Campus (2026)

---

## 1. Project Overview

**JobTrack** is a mobile-based personal career management system designed for students and job seekers in Sri Lanka. It centralizes job browsing and applying through **XpressJobs.lk** integration, personal application status tracking with timeline history, multiple CV version management, interview/deadline reminders with notifications, and a real-time analytics dashboard.

### 3-Tier Architecture
1. **Presentation Layer (Mobile App):** React Native (Expo SDK 58) Android application implementing all **22 screens** across 5 bottom navigation tabs (`Home`, `Jobs`, `Applications`, `Reminders`, `Profile`).
2. **Application Layer (Backend API — this repository):** Node.js + Express.js REST API with JWT authentication, `bcryptjs` password hashing, `multer` file uploads (PDF/DOCX CVs up to 5MB and profile avatars up to 3MB), status history logging, and dashboard analytics.
3. **Data Layer (Database):** MySQL relational database (`workflow_career_db` locally or cloud MySQL via `DATABASE_URL`) with 7 normalized tables and automatic schema initialization on startup.

---

## 2. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Mobile Frontend** | React Native (Expo), AsyncStorage, Expo Notifications, Expo Document Picker, Expo Image Picker |
| **Backend API** | Node.js, Express.js, `mysql2`, `jsonwebtoken` (JWT), `bcryptjs`, `multer`, `dotenv`, `cors` |
| **Database** | MySQL (XAMPP locally on Port `3307` / Aiven or TiDB Cloud MySQL with SSL in production) |
| **Testing Tools** | **Jest** + **Supertest** (Unit & Integration Tests), **Postman** (Collection Runner / Newman), **Android Emulator (Pixel 7)** |
| **Design** | Figma (22 high-fidelity UI screens, `#2563EB` Royal Blue theme) |

---

## 3. Key Features

* **Authentication & Security:** Registration with strong password policy validation, JWT login, Forgot Password with 30-minute expiring reset tokens, Change Password, and persistent login sessions.
* **Interactive Dashboard:** 4 live KPI cards (`Total Applications`, `Pending Applications`, `Upcoming Interviews`, `Successful Outcomes`), horizontal `Applications by Status` bar chart, `Recent Applications`, and live global search across both jobs and applications.
* **Job Browsing & XpressJobs.lk Integration:** Search and filter Sri Lankan tech jobs (`All`, `Internship`, `Full Time`, `Part Time`), bookmark/save jobs, open real listings on **XpressJobs.lk**, and automatically prompt **"Did you apply?"** upon returning to log the application and set a closing-date reminder.
* **Application Tracking & Status History:** Add/Edit/Delete applications (`DD / MM / YYYY` date support), attach specific CVs, update statuses (`Applied`, `Under Review`, `Interview`, `Offer`, `Rejected`), and view a deduplicated chronological Status History timeline.
* **Multiple CV Upload & Management:** Upload real PDF/DOCX resumes (max 5MB), categorize by role type, set a Default CV, download/open uploaded CVs, and delete CVs.
* **Reminders & Notifications:** Create reminders (`Interview`, `Follow-up`, `Application Deadline`, `Other`) with customizable alert offsets (`At the time`, `30 minutes before`, `1 hour before`, `2 hours before`, `1 day before`, `2 days before`), toggle Upcoming/Completed via Reminder Details modal, and receive live Android local notifications + in-app alert popups.
* **Profile Management:** Edit personal details, update profile photo directly from **Camera** or **Gallery**, and configure granular Notification Settings.

---

## 4. Database Schema (7 Normalized Tables)

On startup, `src/initDb.js` automatically verifies/creates all 7 tables and seeds the initial 6 XpressJobs.lk listings (safe & non-destructive):

1. `users` — Account credentials, profile fields, avatar path, notification preferences, and password reset tokens.
2. `cvs` — Uploaded CV metadata (`cv_title`, `role_type`, `file_name`, `file_path`, `file_type`, `file_size`, `is_default`).
3. `jobs` — Job listings with `XpressJobs.lk` source links, requirements, and closing dates.
4. `saved_jobs` — User-bookmarked jobs (`UNIQUE (user_id, job_id)`).
5. `applications` — Tracked applications linked to `users`, optional `cvs`, and optional `jobs`.
6. `application_status_history` — Chronological log of status changes per application.
7. `reminders` — Scheduled interview, follow-up, and deadline reminders linked to users/applications.

---

## 5. Folder Structure

```text
backend/
├── src/
│   ├── config/db.js                  # MySQL pool (supports local .env & cloud DATABASE_URL + SSL)
│   ├── middleware/
│   │   ├── auth.js                   # JWT Bearer authentication middleware
│   │   └── upload.js                 # Multer CV (PDF/DOCX, 5MB) & Avatar (3MB) upload config
│   ├── routes/
│   │   ├── authRoutes.js             # Register, Login, Forgot Password, Profile, Photo, Settings
│   │   ├── jobRoutes.js              # Browse jobs, Job details, Save/Unsave jobs
│   │   ├── applicationRoutes.js      # Applications CRUD & Status History updates
│   │   ├── cvRoutes.js               # Upload, List, Set Default, Delete CVs
│   │   ├── reminderRoutes.js         # Reminders CRUD & Upcoming/Completed toggle
│   │   └── dashboardRoutes.js        # Dashboard KPIs, Status Breakdown & Global Search
│   ├── utils/validators.js           # Password policy, email & DD/MM/YYYY date validators
│   ├── initDb.js                     # Non-destructive auto schema creation & job seeding
│   ├── seedDemoUser.js               # Seeds demo account once (never wipes user changes)
│   └── server.js                     # Express API entry point
├── tests/
│   ├── validators.test.js            # Jest unit tests (5 tests)
│   └── api.test.js                   # Jest + Supertest integration tests (9 tests)
├── Work_Flow_Postman_Collection.json # Ready-to-import Postman v2.1 suite (22 requests, 42 tests)
├── render.yaml                       # Render.com Free Web Service deployment blueprint
└── package.json
```

---

## 6. How to Run Locally

### Prerequisites
* **Node.js** v18+ (tested on v26)
* **MySQL** (e.g., XAMPP MySQL running on Port `3307` or `3306`)

### Step 1: Configure Environment Variables
Create a `.env` file in the `backend/` folder:

```env
PORT=5001
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=workflow_career_db
JWT_SECRET=work_flow_biet_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d
```

*(For cloud MySQL such as Aiven or TiDB Cloud, you only need `DATABASE_URL=mysql://user:pass@host:port/db?ssl-mode=REQUIRED`, `JWT_SECRET`, and `JWT_EXPIRES_IN=7d`.)*

### Step 2: Install Dependencies & Start the API
```bash
npm install
npm start
```

Verify the server is live at:
* **Root:** `http://localhost:5001/`
* **Health Check:** `http://localhost:5001/api/health`

### Step 3: Run the React Native Mobile App (from `WorkFlow/mobile`)
```bash
cd ../mobile
npm install
npx expo start
```
* Press **`a`** to open on an Android Emulator (`Pixel_7`), press **`w`** for Web preview, or install **`JobTrack.apk`** directly on Android.

---

## 7. API Endpoints Reference

| Module | Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :---: | :--- |
| **Health** | `GET` | `/api/health` | No | Checks API status & MySQL connectivity |
| **Auth** | `POST` | `/api/auth/register` | No | Register a new user account |
| **Auth** | `POST` | `/api/auth/login` | No | Authenticate and return JWT token |
| **Auth** | `POST` | `/api/auth/forgot-password` | No | Generate 30-min password reset token |
| **Profile** | `GET` | `/api/auth/me` | JWT | Fetch current user profile & preferences |
| **Profile** | `PUT` | `/api/auth/profile` | JWT | Update full name, phone, campus, field |
| **Profile** | `POST` | `/api/auth/profile/photo` | JWT | Upload profile avatar (`multipart/form-data`) |
| **Profile** | `PUT` | `/api/auth/change-password` | JWT | Verify current password & update password |
| **Profile** | `PUT` | `/api/auth/notification-settings` | JWT | Save reminder notification preferences |
| **Dashboard** | `GET` | `/api/dashboard` | JWT | KPI metrics, status breakdown & recent apps |
| **Dashboard** | `GET` | `/api/dashboard/search?q=` | JWT | Search across both jobs and applications |
| **Jobs** | `GET` | `/api/jobs?search=&type=` | JWT | List/filter XpressJobs.lk job listings |
| **Jobs** | `GET` | `/api/jobs/:id` | JWT | Get job details & requirements |
| **Jobs** | `POST` | `/api/jobs/:id/save` | JWT | Bookmark or unbookmark a job |
| **Jobs** | `GET` | `/api/jobs/saved/list` | JWT | List user's saved jobs |
| **Applications** | `GET` | `/api/applications?search=&status=` | JWT | List/filter user applications |
| **Applications** | `GET` | `/api/applications/:id` | JWT | Get application details, status history & reminders |
| **Applications** | `POST` | `/api/applications` | JWT | Create application (+ optional inline reminder) |
| **Applications** | `PATCH` | `/api/applications/:id/status` | JWT | Update status & append to history timeline |
| **Applications** | `PUT` | `/api/applications/:id` | JWT | Edit full application details |
| **Applications** | `DELETE` | `/api/applications/:id` | JWT | Delete an application |
| **CVs** | `GET` | `/api/cvs` | JWT | List uploaded CVs |
| **CVs** | `POST` | `/api/cvs` | JWT | Upload PDF/DOCX CV (`multipart/form-data`) |
| **CVs** | `PATCH` | `/api/cvs/:id/default` | JWT | Set CV as default |
| **CVs** | `DELETE` | `/api/cvs/:id` | JWT | Delete a CV file & record |
| **Reminders** | `GET` | `/api/reminders?tab=upcoming\|completed` | JWT | List upcoming or completed reminders |
| **Reminders** | `POST` | `/api/reminders` | JWT | Create a new reminder |
| **Reminders** | `PATCH` | `/api/reminders/:id/toggle` | JWT | Toggle upcoming / completed state |
| **Reminders** | `DELETE` | `/api/reminders/:id` | JWT | Delete a reminder |

---

## 8. Running Tests

### Jest Unit & Integration Tests (14 Tests)
```bash
npm test
```
* `tests/validators.test.js` — 5 unit tests (password policy, email validation, `DD / MM / YYYY` date & datetime parsing).
* `tests/api.test.js` — 9 full API integration tests (self-contained QA user, real PDF upload, CRUD + status history, dashboard KPIs & search).

### Postman API Collection (22 Requests, 42 Automated Assertions)
1. Open **Postman** → **Import** → select `Work_Flow_Postman_Collection.json`.
2. Click **`...` → Run collection** to execute all 22 requests and 42 automated assertions cleanly.
3. Or run via CLI:
   ```bash
   npx newman run Work_Flow_Postman_Collection.json
   ```

---

## 9. Cloud Deployment (Render.com + Aiven/TiDB Free MySQL)

1. Create a free MySQL instance on **Aiven.io** (or **TiDB Cloud**) and copy the **Service URI** (`DATABASE_URL`).
2. In **Render.com**, create a new **Web Service** linked to this GitHub repository:
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Environment Variables:** `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`
3. Verify `https://<your-render-url>/api/health` returns `"status": "ok"`.
4. Set `EXPO_PUBLIC_API_URL=https://<your-render-url>` in `mobile/.env` and build `JobTrack.apk`.

---

## 10. Demo Account Credentials

* **Email:** `sinthuya@gmail.com`
* **Password:** `Password123` *(seeded automatically on first boot of a fresh database)*
