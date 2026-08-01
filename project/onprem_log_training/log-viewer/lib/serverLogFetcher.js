// lib/serverLogFetcher.js
'use strict';
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SSH_CONFIG = {
  host: process.env.SSH_HOST || 'localhost',
  port: parseInt(process.env.SSH_PORT) || 5101,
  username: 'trainee',
  privateKey: (() => {
    const keyPath = process.env.SSH_KEY_PATH ||
      path.resolve(__dirname, '../../../docker/sample-data/training_key');
    return fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : null;
  })(),
  readyTimeout: 5000,
};

const REMOTE_LOG = '/app/logs/service.log';

function execSSH(cmd) {
  return new Promise((resolve, reject) => {
    if (!SSH_CONFIG.privateKey) return reject(new Error('SSH key not found'));
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        let out = '';
        stream.on('data', d => { out += d; });
        stream.stderr.on('data', () => {});
        stream.on('close', () => { conn.end(); resolve(out.split('\n').filter(Boolean)); });
      });
    });
    conn.on('error', reject);
    conn.connect(SSH_CONFIG);
  });
}

/**
 * serverログの末尾N行を取得
 * @param {number} [lines=500]
 * @returns {Promise<string[]>}
 */
async function fetchServerLog(lines = 500) {
  return execSSH(`tail -n ${lines} ${REMOTE_LOG}`);
}

/**
 * 特定TrackIDの行を検索
 * @param {string} trackId
 * @returns {Promise<string[]>}
 */
async function grepServerLog(trackId) {
  return execSSH(`grep "TrackID:${trackId}" ${REMOTE_LOG}`);
}

/**
 * SSH接続が可能かチェック
 * @returns {Promise<boolean>}
 */
async function checkReachable() {
  try {
    await execSSH('echo ok');
    return true;
  } catch {
    return false;
  }
}

module.exports = { fetchServerLog, grepServerLog, checkReachable };
