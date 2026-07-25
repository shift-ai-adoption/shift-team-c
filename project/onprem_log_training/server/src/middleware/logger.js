const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_PATH = path.join(LOG_DIR, 'service.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function genTrackId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 7);
}

function iso(now) {
  return new Date(now).toISOString();
}

function writeLine(level, trackId, req, extra) {
  const ts = iso(Date.now());
  const parts = [
    ts,
    level.padEnd(5, ' '),
    `TrackID:${trackId}`,
    `[${req.originalUrl || req.url}]`,
    `method=${req.method}`,
  ];
  for (const [k, v] of Object.entries(extra || {})) {
    parts.push(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  const line = parts.join(' ') + '\n';
  fs.appendFileSync(LOG_PATH, line);
}

// client から届いた X-Track-Id を優先して使う。直接curl等で叩かれた場合のみ自前生成する。
function requestLogger(req, res, next) {
  const trackId = req.get('X-Track-Id') || genTrackId();
  req.trackId = trackId;
  const start = Date.now();

  writeLine('INFO', trackId, req, {});

  res.on('finish', () => {
    const latency_ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    writeLine(level, trackId, req, {
      status: res.statusCode,
      latency_ms,
    });
  });

  next();
}

function logError(req, err) {
  const trackId = req.trackId || genTrackId();
  const stackTop = (err.stack || '').split('\n')[1] || '';
  writeLine('ERROR', trackId, req, {
    status: 500,
    err: `${err.name}: ${err.message}`,
    at: stackTop.trim(),
  });
}

function logAction(req, serviceName, extra) {
  const trackId = req.trackId || genTrackId();
  writeLine('INFO', trackId, req, { service: serviceName, ...extra });
}

module.exports = { requestLogger, logError, logAction, LOG_PATH };
