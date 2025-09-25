const express = require('express');
const config = require('../config');

const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.ondc.version,
    seller: config.ondc.sellerName,
    domain: config.domain
  });
});

// Detailed health check
router.get('/detailed', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: config.ondc.version,
    seller: config.ondc.sellerName,
    domain: config.domain,
    environment: config.nodeEnv,
    port: config.port
  };
  
  res.json(health);
});

module.exports = router;
