const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration - These should be moved to a config file in a production environment
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Import models - These should be moved to separate model files in a production environment
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
  raw_payload: { type: Object }, // Store the full raw payload
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const ConfirmData = mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);

// Store transaction trail
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
    // Retry once after a short delay
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const trail = new TransactionTrail(data);
      await trail.save();
      console.log(`✅ Transaction trail stored (retry): ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
    } catch (retryError) {
      console.error('❌ Failed to store transaction trail (retry):', retryError);
    }
  }
}

// /confirm API - Buyer app sends confirm request
router.post('/', async (req, res) => {
  try {
    // Safely extract payload with defaults if req.body is undefined
    const payload = req.body || {};
    
    console.log('=== INCOMING CONFIRM REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id);
    console.log('Message ID:', payload?.context?.message_id);
    console.log('BAP ID:', payload?.context?.bap_id);
    console.log('Domain:', payload?.context?.domain);
    console.log('Action:', payload?.context?.action);
    console.log('================================');
    
    // Create a safe context object with default values for missing properties
    const safeContext = ensureSafeContext(payload?.context);
    const { message = payload.message || {} } = payload;
    
    // Store all incoming requests regardless of validation
    try {
      const confirmData = new ConfirmData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: payload?.context || {},
        message: payload?.message || {},
        order: payload?.message?.order || {},
        raw_payload: payload || {}, // Store the full raw payload
        created_at: new Date()
      });
      await confirmData.save();
      console.log(`✅ Raw confirm data stored: ${safeContext.transaction_id}/${safeContext.message_id}`);
    } catch (storeErr) {
      console.error('❌ Failed to store raw confirm request:', storeErr.message);
      // Retry once after a short delay
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const confirmData = new ConfirmData({
          transaction_id: safeContext.transaction_id,
          message_id: safeContext.message_id,
          context: payload?.context || {},
          message: payload?.message || {},
          order: payload?.message?.order || {},
          raw_payload: payload || {}, // Store the full raw payload
          created_at: new Date()
        });
        await confirmData.save();
        console.log(`✅ Raw confirm data stored (retry): ${safeContext.transaction_id}/${safeContext.message_id}`);
      } catch (retryErr) {
        console.error('❌ Failed to store raw confirm request (retry):', retryErr.message);
      }
    }
    
    // Basic validation
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

    // Validate message - confirm specific validation
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

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
    try {
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
    } catch (trailError) {
      console.error('❌ Failed to store transaction trail:', trailError.message);
    }

    // Send ACK response with echoed context (align with search/select)
    const ackWithContext = { 
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
        ack: {
          status: "ACK"
        }
      }
    };
    console.log('✅ Sending ACK response for confirm request');
    res.status(202).json(ackWithContext);
    
  } catch (error) {
    console.error('❌ Error in /confirm:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoint to view stored confirm data
router.get('/debug', async (req, res) => {
  try {
    const confirmRequests = await ConfirmData.find().sort({ created_at: -1 }).limit(500);
    
    // Process data to handle undefined context properties
    const safeRequests = confirmRequests.map(request => {
      const safeRequest = request.toObject();
      if (!safeRequest.context) {
        safeRequest.context = {};
      }
      
      // Ensure all required context properties exist to prevent 'undefined' errors
      const requiredProps = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
      requiredProps.forEach(prop => {
        if (!safeRequest.context[prop]) {
          safeRequest.context[prop] = '';
        }
      });
      
      return safeRequest;
    });
    
    res.json({
      count: confirmRequests.length,
      requests: safeRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to view stored confirm data for a specific transaction
router.get('/debug/:transaction_id', async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const confirmRequest = await ConfirmData.findOne({ transaction_id }).sort({ created_at: -1 });
    
    if (!confirmRequest) {
      return res.status(404).json({ error: `No confirm data found for transaction: ${transaction_id}` });
    }
    
    // Process data to handle undefined context properties
    const safeRequest = confirmRequest.toObject();
    if (!safeRequest.context) {
      safeRequest.context = {};
    }
    
    // Ensure all required context properties exist to prevent 'undefined' errors
    const requiredProps = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
    requiredProps.forEach(prop => {
      if (!safeRequest.context[prop]) {
        safeRequest.context[prop] = '';
      }
    });
    
    res.json(safeRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;