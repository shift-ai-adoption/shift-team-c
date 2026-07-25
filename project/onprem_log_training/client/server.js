const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { requestLogger, logError } = require('./src/middleware/logger');

const productRoutes = require('./src/routes/products');
const cartRoutes = require('./src/routes/cart');
const orderRoutes = require('./src/routes/orders');

const app = express();
const PORT = Number(process.env.PORT || 3002);

app.use(cookieParser());
app.use(requestLogger);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/product/:sku', (req, res) => res.sendFile(path.join(__dirname, 'views', 'product.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'views', 'cart.html')));

app.use('/api/robots', productRoutes);
app.use('/api/cart', cartRoutes.router);
app.use('/api/orders', orderRoutes);

app.use((err, req, res, next) => {
  logError(req, err);
  res.status(500).json({ error: err.message, track_id: req.trackId });
});

app.listen(PORT, () => {
  console.log(`onprem-log-training client (application tier) listening on http://localhost:${PORT}`);
  console.log(`SERVER_BASE_URL: ${process.env.SERVER_BASE_URL || 'http://localhost:4002'}`);
});
