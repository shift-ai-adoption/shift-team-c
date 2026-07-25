const express = require('express');
const { callServer } = require('../lib/server-client');
const { carts } = require('./cart');

const router = express.Router();

router.post('/', express.json(), async (req, res, next) => {
  try {
    const sid = req.cookies && req.cookies.robomart_session;
    if (!sid || !carts.has(sid) || carts.get(sid).length === 0) {
      return res.status(400).json({ error: 'cart is empty' });
    }
    const { payment_method, shipping_address } = req.body || {};
    if (!payment_method) return res.status(400).json({ error: 'payment_method required' });
    if (!shipping_address) return res.status(400).json({ error: 'shipping_address required' });

    const items = carts.get(sid);
    const totals = await callServer(req, '/internal/billing/calc', {
      method: 'POST',
      body: { items, payment_method },
    });
    carts.set(sid, []);
    res.status(201).json({
      order_id: `ORD${Date.now()}`,
      items,
      payment_method,
      shipping_address,
      ...totals,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
