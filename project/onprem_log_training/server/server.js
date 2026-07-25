const express = require('express');

const { requestLogger, logError } = require('./src/middleware/logger');
const { listEnabled } = require('./src/lib/bug-switch');

const inventoryRoutes = require('./src/routes/inventory');
const billingRoutes = require('./src/routes/billing');

const app = express();
const PORT = Number(process.env.PORT || 4002);

app.use(requestLogger);

app.use('/internal/inventory', inventoryRoutes);
app.use('/internal/billing', billingRoutes);

app.use((err, req, res, next) => {
  logError(req, err);
  res.status(500).json({ error: err.message, track_id: req.trackId });
});

app.listen(PORT, () => {
  const enabled = listEnabled();
  console.log(`onprem-log-training server (function tier) listening on http://localhost:${PORT}`);
  console.log(`Enabled bugs: ${enabled.map(b => b.name).join(', ') || '(none)'}`);
});
