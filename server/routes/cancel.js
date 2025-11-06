const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, extractSafePayload, createErrorResponse, createAckResponse, createTransactionTrailData } = require('../utils/contextValidator');

// BPP Configuration - These should be moved to a config file in a production environment
// const BPP_ID = 'staging.99digicom.com';
// const BPP_URI = 'https://staging.99digicom.com';

const BPP_IDS = ['preprod.99digicom.com', 'staging.99digicom.com'];
const BPP_URIS = ['https://preprod.99digicom.com', 'https://staging.99digicom.com'];
const BPP_ID = BPP_IDS[0];
const BPP_URI = BPP_URIS[0];

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
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

const CancelDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order_id: { type: String, index: true },
  cancellation_reason_id: { type: String },
  raw_payload: { type: Object }, // Store raw payload for audit
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const CancelData = mongoose.models.CancelData || mongoose.model('CancelData', CancelDataSchema);

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
    // Extract and validate safe payload using shared utilities
    const { context: rawContext, message: rawMessage } = extractSafePayload(req.body);
    
    console.log('=== INCOMING CANCEL REQUEST ===');
    console.log('Transaction ID:', rawContext?.transaction_id);
    console.log('Message ID:', rawContext?.message_id);
    console.log('BAP ID:', rawContext?.bap_id);
    console.log('Domain:', rawContext?.domain);
    console.log('Action:', rawContext?.action);
    console.log('================================');
    
    // Validate context using shared utility
    const contextErrors = validateContext(rawContext);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: rawContext?.transaction_id || 'unknown',
        message_id: rawContext?.message_id || 'unknown',
        action: 'cancel',
        direction: 'incoming',
        status: 'NACK',
        context: rawContext || {},
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: rawContext?.bap_id,
        bap_uri: rawContext?.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    // Ensure safe context with defaults
    const safeContext = ensureSafeContext(rawContext);
    const { context, message } = { context: safeContext, message: rawMessage };

    // Store cancel data in MongoDB Atlas with retry mechanism
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const cancelData = new CancelData({
          transaction_id: context.transaction_id,
          message_id: context.message_id,
          context,
          message,
          order_id: message.order_id,
          cancellation_reason_id: message.cancellation_reason_id,
          raw_payload: req.body // Store raw payload for audit
        });
        await cancelData.save();
        console.log('✅ Cancel data saved to MongoDB Atlas database');
        console.log('📊 Saved cancel request for transaction:', context.transaction_id);
        break; // Exit the loop if successful
      } catch (dbError) {
        retries++;
        console.error(`❌ Failed to save cancel data to MongoDB Atlas (Attempt ${retries}/${maxRetries}):`, dbError.message);
        
        if (retries >= maxRetries) {
          console.error('❌ Max retries reached. Could not save cancel data.');
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
    try {
      const trailData = createTransactionTrailData({
        context,
        action: 'cancel',
        direction: 'incoming',
        status: 'ACK',
        message,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      await storeTransactionTrail(trailData);
    } catch (trailError) {
      console.error('❌ Failed to store transaction trail:', trailError.message);
    }

    // Send ACK response with context
    const ackResponse = { ...createAckResponse(), context: context };
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
    
    // Return safe processed data without raw_payload for security
    const safeRequests = cancelRequests.map(request => ({
      transaction_id: request.transaction_id,
      message_id: request.message_id,
      order_id: request.order_id,
      cancellation_reason_id: request.cancellation_reason_id,
      context: request.context,
      message: request.message,
      created_at: request.created_at
    }));
    
    res.json({
      count: safeRequests.length,
      requests: safeRequests
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


