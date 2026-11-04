import { Router } from 'express';
import multer from 'multer';
import { requireLogin, requireFaculty } from '../middleware/auth.js';
import { canReadGradeSheet, visibleGradeQuery } from '../security/access.js';
import { saveGradeSheet, openGradeSheet, recordAudit } from '../services/grade-sheets.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 300 },
});
const validFileId = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function gradeRoutes(context) {
  const { models } = context;
  const router = Router();
  router.use(requireLogin(models));

  router.get('/', async (req, res) => {
    const sheets = await models.GradeSheet.find(visibleGradeQuery(req.user))
      .select('fileId studentId department semester title sizeBytes createdAt -_id')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ sheets });
  });

  router.post('/', requireFaculty, upload.single('file'), async (req, res) => {
    const { studentId, semester, title } = req.body;
    if (
      typeof studentId !== 'string' ||
      !/^[A-Z0-9]{3,20}$/.test(studentId) ||
      typeof semester !== 'string' ||
      !/^[1-8]$/.test(semester) ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 100
    ) {
      return res.status(400).json({
        error: 'Choose a student, a semester from 1 to 8, and a title up to 100 characters.',
      });
    }
    const student = await models.User.findOne({
      studentId,
      role: 'student',
      department: req.user.department,
    });
    if (!student)
      return res
        .status(403)
        .json({ error: 'You can upload only for students in your department.' });
    const file = req.file;
    if (
      !file ||
      file.mimetype !== 'application/pdf' ||
      file.buffer.subarray(0, 5).toString() !== '%PDF-' ||
      !file.buffer.subarray(-1024).includes(Buffer.from('%%EOF'))
    ) {
      return res.status(400).json({ error: 'Choose a PDF grade sheet, up to 5 MB.' });
    }
    const sheet = await saveGradeSheet(context, {
      buffer: file.buffer,
      studentId,
      department: req.user.department,
      semester,
      title: title.trim(),
      originalName: `${studentId}-semester-${semester}.pdf`,
      uploadedBy: req.user._id,
    });
    await recordAudit(
      models,
      req.user,
      'upload',
      'allowed',
      `Uploaded a grade sheet for ${studentId}.`,
      sheet.fileId,
    );
    res.status(201).json({ message: 'Grade sheet encrypted and saved.', fileId: sheet.fileId });
  });

  router.get('/:fileId/download', async (req, res) => {
    const { fileId } = req.params;
    if (!validFileId.test(fileId))
      return res.status(400).json({ error: 'Enter a valid grade-sheet file ID.' });
    const sheet = await models.GradeSheet.findOne({ fileId });
    if (!sheet) return res.status(404).json({ error: 'Grade sheet not found.' });
    if (!canReadGradeSheet(req.user, sheet)) {
      await recordAudit(
        models,
        req.user,
        'download',
        'denied',
        'The account does not have access to this grade sheet.',
        fileId,
      );
      return res.status(403).json({
        error:
          'Access denied. Students can open only their own sheets; faculty can open only their department’s sheets.',
      });
    }
    let plaintext;
    try {
      plaintext = await openGradeSheet(context, fileId);
    } catch {
      await recordAudit(
        models,
        req.user,
        'download',
        'failed',
        'The stored file could not be authenticated or opened.',
        fileId,
      );
      return res
        .status(409)
        .json({ error: 'The stored file is missing or damaged. No grade sheet was released.' });
    }
    await recordAudit(
      models,
      req.user,
      'download',
      'allowed',
      'Access approved; the server decrypted the grade sheet.',
      fileId,
    );
    res.type('application/pdf');
    res.attachment(sheet.originalName);
    res.send(plaintext);
  });
  return router;
}
