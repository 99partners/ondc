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

// Utility Functions are now imported from '../utils/contextValidator'

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
    console.log('=== DEBUG: Raw request body ===');
    console.log(JSON.stringify(req.body, null, 2));
    const { payload, safeContext, message } = extractSafePayload(req);
    
    console.log('=== INCOMING CANCEL REQUEST ===');
    console.log('Transaction ID:', safeContext?.transaction_id);
    console.log('Message ID:', safeContext?.message_id);
    console.log('BAP ID:', safeContext?.bap_id);
    console.log('Domain:', safeContext?.domain);
    console.log('Action:', safeContext?.action);
    console.log('================================');
    
    // Validate context using shared utility
    const contextErrors = validateContext(payload.context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: safeContext?.transaction_id || 'unknown',
        message_id: safeContext?.message_id || 'unknown',
        action: 'cancel',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext || {},
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext?.bap_id,
        bap_uri: safeContext?.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }

    // Use the already extracted safeContext; no redeclaration
    const context = safeContext;

    // Store cancel data in MongoDB Atlas with retry mechanism
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const cancelData = new CancelData({
          transaction_id: safeContext.transaction_id,
          message_id: safeContext.message_id,
          context: safeContext,
          message: message,
          order_id: message.order_id,
          cancellation_reason_id: message.cancellation_reason_id,
          raw_payload: payload // Store raw payload for audit
        });
        await cancelData.save();
        console.log('✅ Cancel data saved to MongoDB Atlas database');
        console.log('📊 Saved cancel request for transaction:', safeContext.transaction_id);
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
      const trailData = createTransactionTrailData({ message }, safeContext, 'cancel', 'ACK', { BPP_ID, BPP_URI });
      await storeTransactionTrail(trailData);
    } catch (trailError) {
      console.error('❌ Failed to store transaction trail:', trailError.message);
    }

    // Send ACK response with context
    const ackResponse = { ...createAckResponse(), context: safeContext };
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


