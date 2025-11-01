const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// ================================
// MongoDB Schemas & Models
// ================================

// Transaction Trail Schema
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

// Confirm Data Schema
const ConfirmDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  raw_payload: { type: Object }, // full request payload
  created_at: { type: Date, default: Date.now }
});

// Register models safely (avoid OverwriteModelError)
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const ConfirmData = mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);

// ================================
// Helper: Store Transaction Trail
// ================================
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
    // Retry once after short delay
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const trail = new TransactionTrail(data);
      await trail.save();
      console.log(`✅ Transaction trail stored (retry): ${data.transaction_id}/${data.message_id}`);
    } catch (retryError) {
      console.error('❌ Failed to store transaction trail (retry):', retryError);
    }
  }
}

// ================================
// /confirm API Endpoint
// ================================
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};

    console.log('=== INCOMING CONFIRM REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id);
    console.log('Message ID:', payload?.context?.message_id);
    console.log('BAP ID:', payload?.context?.bap_id);
    console.log('Domain:', payload?.context?.domain);
    console.log('Action:', payload?.context?.action);
    console.log('================================');

    const safeContext = ensureSafeContext(payload?.context);
    const { message = payload.message || {} } = payload;

    // Store raw confirm data before validation
    try {
      const confirmData = new ConfirmData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: payload?.context || {},
        message: payload?.message || {},
        order: payload?.message?.order || {},
        raw_payload: payload || {},
        created_at: new Date()
      });
      await confirmData.save();
      console.log(`✅ Raw confirm data stored: ${safeContext.transaction_id}/${safeContext.message_id}`);
    } catch (storeErr) {
      console.error('❌ Failed to store raw confirm request:', storeErr.message);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const confirmData = new ConfirmData({
          transaction_id: safeContext.transaction_id,
          message_id: safeContext.message_id,
          context: payload?.context || {},
          message: payload?.message || {},
          order: payload?.message?.order || {},
          raw_payload: payload || {},
          created_at: new Date()
        });
        await confirmData.save();
        console.log(`✅ Raw confirm data stored (retry): ${safeContext.transaction_id}/${safeContext.message_id}`);
      } catch (retryErr) {
        console.error('❌ Failed to store raw confirm request (retry):', retryErr.message);
      }
    }

    // === Basic Validation ===
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
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
        bpp_uri: BPP_URI,
        domain: safeContext.domain,
        country: safeContext.country,
        city: safeContext.city,
        core_version: safeContext.core_version
      });
      return res.status(400).json(errorResponse);
    }

    // Validate context
    const contextErrors = validateContext(payload.context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: safeContext.action,
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
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
      return res.status(400).json(errorResponse);
    }

    // Validate message
    if (!message.order) {
      const errorResponse = createErrorResponse('10002', 'Invalid message: order is required');
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
        bpp_uri: BPP_URI,
        domain: safeContext.domain,
        country: safeContext.country,
        city: safeContext.city,
        core_version: safeContext.core_version
      });
      return res.status(400).json(errorResponse);
    }

    // Store transaction trail (ACK)
    await storeTransactionTrail({
      transaction_id: safeContext.transaction_id,
      message_id: safeContext.message_id,
      action: safeContext.action,
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

    // Send ACK response
    const ackResponse = {
      context: {
        domain: safeContext.domain,
        country: safeContext.country,
        city: safeContext.city,
        action: safeContext.action,
        core_version: safeContext.core_version,
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI,
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        timestamp: new Date().toISOString()
      },
      message: {
        ack: { status: 'ACK' }
      }
    };

    console.log('✅ Sending ACK response for confirm request');
    res.status(202).json(ackResponse);

  } catch (error) {
    console.error('❌ Error in /confirm:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// ================================
// DEBUG ENDPOINTS (Enhanced)
// ================================

// Enhanced /confirm/debug (supports filters & limits)
router.get('/debug', async (req, res) => {
  try {
    const { limit = 20000, transaction_id, message_id, bap_id } = req.query;
    const query = {};

    if (transaction_id) query['context.transaction_id'] = transaction_id;
    if (message_id) query['context.message_id'] = message_id;
    if (bap_id) query['context.bap_id'] = bap_id;

    const confirmRequests = await ConfirmData.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    const safeRequests = confirmRequests.map(reqDoc => {
      const obj = reqDoc.toObject();
      if (!obj.context) obj.context = {};
      return obj;
    });

    res.json({
      count: confirmRequests.length,
      total_in_db: await ConfirmData.countDocuments(),
      filters_applied: { transaction_id, message_id, bap_id, limit },
      requests: safeRequests
    });
  } catch (error) {
    console.error('Error in /confirm/debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest confirm record by transaction_id
router.get('/debug/:transaction_id', async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const confirmRequest = await ConfirmData.findOne({ 'context.transaction_id': transaction_id })
      .sort({ created_at: -1 });

    if (!confirmRequest) {
      return res.status(404).json({ error: `No confirm data found for transaction: ${transaction_id}` });
    }

    res.json(confirmRequest);
  } catch (error) {
    console.error('Error in /confirm/debug/:transaction_id:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
