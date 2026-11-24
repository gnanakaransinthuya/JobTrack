// Reusable validation & formatting helpers (unit tested with Jest)

const VALID_APPLICATION_STATUSES = [
  'Applied',
  'Under Review',
  'Interview',
  'Offer',
  'Rejected',
];

const VALID_JOB_TYPES = ['Full Time', 'Part Time', 'Internship', 'Contract'];

const VALID_REMINDER_TYPES = [
  'Interview',
  'Follow-up',
  'Application Deadline',
  'Other',
];

/**
 * Matches Register & Change Password Screen policy:
 * "Use at least 8 characters with a number, upper case and lower case letter."
 */
function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasUpper && hasLower && hasNumber;
}

function validateEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Accepts both YYYY-MM-DD and DD / MM / YYYY (or DD/MM/YYYY or DD-MM-YYYY)
 * and returns a MySQL-ready YYYY-MM-DD date string, or null if invalid.
 */
function normalizeDateToSql(input) {
  if (!input) return null;
  const str = String(input).trim();

  // ISO / SQL format: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  // UI Sample format: DD / MM / YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  return null;
}

/**
 * Normalizes reminder datetime input into MySQL DATETIME "YYYY-MM-DD HH:MM:SS".
 */
function normalizeDateTimeToSql(input) {
  if (!input) return null;
  const str = String(input).trim().replace('T', ' ');
  const parts = str.split(/\s+/);
  if (parts.length === 0) return null;

  // Handle "DD / MM / YYYY 10:00 AM" or "YYYY-MM-DD 10:00:00"
  const dmyPrefix = str.match(/^(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})\s*(.*)$/);
  let datePart = parts[0];
  let timeRest = parts.slice(1).join(' ');

  if (dmyPrefix) {
    datePart = dmyPrefix[1];
    timeRest = dmyPrefix[2] || '09:00';
  }

  const sqlDate = normalizeDateToSql(datePart);
  if (!sqlDate) return null;

  const cleanTime = (timeRest || '09:00').trim().toUpperCase();
  const isPM = cleanTime.includes('PM');
  const isAM = cleanTime.includes('AM');
  const numericTime = cleanTime.replace(/AM|PM/g, '').trim();
  const [hRaw = '09', mRaw = '00', sRaw = '00'] = numericTime.split(':');

  let h = parseInt(hRaw, 10);
  const m = parseInt(mRaw, 10);
  const s = parseInt(sRaw, 10);

  if (Number.isNaN(h) || Number.isNaN(m)) return `${sqlDate} 09:00:00`;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  h = Math.max(0, Math.min(23, h));
  const mm = Math.max(0, Math.min(59, m));
  const ss = Number.isNaN(s) ? 0 : Math.max(0, Math.min(59, s));

  return `${sqlDate} ${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

module.exports = {
  VALID_APPLICATION_STATUSES,
  VALID_JOB_TYPES,
  VALID_REMINDER_TYPES,
  validatePasswordPolicy,
  validateEmail,
  normalizeDateToSql,
  normalizeDateTimeToSql,
};
