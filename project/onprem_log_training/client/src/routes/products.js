const express = require('express');
const { callServer } = require('../lib/server-client');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const robots = await callServer(req, '/internal/inventory');
    res.json(robots);
  } catch (err) {
    next(err);
  }
});

router.get('/:sku', async (req, res, next) => {
  try {
    const detail = await callServer(req, `/internal/inventory/${req.params.sku}`);
    res.json(detail);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'robot not found' });
    next(err);
  }
});

module.exports = router;
