const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const authenticateToken = require('../middleware/auth');
const { uploadCV, uploadsDir } = require('../middleware/upload');

const router = express.Router();

// GET /api/cvs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [cvs] = await pool.query(
      `SELECT * FROM cvs
       WHERE user_id = ?
       ORDER BY is_default DESC, uploaded_at DESC`,
      [req.user.user_id]
    );
    res.json({ cvs });
  } catch (err) {
    console.error('Get CVs error:', err);
    res.status(500).json({ message: 'Server error fetching CVs.' });
  }
});

// POST /api/cvs
router.post('/', authenticateToken, (req, res) => {
  uploadCV.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        message: uploadErr.message || 'CV upload failed (PDF/DOCX, Max 5MB).',
      });
    }

    try {
      const { cv_title, role_type = 'Software Engineering', is_default, file_name_override } = req.body;
      const shouldBeDefault =
        is_default === 'true' || is_default === true || is_default === '1' || is_default === 1;

      let fileName;
      let filePath;
      let fileType = 'application/pdf';
      let fileSize = 0;

      if (req.file) {
        fileName = req.file.originalname;
        filePath = `/uploads/cvs/${req.file.filename}`;
        fileType = req.file.mimetype || 'application/pdf';
        fileSize = req.file.size;
      } else if (file_name_override) {
        fileName = file_name_override;
        const diskFile = `wf_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const fullDiskPath = path.join(uploadsDir, diskFile);
        const content = `%PDF-1.4\n% Work Flow CV: ${cv_title || fileName}\n`;
        fs.writeFileSync(fullDiskPath, content);
        filePath = `/uploads/cvs/${diskFile}`;
        fileSize = Buffer.byteLength(content);
      } else {
        return res.status(400).json({ message: 'Please select a PDF or DOCX file to upload.' });
      }

      const [existingCvs] = await pool.query('SELECT cv_id FROM cvs WHERE user_id = ?', [
        req.user.user_id,
      ]);
      const finalDefault = existingCvs.length === 0 ? 1 : shouldBeDefault ? 1 : 0;

      if (finalDefault === 1) {
        await pool.query('UPDATE cvs SET is_default = 0 WHERE user_id = ?', [req.user.user_id]);
      }

      const titleToSave = (cv_title && cv_title.trim()) || fileName.replace(/\.[^/.]+$/, '');

      const [result] = await pool.query(
        `INSERT INTO cvs (user_id, cv_title, role_type, file_name, file_path, file_type, file_size, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.user_id,
          titleToSave,
          role_type,
          fileName,
          filePath,
          fileType,
          fileSize,
          finalDefault,
        ]
      );

      const [created] = await pool.query('SELECT * FROM cvs WHERE cv_id = ?', [result.insertId]);

      res.status(201).json({
        message: 'CV uploaded successfully.',
        cv: created[0],
      });
    } catch (err) {
      console.error('Save CV error:', err);
      res.status(500).json({ message: 'Server error saving CV.' });
    }
  });
});

// PATCH /api/cvs/:id/default
router.patch('/:id/default', authenticateToken, async (req, res) => {
  try {
    const cvId = Number(req.params.id);
    const [existing] = await pool.query(
      'SELECT cv_id FROM cvs WHERE cv_id = ? AND user_id = ?',
      [cvId, req.user.user_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'CV not found.' });
    }

    await pool.query('UPDATE cvs SET is_default = 0 WHERE user_id = ?', [req.user.user_id]);
    await pool.query('UPDATE cvs SET is_default = 1 WHERE cv_id = ? AND user_id = ?', [
      cvId,
      req.user.user_id,
    ]);

    res.json({ message: 'Default CV updated.' });
  } catch (err) {
    console.error('Set default CV error:', err);
    res.status(500).json({ message: 'Server error setting default CV.' });
  }
});

// DELETE /api/cvs/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const cvId = Number(req.params.id);
    const [existing] = await pool.query(
      'SELECT * FROM cvs WHERE cv_id = ? AND user_id = ?',
      [cvId, req.user.user_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'CV not found.' });
    }

    const cv = existing[0];
    await pool.query('DELETE FROM cvs WHERE cv_id = ? AND user_id = ?', [cvId, req.user.user_id]);

    if (cv.file_path) {
      const diskPath = path.join(__dirname, '../..', cv.file_path);
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch (_) {}
      }
    }

    if (cv.is_default) {
      const [remaining] = await pool.query(
        'SELECT cv_id FROM cvs WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1',
        [req.user.user_id]
      );
      if (remaining.length > 0) {
        await pool.query('UPDATE cvs SET is_default = 1 WHERE cv_id = ?', [remaining[0].cv_id]);
      }
    }

    res.json({ message: 'CV deleted successfully.' });
  } catch (err) {
    console.error('Delete CV error:', err);
    res.status(500).json({ message: 'Server error deleting CV.' });
  }
});

module.exports = router;
