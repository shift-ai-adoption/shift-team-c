// server.js
'use strict';
const express = require('express');
const path = require('path');
const { readClientLog } = require('./lib/clientLogReader');
const { aggregateIncidents } = require('./lib/incidentAggregator');
const { checkReachable } = require('./lib/serverLogFetcher');
const { buildSummary } = require('./lib/statsAnalyzer');

const app = express();
const PORT = process.env.PORT || 8090;

// 静的ファイル
app.use(express.static(path.join(__dirname, 'public')));

// ヘルスチェック
app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

// ダッシュボード用サマリー
app.get('/api/summary', async (req, res) => {
  try {
    const [incidents, serverReachable] = await Promise.all([
      aggregateIncidents(),
      checkReachable(),
    ]);
    const summary = buildSummary(incidents, serverReachable);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// インシデント一覧
app.get('/api/incidents', async (req, res) => {
  try {
    const incidents = await aggregateIncidents();
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 特定TrackIDの詳細
app.get('/api/incidents/:trackId', async (req, res) => {
  try {
    const incidents = await aggregateIncidents();
    const found = incidents.find(i => i.trackId === req.params.trackId);
    if (!found) return res.status(404).json({ error: 'not found' });
    res.json(found);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// clientログ rawモード
app.get('/api/logs/client', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const lines = readClientLog(limit);
  res.json({ lines, count: lines.length });
});

app.listen(PORT, () => {
  console.log(`[log-viewer] http://localhost:${PORT}  (pid=${process.pid})`);
});
