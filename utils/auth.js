const crypto = require('crypto');
const { AUTH_USER, AUTH_PASSWORD } = require('../config');

if (!AUTH_USER || !AUTH_PASSWORD) {
  throw new Error('AUTH_USER and AUTH_PASSWORD must be set');
}

// Hash both sides so timingSafeEqual gets equal-length buffers
const sha = (s) => crypto.createHash('sha256').update(s).digest();
const expected = sha(`${AUTH_USER}:${AUTH_PASSWORD}`);

// ponytail: single shared login via HTTP Basic Auth; add sessions/users if more than one person needs access
module.exports = (req, res, next) => {
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  const given = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString() : '';

  if (given && crypto.timingSafeEqual(sha(given), expected)) return next();

  res.set('WWW-Authenticate', 'Basic realm="ytdl", charset="UTF-8"');
  res.status(401).send('Authentication required');
};
