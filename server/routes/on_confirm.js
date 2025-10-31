const express = require('express');
const router = express.Router();

// Simple GET handler for on_confirm similar to other GET-style debug endpoints
// Returns a basic payload so clients can verify the endpoint is reachable
router.get('/', async (req, res) => {
  try {
    res.json({ route: 'on_confirm', status: 'OK', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optional debug endpoint to mirror the pattern used in other routes
router.get('/debug', async (req, res) => {
  try {
    res.json({ route: 'on_confirm/debug', message: 'No stored data for on_confirm yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


