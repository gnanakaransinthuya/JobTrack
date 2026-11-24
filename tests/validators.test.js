const {
  validatePasswordPolicy,
  validateEmail,
  normalizeDateToSql,
  normalizeDateTimeToSql,
} = require('../src/utils/validators');

describe('Work Flow Validators — Unit Tests', () => {
  test('validatePasswordPolicy accepts strong passwords (8+ chars, upper, lower, number)', () => {
    expect(validatePasswordPolicy('Password123')).toBe(true);
    expect(validatePasswordPolicy('WorkFlow2026')).toBe(true);
  });

  test('validatePasswordPolicy rejects weak passwords', () => {
    expect(validatePasswordPolicy('short1A')).toBe(false);
    expect(validatePasswordPolicy('alllowercase1')).toBe(false);
    expect(validatePasswordPolicy('ALLUPPERCASE1')).toBe(false);
    expect(validatePasswordPolicy('NoNumbersHere')).toBe(false);
    expect(validatePasswordPolicy('')).toBe(false);
  });

  test('validateEmail validates standard email addresses', () => {
    expect(validateEmail('sinthuya@gmail.com')).toBe(true);
    expect(validateEmail('student@biet.lk')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('missing@domain')).toBe(false);
  });

  test('normalizeDateToSql supports both UI Sample DD / MM / YYYY and ISO YYYY-MM-DD', () => {
    expect(normalizeDateToSql('17 / 05 / 2026')).toBe('2026-05-17');
    expect(normalizeDateToSql('04/04/2026')).toBe('2026-04-04');
    expect(normalizeDateToSql('2026-07-31')).toBe('2026-07-31');
    expect(normalizeDateToSql('99/99/2026')).toBeNull();
    expect(normalizeDateToSql('invalid')).toBeNull();
  });

  test('normalizeDateTimeToSql parses DD / MM / YYYY with 12-hour AM/PM and 24-hour times', () => {
    expect(normalizeDateTimeToSql('15 / 05 / 2026 10:00 AM')).toBe('2026-05-15 10:00:00');
    expect(normalizeDateTimeToSql('15/05/2026 02:30 PM')).toBe('2026-05-15 14:30:00');
    expect(normalizeDateTimeToSql('2026-06-04 09:00:00')).toBe('2026-06-04 09:00:00');
    expect(normalizeDateTimeToSql('2026-11-25 12:00 AM')).toBe('2026-11-25 00:00:00');
  });
});
