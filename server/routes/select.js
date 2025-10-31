const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration - These should be moved to a config file in a production environment
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

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

const SelectDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const SelectData = mongoose.models.SelectData || mongoose.model('SelectData', SelectDataSchema);

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

// /select API - Buyer app sends select request
router.post('/', async (req, res) => {
  try {
    // Safely extract payload with defaults if req.body is undefined
    const payload = req.body || {};
    
    // Store all incoming requests regardless of validation
    try {
      const selectData = new SelectData({
        requestBody: payload,
        timestamp: new Date()
      });
      await selectData.save();
    } catch (storeError) {
      console.error('❌ Failed to store incoming select request:', storeError.message);
    }
    
    // Create a safe context object with default values for missing properties
    const safeContext = ensureSafeContext(payload?.context);
    const { context = safeContext, message = payload.message || {} } = payload;
    
    // Basic validation
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'select',
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
    
    // Store select data in MongoDB Atlas with retry mechanism
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const selectData = new SelectData({
          transaction_id: context.transaction_id,
          message_id: context.message_id,
          context,
          message,
          order: message.order
        });
        await selectData.save();
        console.log('✅ Select data saved to MongoDB Atlas database');
        console.log('📊 Saved select request for transaction:', context.transaction_id);
        break; // Exit the loop if successful
      } catch (dbError) {
        retries++;
        console.error(`❌ Failed to save select data to MongoDB Atlas (Attempt ${retries}/${maxRetries}):`, dbError.message);
        
        if (retries >= maxRetries) {
          console.error('❌ Max retries reached. Could not save select data.');
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
    try {
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'select',
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
    console.log('✅ Sending ACK response for select request');
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('❌ Error in /select:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoints to view stored data
router.get('/debug', async (req, res) => {
  try {
    const selectRequests = await SelectData.find().sort({ created_at: -1 }).limit(50);
    
    // Process data to handle undefined context properties
    const safeRequests = selectRequests.map(request => {
      const safeRequest = request.toObject();
      // Ensure context is always an object
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
      count: selectRequests.length,
      requests: safeRequests
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;