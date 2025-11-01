const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// BPP Configuration - These should be moved to a config file in a production environment
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// BPP Confirm Data Models

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' },
  '20006': { type: 'DOMAIN-ERROR', code: '20006', message: 'Invalid response: billing timestamp mismatch' }
};

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
  raw_payload: { type: Object, required: true }, // Store the raw incoming request
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const ConfirmData = mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);

// No init data functions needed

// Utility Functions
function validateContext(context) {
  const errors = [];
  
  if (!context) {
    errors.push('Context is required');
    return errors;
  }
  
  // --- ONDC Mandatory Context Fields for BAP -> BPP Request (as per V1.2.0) ---
  if (!context.domain) errors.push('domain is required');
  if (!context.country) errors.push('country is required');
  if (!context.city) errors.push('city is required');
  if (!context.action) errors.push('action is required');
  if (!context.core_version) errors.push('core_version is required');
  if (!context.bap_id) errors.push('bap_id is required');
  if (!context.bap_uri) errors.push('bap_uri is required');
  if (!context.transaction_id) errors.push('transaction_id is required');
  if (!context.message_id) errors.push('message_id is required');
  if (!context.timestamp) errors.push('timestamp is required');
  if (!context.ttl) errors.push('ttl is required');
  
  return errors;
}

function createErrorResponse(errorCode, message) {
  const error = ONDC_ERRORS[errorCode] || { type: 'CONTEXT-ERROR', code: errorCode, message };
  return {
    message: { ack: { status: 'NACK' } },
    error: {
      type: error.type,
      code: error.code,
      message: error.message
    }
  };
}

function createAckResponse() {
  return {
    message: { ack: { status: 'ACK' } }
  };
}

// Store transaction trail
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
  }
}

// /confirm API - Buyer app sends confirm request
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    
    console.log('=== INCOMING CONFIRM REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id);
    console.log('Message ID:', payload?.context?.message_id);
    console.log('BAP ID:', payload?.context?.bap_id);
    console.log('Domain:', payload?.context?.domain);
    console.log('Action:', payload?.context?.action);
    console.log('================================');
    
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: payload?.context?.transaction_id || 'unknown',
        message_id: payload?.context?.message_id || 'unknown',
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: payload?.context || {},
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: payload?.context?.bap_id,
        bap_uri: payload?.context?.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    const { context, message } = payload;
    
    // No init data needed for confirm

    // Validate context (with corrected billing data if available)
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: context.bap_id,
        bap_uri: context.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    // Store confirm data in MongoDB Atlas
    try {
      const confirmData = new ConfirmData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context,
        message,
        order: message.order,
        raw_payload: req.body || {}, // Store the raw incoming request payload
        created_at: new Date()
      });
      await confirmData.save();
      console.log('✅ Confirm data saved to MongoDB Atlas database');
      console.log('📊 Saved confirm request for transaction:', context.transaction_id);
    } catch (dbError) {
      console.error('❌ Failed to save confirm data to MongoDB Atlas:', dbError.message);
      // Continue execution but log the error
    }

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
    try {
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'confirm',
        direction: 'incoming',
        status: 'ACK',
        context,
        message,
        timestamp: new Date(),
        bap_id: context.bap_id,
        bap_uri: context.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI,
        domain: context.domain,
        country: context.country,
        city: context.city,
        core_version: context.core_version
      });
    } catch (trailError) {
      console.error('❌ Failed to store transaction trail:', trailError.message);
    }

    // Send ACK response
    const ackResponse = createAckResponse();
    console.log('✅ Sending ACK response for confirm request');
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('❌ Error in /confirm:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    
    // Store error in transaction trail
    try {
      await storeTransactionTrail({
        transaction_id: req.body?.context?.transaction_id || 'unknown',
        message_id: req.body?.context?.message_id || 'unknown',
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: req.body?.context || {},
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: req.body?.context?.bap_id,
        bap_uri: req.body?.context?.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
    } catch (trailError) {
      console.error('❌ Failed to store error trail:', trailError);
    }
    
    res.status(500).json(errorResponse);
  }
});

// Debug endpoint to view stored data
router.get('/debug', async (req, res) => {
  try {
    const confirmRequests = await ConfirmData.find().sort({ created_at: -1 }).limit(50);
    
    res.json({
      confirm_count: confirmRequests.length,
      confirm_requests: confirmRequests.map(req => ({
        transaction_id: req.transaction_id,
        message_id: req.message_id,
        context: req.context,
        message: req.message,
        order: req.order,
        raw_payload: req.raw_payload,
        created_at: req.created_at
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to check confirm data for a specific transaction
router.get('/debug/:transaction_id', async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const confirmData = await ConfirmData.find({ transaction_id }).sort({ created_at: -1 });
    
    res.json({
      transaction_id,
      confirm_count: confirmData.length,
      confirm_data: confirmData.map(item => ({
        message_id: item.message_id,
        context: item.context,
        message: item.message,
        order: item.order,
        raw_payload: item.raw_payload,

        created_at: item.created_at
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;