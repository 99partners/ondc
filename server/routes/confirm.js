const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration (move to config file in production)
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// ----- SCHEMAS -----
const TransactionTrailSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  action: { type: String, required: true },
  direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
  status: { type: String, enum: ['ACK', 'NACK'], required: true },
  context: { type: Object, required: true },
  message: { type: Object },
  error: { type: Object },
  timestamp: { type: Date, required: true },
  bap_id: { type: String, index: true },
  bap_uri: { type: String },
  bpp_id: { type: String, index: true },
  bpp_uri: { type: String },
  domain: { type: String },
  country: { type: String },
  city: { type: String },
  core_version: { type: String },
  created_at: { type: Date, default: Date.now }
});

const ConfirmDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Prevent OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const ConfirmData = mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);

// ----- UTILITY -----
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
  }
}

// ----- CONFIRM GET REQUEST -----
router.get('/', async (req, res) => {
  try {
    // Extract payload safely (from query params or body if any)
    const payload = req.query || {};
    const safeContext = ensureSafeContext(payload?.context ? JSON.parse(payload.context) : {});
    const message = payload.message ? JSON.parse(payload.message) : {};

    // Store incoming request raw data
    try {
      const confirmData = new ConfirmData({
        transaction_id: safeContext.transaction_id || 'unknown',
        message_id: safeContext.message_id || 'unknown',
        context: safeContext,
        message,
        order: message.order
      });
      await confirmData.save();
      console.log('✅ Confirm request saved to MongoDB');
    } catch (storeErr) {
      console.error('❌ Failed to store confirm request:', storeErr.message);
    }

    // Basic structure validation
    if (!payload || !safeContext || Object.keys(safeContext).length === 0) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id || 'unknown',
        message_id: safeContext.message_id || 'unknown',
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    // Context validation
    const contextErrors = validateContext(safeContext);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    // Store successful trail
    await storeTransactionTrail({
      transaction_id: safeContext.transaction_id,
      message_id: safeContext.message_id,
      action: 'confirm',
      direction: 'incoming',
      status: 'ACK',
      context: safeContext,
      message,
      timestamp: new Date(),
      bap_id: safeContext.bap_id,
      bap_uri: safeContext.bap_uri,
      bpp_id: safeContext.bpp_id || BPP_ID,
      bpp_uri: safeContext.bpp_uri || BPP_URI,
      domain: safeContext.domain,
      country: safeContext.country,
      city: safeContext.city,
      core_version: safeContext.core_version
    });

    // Send ACK
    const ackResponse = createAckResponse();
    console.log('✅ ACK sent for confirm request');
    res.status(202).json(ackResponse);

  } catch (error) {
    console.error('❌ Error in /confirm:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// ----- CONFIRM POST REQUEST (primary for ONDC callbacks) -----
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const safeContext = ensureSafeContext(payload?.context);
    const message = payload?.message || {};

    // Store raw confirm data
    try {
      const confirmData = new ConfirmData({
        transaction_id: safeContext.transaction_id || 'unknown',
        message_id: safeContext.message_id || 'unknown',
        context: payload.context || {},
        message: payload.message || {},
        order: payload.message?.order || {},
        created_at: new Date()
      });
      await confirmData.save();
      console.log(`✅ Confirm data stored: ${safeContext.transaction_id}/${safeContext.message_id}`);
    } catch (storeErr) {
      console.error('❌ Failed to store confirm POST:', storeErr.message);
    }

    // Basic validation
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id || 'unknown',
        message_id: safeContext.message_id || 'unknown',
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    // Context validation
    const contextErrors = validateContext(payload.context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    // Store successful trail
    await storeTransactionTrail({
      transaction_id: safeContext.transaction_id,
      message_id: safeContext.message_id,
      action: 'confirm',
      direction: 'incoming',
      status: 'ACK',
      context: safeContext,
      message,
      timestamp: new Date(),
      bap_id: safeContext.bap_id,
      bap_uri: safeContext.bap_uri,
      bpp_id: safeContext.bpp_id || BPP_ID,
      bpp_uri: safeContext.bpp_uri || BPP_URI,
      domain: safeContext.domain,
      country: safeContext.country,
      city: safeContext.city,
      core_version: safeContext.core_version
    });

    // ACK
    const ackResponse = createAckResponse();
    console.log('✅ ACK sent for confirm POST');
    return res.status(202).json(ackResponse);
  } catch (error) {
    console.error('❌ Error in POST /confirm:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    return res.status(500).json(errorResponse);
  }
});

// ----- DEBUG ROUTE -----
router.get('/debug', async (req, res) => {
  try {
    const confirmRequests = await ConfirmData.find().sort({ created_at: -1 }).limit(50);

    const safeRequests = confirmRequests.map(request => {
      const safe = request.toObject();
      safe.context = safe.context || {};
      const props = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
      props.forEach(p => { if (!safe.context[p]) safe.context[p] = ''; });
      return safe;
    });

    res.json({
      count: confirmRequests.length,
      requests: safeRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;