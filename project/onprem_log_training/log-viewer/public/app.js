// public/app.js
'use strict';

const DEFAULT_POLL_INTERVAL = 10000; // 初期値: 10秒ポーリング
let incidents = [];

// ===== ヘッダのデジタル時計（JST・1秒ごとに更新） =====
function updateClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  el.textContent = new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
updateClock();
setInterval(updateClock, 1000);

// --- DOM refs ---
const tableBody      = document.getElementById('tableBody');
const detailPanel    = document.getElementById('detailPanel');
const detailTrackId  = document.getElementById('detailTrackId');
const clientLogEl    = document.getElementById('clientLogContent');
const serverLogEl    = document.getElementById('serverLogContent');
const errorsOnly     = document.getElementById('errorsOnly');
const lastUpdated    = document.getElementById('lastUpdated');
const pollIntervalEl = document.getElementById('pollInterval');

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

  // キーワード検索を適用（演習⑦）。件数表示の母数は「ERRORのみ表示」適用後の件数。
  const searched = applySearch(filtered);
  updateSearchCount(searched.length, filtered.length);

  if (!searched.length) {
    tableBody.innerHTML = '<tr><td colspan="6" class="loading">インシデントなし</td></tr>';
    return;
  }

  tableBody.innerHTML = searched.map(i => `
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
document.getElementById('refreshBtn').addEventListener('click', () => {
  applyPollInterval();  // プルダウンで選んだ間隔を適用（更新ボタン押下時のみ）
  refresh();
});

// ===== キーワード検索（演習⑦） =====
// TrackID / パス / レベル の部分一致で絞り込む。大文字小文字は区別しない。
// スペース区切りで複数語を入れた場合は AND 検索（全語を含む行だけ残す）。
// 検索値は DOM の input に保持されるため、自動更新後も条件は維持される。
const searchBox   = document.getElementById('searchBox');
const searchCount = document.getElementById('searchCount');

function applySearch(data) {
  const terms = (searchBox.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return data;

  return data.filter(i => {
    const haystack = [i.trackId, i.path, i.level].map(v => String(v || '').toLowerCase());
    return terms.every(t => haystack.some(h => h.includes(t)));
  });
}

function updateSearchCount(shown, total) {
  searchCount.textContent = searchBox.value.trim()
    ? `${shown} 件 / 全 ${total} 件`
    : `全 ${total} 件`;
}

searchBox.addEventListener('input', () => renderTable(incidents));

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

// ===== ポーリング間隔の制御 =====
// プルダウンで選ばれた間隔を実際のタイマーに反映する。
// 「しない（停止）」(value="0") が選ばれた場合はタイマーを張らない。
// 呼び出しは「初回」と「🔄更新ボタン押下時」のみ（プルダウン変更だけでは適用しない仕様）。
let pollTimer = null;

function applyPollInterval() {
  if (pollTimer) {
    clearInterval(pollTimer);   // 古いタイマーを必ず止める（二重更新の防止）
    pollTimer = null;
  }
  const ms = pollIntervalEl ? parseInt(pollIntervalEl.value, 10) : DEFAULT_POLL_INTERVAL;
  if (Number.isFinite(ms) && ms > 0) {
    pollTimer = setInterval(refresh, ms);
  }
}

// 初回 + 定期更新
applyPollInterval();
refresh();
