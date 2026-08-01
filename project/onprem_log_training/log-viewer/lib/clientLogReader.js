// lib/clientLogReader.js
'use strict';
const fs = require('fs');
const path = require('path');

const LOG_PATH = process.env.CLIENT_LOG_PATH ||
  path.resolve(__dirname, '../../client/logs/app.log');

const TRACK_REGEX = /TrackID:([A-Z0-9]{7})/;
const LINE_REGEX = /^(\S+)\s+(INFO|ERROR|WARN|DEBUG)\s+TrackID:([A-Z0-9]{7})\s+\[([^\]]+)\](.*)/;

/**
 * clientログを末尾からlimit行読み込む
 * @param {number} [limit=500]
 * @returns {string[]}
 */
function readClientLog(limit = 500) {
  if (!fs.existsSync(LOG_PATH)) return [];
  const content = fs.readFileSync(LOG_PATH, 'utf-8');
  return content.split('\n').filter(Boolean).slice(-limit);
}

/**
 * 1行をパースして構造化オブジェクトを返す
 * @param {string} line
 * @returns {{ timestamp, level, trackId, path, details, raw }}
 */
function parseLine(line) {
  const m = line.match(LINE_REGEX);
  if (!m) {
    const idMatch = line.match(TRACK_REGEX);
    return { timestamp: null, level: null, trackId: idMatch ? idMatch[1] : null, path: null, details: '', raw: line };
  }
  return {
    timestamp: m[1],
    level: m[2],
    trackId: m[3],
    path: m[4],
    details: m[5].trim(),
    raw: line,
  };
}

module.exports = { readClientLog, parseLine };
