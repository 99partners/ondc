const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration - These should be moved to a config file in a production environment
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Using shared validators from ../utils/contextValidator

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

const CancelDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order_id: { type: String, index: true },
  cancellation_reason_id: { type: String },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const CancelData = mongoose.models.CancelData || mongoose.model('CancelData', CancelDataSchema);

<<<<<<< HEAD
// Utility functions are imported from ../utils/contextValidator
=======
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
  if (!context.bpp_id) errors.push('bpp_id is required');
  if (!context.bpp_uri) errors.push('bpp_uri is required');
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
>>>>>>> parent of 85d7da9 (response context now updated)

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

// /cancel API - Buyer app sends cancel request
router.post('/', async (req, res) => {
  try {
    // Safely extract payload with defaults if req.body is undefined
    const payload = req.body || {};
    
    // Create a safe context object with default values for missing properties
    const safeContext = ensureSafeContext(payload?.context);
    
<<<<<<< HEAD
    // Store all incoming requests regardless of validation
=======
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: payload?.context?.transaction_id || 'unknown',
        message_id: payload?.context?.message_id || 'unknown',
        action: 'cancel',
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
    
    // Validate context
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'cancel',
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

    // Store cancel data in MongoDB Atlas
    try {
      const cancelData = new CancelData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context,
        message,
        order_id: message.order_id,
        cancellation_reason_id: message.cancellation_reason_id
      });
      await cancelData.save();
      console.log('✅ Cancel data saved to MongoDB Atlas database');
      console.log('📊 Saved cancel request for transaction:', context.transaction_id);
    } catch (dbError) {
      console.error('❌ Failed to save cancel data to MongoDB Atlas:', dbError.message);
    }

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
>>>>>>> parent of 85d7da9 (response context now updated)
    try {
      const cancelData = new CancelData({
        transaction_id: safeContext.transaction_id || 'unknown',
        message_id: safeContext.message_id || 'unknown',
        context: payload.context || {},
        message: payload.message || {},
        order_id: payload.message?.order_id || '',
        cancellation_reason_id: payload.message?.cancellation_reason_id || '',
        created_at: new Date()
      });
      await cancelData.save();
      console.log(`✅ Cancel data stored: ${safeContext.transaction_id}/${safeContext.message_id}`);
    } catch (storeError) {
      console.error('❌ Failed to store incoming cancel request:', storeError.message);
    }
    const { message = payload.message || {} } = payload;
    
    // Basic validation
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'cancel',
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

<<<<<<< HEAD
    // Validate message
    if (!message || !message.order_id) {
      const errorResponse = createErrorResponse('10002', 'Message is invalid or missing required fields');
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

    // Process the cancel request (in a real implementation)
    // For this example, we'll just acknowledge the request
    const ackResponse = createAckResponse();
    
    // Store transaction trail for successful request
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
    
=======
    // Send ACK response
    const ackResponse = createAckResponse();
>>>>>>> parent of 85d7da9 (response context now updated)
    console.log('✅ Sending ACK response for cancel request');
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('❌ Error in /cancel:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoint to view stored data
router.get('/debug', async (req, res) => {
  try {
    const cancelRequests = await CancelData.find().sort({ created_at: -1 }).limit(50);
    
    // Process data to handle undefined context properties
    const safeRequests = cancelRequests.map(request => {
      const safeRequest = request.toObject();
      if (!safeRequest.context) {
        safeRequest.context = {};
      }
      
      // Ensure all required context properties exist to prevent 'undefined' errors
      const requiredProps = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp', 
                            'country', 'city', 'core_version', 'bpp_id', 'bpp_uri', 'ttl'];
      requiredProps.forEach(prop => {
        if (!safeRequest.context[prop]) {
          safeRequest.context[prop] = '';
        }
      });
      
      // Ensure message properties are safe
      if (!safeRequest.message) {
        safeRequest.message = {};
      }
      
      return safeRequest;
    });
    
    res.json({
      count: cancelRequests.length,
      requests: safeRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Additional debug endpoint to view transaction trails for cancel requests
router.get('/debug/trails', async (req, res) => {
  try {
    const trails = await TransactionTrail.find({ action: 'cancel' })
      .sort({ created_at: -1 })
      .limit(50);
    
    // Process data to handle undefined context properties
    const safeTrails = trails.map(trail => {
      const safeTrail = trail.toObject();
      if (!safeTrail.context) {
        safeTrail.context = {};
      }
      
      // Ensure all required context properties exist to prevent 'undefined' errors
      const requiredProps = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
      requiredProps.forEach(prop => {
        if (!safeTrail.context[prop]) {
          safeTrail.context[prop] = '';
        }
      });
      
      return safeTrail;
    });
    
    res.json({
      count: trails.length,
      trails: safeTrails
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


