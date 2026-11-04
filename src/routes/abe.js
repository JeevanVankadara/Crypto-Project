import { Router } from 'express';
import multer from 'multer';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { requireLogin, requireFaculty } from '../middleware/auth.js';
import { visibleGradeQuery } from '../security/access.js';
import { recordAudit } from '../services/grade-sheets.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 3, fieldSize: 300 },
});
export const abePolicy = (id, department) =>
  `student_${id.toLowerCase()} OR (role_faculty AND dept_${department.toLowerCase()})`;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function abeRoutes({ config, models }) {
  const router = Router();
  const directory = path.join(config.dataDir, 'abe-encrypted-files');
  async function parameters() {
    return JSON.parse(await readFile(path.join(config.dataDir, 'abe', 'public.json'), 'utf8'));
  }
  router.use(requireLogin(models));
  router.get('/public', async (req, res) => {
    try {
      res.json(await parameters());
    } catch {
      res.status(503).json({ error: 'Run npm run abe:setup to initialize the ABE authority.' });
    }
  });
  router.get('/records', async (req, res) => {
    const sheets = await models.ABEGradeSheet.find(visibleGradeQuery(req.user))
      .select('fileId studentId department semester title sizeBytes createdAt -_id')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ sheets });
  });
  router.post('/records', requireFaculty, upload.single('file'), async (req, res) => {
    const { studentId, semester, title } = req.body;
    if (
      typeof studentId !== 'string' ||
      !/^[A-Z0-9]{3,20}$/.test(studentId) ||
      !/^[1-8]$/.test(semester || '') ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.length > 100
    )
      return res.status(400).json({ error: 'Provide a student, semester, and title.' });
    const student = await models.User.findOne({
      role: 'student',
      studentId,
      department: req.user.department,
    });
    if (!student) return res.status(403).json({ error: 'Choose a student in your department.' });
    let envelope;
    try {
      envelope = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Upload a browser-encrypted ABE package.' });
    }
    const h = envelope?.header;
    const params = await parameters();
    const filename = `${studentId}-semester-${semester}.pdf`;
    if (
      !h ||
      !uuid.test(h.fileId || '') ||
      h.version !== 1 ||
      h.scheme !== 'FAME-AES-256-GCM' ||
      h.publicId !== params.publicId ||
      h.policy !== abePolicy(studentId, req.user.department) ||
      h.filename !== filename ||
      typeof envelope.ciphertext !== 'string' ||
      typeof envelope.nonce !== 'string' ||
      Buffer.from(envelope.nonce, 'base64').length !== 12 ||
      Buffer.from(envelope.ciphertext, 'base64').length < 16 ||
      Buffer.from(envelope.ciphertext, 'base64').length > 5 * 1024 * 1024 + 16 ||
      !h.capsule ||
      JSON.stringify(h).length > 20000
    )
      return res.status(400).json({ error: 'Invalid encrypted package or policy.' });
    // Store only the defined encrypted envelope fields; discard unrelated submitted fields.
    const packet = JSON.stringify({
      header: h,
      nonce: envelope.nonce,
      ciphertext: envelope.ciphertext,
    });
    await mkdir(directory, { recursive: true });
    const filenameOnDisk = path.join(directory, `${h.fileId}.abe.json`);
    try {
      await writeFile(filenameOnDisk, packet, { flag: 'wx' });
    } catch (error) {
      if (error.code === 'EEXIST')
        return res.status(409).json({ error: 'This encrypted file already exists.' });
      throw error;
    }
    try {
      await models.ABEGradeSheet.create({
        fileId: h.fileId,
        studentId,
        department: req.user.department,
        semester,
        title: title.trim(),
        originalName: filename,
        sizeBytes: Buffer.byteLength(packet),
        uploadedBy: req.user._id,
      });
    } catch (error) {
      await unlink(filenameOnDisk).catch(() => {});
      throw error;
    }
    await recordAudit(
      models,
      req.user,
      'abe-upload',
      'allowed',
      'Stored an ABE-encrypted package; server received no plaintext PDF or file key.',
      h.fileId,
    );
    res.status(201).json({ fileId: h.fileId, message: 'Encrypted ABE package stored.' });
  });
  router.get('/records/:fileId/package', async (req, res) => {
    if (!uuid.test(req.params.fileId))
      return res.status(400).json({ error: 'Enter a valid file ID.' });
    const sheet = await models.ABEGradeSheet.findOne({ fileId: req.params.fileId });
    if (!sheet) return res.status(404).json({ error: 'Encrypted package not found.' });
    // Intentional: any signed-in demo user can obtain ciphertext by ID.
    // The recipient's local attribute key, not a server role check, controls decryption.
    let data;
    try {
      data = await readFile(path.join(directory, `${sheet.fileId}.abe.json`));
    } catch {
      return res.status(409).json({ error: 'Encrypted package is missing.' });
    }
    await recordAudit(
      models,
      req.user,
      'abe-download',
      'allowed',
      'Transferred ciphertext only. Browser decryption outcome is not observable by the server.',
      sheet.fileId,
    );
    res.type('application/json').attachment(`${sheet.fileId}.abe.json`).send(data);
  });
  return router;
}
