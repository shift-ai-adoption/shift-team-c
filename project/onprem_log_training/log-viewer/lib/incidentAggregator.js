// lib/incidentAggregator.js
'use strict';
const { readClientLog, parseLine } = require('./clientLogReader');
const { fetchServerLog } = require('./serverLogFetcher');

/**
 * TrackIDでclient/serverログを紐づけたインシデント一覧を返す（新しい順）
 * @returns {Promise<Array>}
 */
async function aggregateIncidents() {
  const clientLines = readClientLog(500);

  let serverLines = [];
  try {
    serverLines = await fetchServerLog(500);
  } catch (e) {
    console.warn('[serverLogFetcher] SSH failed:', e.message);
  }

  // serverログをTrackIDでインデックス化
  const serverIndex = {};
  for (const line of serverLines) {
    const m = line.match(/TrackID:([A-Z0-9]{7})/);
    if (m) {
      const id = m[1];
      if (!serverIndex[id]) serverIndex[id] = [];
      serverIndex[id].push(line);
    }
  }

  // clientログをパースしてインシデントを構築
  const incidents = {};
  for (const line of clientLines) {
    const p = parseLine(line);
    if (!p.trackId) continue;
    const id = p.trackId;
    if (!incidents[id]) {
      incidents[id] = {
        trackId: id,
        level: p.level || 'UNKNOWN',
        timestamp: p.timestamp,
        path: p.path,
        clientLogs: [],
        serverLogs: serverIndex[id] || [],
      };
    }
    incidents[id].clientLogs.push(line);
    // 最も深刻なレベルを保持
    if (p.level === 'ERROR') incidents[id].level = 'ERROR';
    // 最新タイムスタンプを保持
    if (p.timestamp && (!incidents[id].timestamp || p.timestamp > incidents[id].timestamp)) {
      incidents[id].timestamp = p.timestamp;
    }
  }

  return Object.values(incidents).sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  );
}

module.exports = { aggregateIncidents };
