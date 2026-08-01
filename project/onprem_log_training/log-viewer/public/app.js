// public/app.js
'use strict';

const POLL_INTERVAL = 10000; // 10秒ポーリング
let incidents = [];

// --- DOM refs ---
const tableBody      = document.getElementById('tableBody');
const detailPanel    = document.getElementById('detailPanel');
const detailTrackId  = document.getElementById('detailTrackId');
const clientLogEl    = document.getElementById('clientLogContent');
const serverLogEl    = document.getElementById('serverLogContent');
const errorsOnly     = document.getElementById('errorsOnly');
const lastUpdated    = document.getElementById('lastUpdated');

// ===== サマリーカード描画 =====
function renderSummary(s) {
  const fmtTime = (t) => t ? t.replace('T', ' ').slice(0, 19).replace('Z', '') : '—';

  document.getElementById('valTotal').textContent    = s.totalRequests;
  document.getElementById('valError').textContent    = s.errorCount;
  document.getElementById('valRate').textContent     = s.errorRate;
  document.getElementById('valStart').textContent    = fmtTime(s.startTime);
  document.getElementById('valEnd').textContent      = fmtTime(s.endTime);
  document.getElementById('valDuration').textContent =
    s.durationMinutes !== null ? `${s.durationMinutes} 分` : '—';

  const sshEl = document.getElementById('valSSH');
  sshEl.textContent  = s.serverReachable ? '✅ 接続中' : '❌ 未接続';
  sshEl.style.color  = s.serverReachable ? '#4ade80'   : '#f87171';

  // エラーパス ランキング
  const pathList = document.getElementById('pathRanking');
  pathList.innerHTML = s.pathErrorRanking.length
    ? s.pathErrorRanking.map(r =>
        `<li>
          <code>${escHtml(r.path)}</code>
          <span class="badge-error">${r.count}件</span>
        </li>`
      ).join('')
    : '<li><span class="empty">データなし</span></li>';

  // エラーメッセージ ランキング
  const msgList = document.getElementById('msgRanking');
  msgList.innerHTML = s.messageRanking.length
    ? s.messageRanking.map(r =>
        `<li>
          <span class="msg-text">${escHtml(r.message)}</span>
          <span class="badge-error">${r.count}件</span>
        </li>`
      ).join('')
    : '<li><span class="empty">データなし</span></li>';

  // 重複ログ集計
  const dupBody = document.getElementById('dupBody');
  dupBody.innerHTML = s.duplicates.length
    ? s.duplicates.map(d =>
        `<tr>
          <td><code>${escHtml(d.key)}</code></td>
          <td>${d.count}</td>
          <td class="track-ids">${d.trackIds.slice(0, 6).map(escHtml).join(', ')}${d.trackIds.length > 6 ? ' …' : ''}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="3" class="empty" style="padding:8px">重複なし</td></tr>`;
}

// ===== インシデントテーブル描画 =====
function renderTable(data) {
  const filtered = errorsOnly.checked
    ? data.filter(i => i.level === 'ERROR')
    : data;

  if (!filtered.length) {
    tableBody.innerHTML = '<tr><td colspan="6" class="loading">インシデントなし</td></tr>';
    return;
  }

  tableBody.innerHTML = filtered.map(i => `
    <tr data-id="${escHtml(i.trackId)}">
      <td><code>${escHtml(i.trackId)}</code></td>
      <td><span class="badge-${(i.level || 'unknown').toLowerCase()}">${escHtml(i.level || '?')}</span></td>
      <td>${i.timestamp ? escHtml(i.timestamp.replace('T', ' ').slice(0, 23)) : '—'}</td>
      <td>${escHtml(i.path || '—')}</td>
      <td>${i.clientLogs.length} 行</td>
      <td class="${i.serverLogs.length ? 'has-server' : 'no-server'}">
        ${i.serverLogs.length ? `✓ ${i.serverLogs.length} 行` : '—'}
      </td>
    </tr>`).join('');

  tableBody.querySelectorAll('tr[data-id]').forEach(row =>
    row.addEventListener('click', () => showDetail(row.dataset.id))
  );
}

// ===== 詳細パネル =====
function showDetail(trackId) {
  const inc = incidents.find(i => i.trackId === trackId);
  if (!inc) return;

  detailTrackId.textContent  = trackId;
  clientLogEl.textContent    = inc.clientLogs.join('\n') || '（データなし）';
  serverLogEl.textContent    = inc.serverLogs.join('\n') || '（SSH未接続またはデータなし）';

  detailPanel.classList.remove('hidden');
  detailPanel.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('closeDetail').addEventListener('click', () => {
  detailPanel.classList.add('hidden');
});

// ===== フィルタ・手動更新 =====
errorsOnly.addEventListener('change', () => renderTable(incidents));
document.getElementById('refreshBtn').addEventListener('click', refresh);

// ===== HTML エスケープ =====
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== メインリフレッシュ =====
async function refresh() {
  try {
    const [summaryRes, incidentsRes] = await Promise.all([
      fetch('/api/summary'),
      fetch('/api/incidents'),
    ]);

    if (!summaryRes.ok)   throw new Error(`/api/summary: HTTP ${summaryRes.status}`);
    if (!incidentsRes.ok) throw new Error(`/api/incidents: HTTP ${incidentsRes.status}`);

    const summary  = await summaryRes.json();
    incidents      = await incidentsRes.json();

    renderSummary(summary);
    renderTable(incidents);
    lastUpdated.textContent = `最終更新: ${new Date().toLocaleTimeString('ja-JP')}`;
  } catch (e) {
    console.error('[log-viewer] refresh error:', e);
    tableBody.innerHTML = `<tr><td colspan="6" class="loading">⚠️ エラー: ${escHtml(e.message)}</td></tr>`;
  }
}

// 初回 + 定期更新
refresh();
setInterval(refresh, POLL_INTERVAL);
