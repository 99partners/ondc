const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const searchRoutes = require('./routes/search');
const healthRoutes = require('./routes/health');
const registryRoutes = require('./routes/registry');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [`https://${config.domain}`, 'https://buyer-app.ondc.org']
    : true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRoutes);

// Restrict allowed host in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const hostHeader = req.headers.host || '';
    const incomingHost = hostHeader.split(':')[0];
    if (incomingHost !== config.domain) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid host'
      });
    }
  }
  next();
});

// Mount search routes at root to expose /search
app.use('/', searchRoutes);
// Registry helper routes
app.use('/', registryRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ONDC Seller Search API',
    version: config.ondc.version,
    seller: config.ondc.sellerName,
    domain: config.domain,
    status: 'active'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 ONDC Seller Search API running on port ${PORT}`);
  console.log(`📡 Domain: ${config.domain}`);
  console.log(`🏪 Seller: ${config.ondc.sellerName}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
});

module.exports = app;
