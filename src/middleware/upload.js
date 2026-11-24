const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads/cvs');
const avatarsDir = path.join(__dirname, '../../uploads/avatars');

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(avatarsDir, { recursive: true });

const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const uploadCV = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max (Matches Upload CV UI Sample)
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(pdf|doc|docx)$/i;
    const allowedMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ];
    if (allowedExt.test(file.originalname) || allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed (Max 5MB).'));
    }
  },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg') || '.jpg';
    cb(null, `avatar_${req.user?.user_id || 'u'}_${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB max
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(png|jpg|jpeg|webp)$/i;
    if (allowedExt.test(file.originalname) || (file.mimetype && file.mimetype.startsWith('image/'))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, WEBP) are allowed.'));
    }
  },
});

module.exports = {
  uploadCV,
  uploadAvatar,
  uploadsDir,
  avatarsDir,
};
