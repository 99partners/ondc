const express = require('express');
const { lookupParticipant, markUsedEndpoint } = require('../utils/registryClient');

const router = express.Router();

// POST /lookup - proxy to ONDC Registry lookup
router.post('/lookup', async (req, res) => {
  try {
    const data = await lookupParticipant(req.body);
    res.json(data);
  } catch (err) {
    console.error('Registry lookup error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: 'LOOKUP_FAILED',
      message: err.response?.data || err.message
    });
  }
});

// POST /used-endpoint - proxy to ONDC Registry used_endpoint
router.post('/used-endpoint', async (req, res) => {
  try {
    const data = await markUsedEndpoint(req.body);
    res.json(data);
  } catch (err) {
    console.error('Registry used-endpoint error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: 'USED_ENDPOINT_FAILED',
      message: err.response?.data || err.message
    });
  }
});

module.exports = router;


