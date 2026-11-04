import { timingSafeEqual } from 'node:crypto';

export function requireLogin(models) {
  return async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Please sign in first.' });
    const user = await models.User.findById(req.session.userId);
    if (!user)
      return res
        .status(401)
        .json({ error: 'This account no longer exists. Please sign in again.' });
    req.user = user;
    next();
  };
}

export function requireFaculty(req, res, next) {
  if (req.user.role !== 'faculty')
    return res.status(403).json({ error: 'Only faculty can upload grade sheets.' });
  next();
}

export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const provided = req.get('X-CSRF-Token') || '';
  const expected = req.session.csrfToken || '';
  const origin = req.get('Origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ error: 'Requests must come from this application.' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (!b.length || a.length !== b.length || !timingSafeEqual(a, b)) {
    return res
      .status(403)
      .json({ error: 'Your page session has changed. Reload the page and try again.' });
  }
  next();
}
