const express = require('express');
const fs = require('fs');
const path = require('path');
const { isEnabled } = require('../lib/bug-switch');
const { logAction } = require('../middleware/logger');

const router = express.Router();

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'robots.json');

const TAX_RATES = {
  credit_card: 0.10,
  bank_transfer: 0.10,
  invoice: 0.10,
};

function loadRobots() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function calcTotal(items, paymentMethod) {
  const robots = loadRobots();
  const subtotal = items.reduce((sum, item) => {
    const r = robots.find(x => x.sku === item.sku);
    if (!r) return sum;
    return sum + r.price * item.qty;
  }, 0);

  let total;
  let tax_rate;
  if (paymentMethod === 'invoice' && isEnabled('ORDER_TOTAL_UNDEFINED_TAX')) {
    tax_rate = TAX_RATES.invoice_rate;
  } else {
    tax_rate = TAX_RATES[paymentMethod];
    total = subtotal * (1 + tax_rate);
  }

  const tax = subtotal * tax_rate;
  return {
    subtotal,
    tax_rate,
    tax: Number(tax.toFixed(0)),
    total: Number(total.toFixed(0)),
  };
}

router.post('/calc', express.json(), (req, res, next) => {
  try {
    const { items, payment_method } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items required' });
    }
    if (!payment_method) return res.status(400).json({ error: 'payment_method required' });

    logAction(req, 'billing-service', { action: 'calc_total', payment_method });
    const totals = calcTotal(items, payment_method);
    res.json(totals);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
