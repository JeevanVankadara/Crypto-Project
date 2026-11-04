import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { authRoutes } from './routes/auth.js';
import { gradeRoutes } from './routes/grade-sheets.js';
import { requireCsrf, requireLogin, requireFaculty } from './middleware/auth.js';

export async function createApp(context) {
  const { connection, models, secrets } = context;
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      strictTransportSecurity: false,
    }),
  );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (req, res) =>
    res.status(connection.readyState === 1 ? 200 : 503).json({
      status: connection.readyState === 1 ? 'ok' : 'unavailable',
      database: 'local MongoDB',
      phase: 'baseline',
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  const store = MongoStore.create({
    client: connection.getClient(),
    dbName: connection.name,
    collectionName: 'sessions',
    ttl: 60 * 60 * 2,
  });
  store.on('error', () => console.error('Session storage is unavailable. Check local MongoDB.'));
  app.use(
    '/api',
    session({
      name: 'academic.sid',
      secret: secrets.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'strict', secure: false, maxAge: 2 * 60 * 60 * 1000 },
    }),
  );
  app.use('/api', requireCsrf);
  app.use('/api/auth', await authRoutes(models));
  app.use('/api/grade-sheets', gradeRoutes(context));
  app.get('/api/students', requireLogin(models), requireFaculty, async (req, res) => {
    const students = await models.User.find({ role: 'student', department: req.user.department })
      .select('name studentId -_id')
      .sort({ studentId: 1 })
      .lean();
    res.json({ students });
  });
  app.get('/api/activity', requireLogin(models), async (req, res) => {
    const filter =
      req.user.role === 'faculty' ? { department: req.user.department } : { actorId: req.user._id };
    const events = await models.AuditEvent.find(filter)
      .select('actorName action outcome detail fileId createdAt -_id')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json({ events });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'This API route does not exist.' }));
  app.use(
    express.static(fileURLToPath(new URL('../public/', import.meta.url)), {
      index: 'index.html',
      dotfiles: 'deny',
    }),
  );
  app.use((req, res) => res.status(404).send('Page not found.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        error:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'The PDF must be 5 MB or smaller.'
            : 'Upload one PDF with the requested fields only.',
      });
    }
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'The request contains invalid JSON.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'The request is too large.' });
    console.error(`Request failed: ${error.name}`);
    res
      .status(500)
      .json({ error: 'The request could not be completed. Check that local MongoDB is running.' });
  });
  return app;
}
