const express = require('express');
const fs = require('fs');
const path = require('path');
const { isEnabled } = require('../lib/bug-switch');
const { logAction } = require('../middleware/logger');

const router = express.Router();

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'robots.json');

function loadRobots() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

router.get('/', (req, res) => {
  const robots = loadRobots();
  res.json(robots.map(r => ({
    sku: r.sku, name: r.name, price: r.price, stock: r.stock, category: r.category,
  })));
});

router.get('/:sku', (req, res, next) => {
  try {
    const robots = loadRobots();
    const robot = robots.find(r => r.sku === req.params.sku);
    if (!robot) return res.status(404).json({ error: 'robot not found' });

    logAction(req, 'inventory-service', { action: 'get_related_products', sku: robot.sku });

    let relatedList;
    if (robot.stock === 0 && isEnabled('PRODUCT_STOCK_ZERO_NPE')) {
      relatedList = robot.out_of_stock_alternatives;
    } else {
      relatedList = robot.related || [];
    }

    const related = relatedList.map(sku => {
      const r = robots.find(x => x.sku === sku);
      return r ? { sku: r.sku, name: r.name, price: r.price } : null;
    }).filter(Boolean);

    res.json({ ...robot, related_products: related });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
