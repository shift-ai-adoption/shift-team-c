// lib/statsAnalyzer.js
'use strict';
const { parseLine } = require('./clientLogReader');

/**
 * インシデント一覧からダッシュボード用サマリーを生成する
 * @param {Array} incidents - incidentAggregator.aggregateIncidents() の戻り値
 * @param {boolean} serverReachable - SSHが届いているか
 * @returns {object} summary
 */
function buildSummary(incidents, serverReachable = false) {
  const allClientLines = incidents.flatMap(i => i.clientLogs);
  const parsed = allClientLines.map(parseLine);

  // レベル別カウント
  const levelCounts = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, UNKNOWN: 0 };
  for (const p of parsed) {
    const l = p.level || 'UNKNOWN';
    levelCounts[l] = (levelCounts[l] || 0) + 1;
  }

  // 開始時刻・終了時刻（ログ内の最古・最新タイムスタンプ）
  const timestamps = parsed
    .map(p => p.timestamp)
    .filter(Boolean)
    .sort();
  const startTime = timestamps[0] || null;
  const endTime = timestamps[timestamps.length - 1] || null;
  const durationMinutes = startTime && endTime
    ? Math.round((new Date(endTime) - new Date(startTime)) / 60000 * 100) / 100
    : null;

  // エラーパス ランキング Top10
  const pathCount = {};
  for (const p of parsed.filter(p => p.level === 'ERROR')) {
    if (p.path) pathCount[p.path] = (pathCount[p.path] || 0) + 1;
  }
  const pathErrorRanking = Object.entries(pathCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // エラーメッセージ ランキング Top10（details の先頭80文字）
  const msgCount = {};
  for (const p of parsed.filter(p => p.level === 'ERROR')) {
    if (p.details) {
      // "err=TypeError: ..." → "TypeError: ..." に整形
      const msg = p.details.replace(/^.*?err=/, '').slice(0, 80).trim();
      if (msg) msgCount[msg] = (msgCount[msg] || 0) + 1;
    }
  }
  const messageRanking = Object.entries(msgCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }));

  // 重複ログ集計（同一 level|path グループで2件以上）
  const dupMap = {};
  for (const incident of incidents) {
    const p = parseLine(incident.clientLogs[0] || '');
    if (!p.level || !p.path) continue;
    const key = `${p.level}|${p.path}`;
    if (!dupMap[key]) dupMap[key] = { key, count: 0, trackIds: [] };
    dupMap[key].count += incident.clientLogs.length;
    dupMap[key].trackIds.push(incident.trackId);
  }
  const duplicates = Object.values(dupMap)
    .filter(d => d.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const totalRequests = incidents.length;
  const errorCount = levelCounts.ERROR;
  const errorRate = totalRequests > 0
    ? `${(errorCount / totalRequests * 100).toFixed(1)}%`
    : '0%';

  return {
    totalRequests,
    errorCount,
    errorRate,
    startTime,
    endTime,
    durationMinutes,
    serverReachable,
    levelCounts,
    pathErrorRanking,
    messageRanking,
    duplicates,
  };
}

module.exports = { buildSummary };
