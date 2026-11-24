const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'work_flow_biet_super_secret_jwt_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

module.exports = authenticateToken;
