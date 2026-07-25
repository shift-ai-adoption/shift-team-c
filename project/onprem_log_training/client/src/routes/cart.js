const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const carts = new Map();

function getOrCreateSession(req, res) {
  let sid = req.cookies && req.cookies.robomart_session;
  if (!sid) {
    sid = crypto.randomUUID();
    res.cookie('robomart_session', sid, { httpOnly: true, sameSite: 'lax' });
  }
  if (!carts.has(sid)) carts.set(sid, []);
  return sid;
}

router.get('/', (req, res) => {
  const sid = getOrCreateSession(req, res);
  res.json({ session_id: sid, items: carts.get(sid) });
});

router.post('/items', express.json(), (req, res) => {
  const sid = getOrCreateSession(req, res);
  const { sku, qty } = req.body || {};
  if (!sku || !qty || qty <= 0) return res.status(400).json({ error: 'invalid sku or qty' });
  const items = carts.get(sid);
  const found = items.find(i => i.sku === sku);
  if (found) found.qty += qty;
  else items.push({ sku, qty });
  res.status(201).json({ items });
});

router.delete('/items/:sku', (req, res) => {
  const sid = getOrCreateSession(req, res);
  const items = carts.get(sid).filter(i => i.sku !== req.params.sku);
  carts.set(sid, items);
  res.json({ items });
});

module.exports = { router, carts };
