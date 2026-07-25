const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:4002';

// server tier(業務ロジック層)へのHTTP呼び出しをまとめるラッパー。
// req.trackId を X-Track-Id ヘッダで伝播させ、client/server 両方のログを同一TrackIDで相関できるようにする。
async function callServer(req, methodPath, options = {}) {
  const url = `${SERVER_BASE_URL}${methodPath}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'X-Track-Id': req.trackId,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const err = new Error(`upstream server error: ${data.error || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

module.exports = { callServer, SERVER_BASE_URL };
