import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { hashPassword, verifyPassword } from '../security/passwords.js';
import { publicUser } from '../security/access.js';
import { requireLogin } from '../middleware/auth.js';
import { recordAudit } from '../services/grade-sheets.js';

export async function authRoutes(models) {
  const router = Router();
  const dummyHash = await hashPassword(randomBytes(24).toString('hex'));
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
  });

  router.get('/csrf', (req, res) => {
    req.session.csrfToken ||= randomBytes(32).toString('hex');
    res.json({ csrfToken: req.session.csrfToken });
  });
  router.post('/login', loginLimit, async (req, res) => {
    const { email, password } = req.body || {};
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.length > 150 ||
      password.length > 256
    ) {
      return res.status(400).json({ error: 'Enter a valid email and password.' });
    }
    const user = await models.User.findOne({ email: email.trim().toLowerCase() }).select(
      '+passwordHash',
    );
    const valid = await verifyPassword(password, user?.passwordHash || dummyHash);
    if (!user || !valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await new Promise((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.userId = user._id.toString();
    req.session.csrfToken = randomBytes(32).toString('hex');
    await recordAudit(models, user, 'login', 'allowed', 'Signed in successfully.');
    await new Promise((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    );
    res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  });
  router.get('/me', requireLogin(models), (req, res) => res.json({ user: publicUser(req.user) }));
  router.post('/logout', requireLogin(models), async (req, res) => {
    await recordAudit(models, req.user, 'logout', 'allowed', 'Signed out.');
    await new Promise((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie('academic.sid', { path: '/', sameSite: 'strict', httpOnly: true });
    res.json({ message: 'Signed out.' });
  });
  return router;
}
