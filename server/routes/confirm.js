const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
};

// Confirm Data Schema
const ConfirmDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const ConfirmData = mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', require('./search').schema); // Assuming TransactionTrail is shared

// Store transaction trail
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error.message);
  }
}

// /confirm API - Buyer app sends confirm request
router.post('/', async (req, res) => {
  try {
    // Safely extract payload with defaults if req.body is undefined
    const payload = req.body || {};
    
    console.log('=== INCOMING CONFIRM REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id || 'undefined');
    console.log('Message ID:', payload?.context?.message_id || 'undefined');
    console.log('BAP ID:', payload?.context?.bap_id || 'undefined');
    console.log('Domain:', payload?.context?.domain || 'undefined');
    console.log('Action:', payload?.context?.action || 'undefined');
    console.log('Order ID:', payload?.message?.order?.id || 'undefined');
    console.log('================================');
    
    // Create a safe context object with default values for missing properties
    const safeContext = {
      transaction_id: payload?.context?.transaction_id || 'unknown',
      message_id: payload?.context?.message_id || 'unknown',
      action: payload?.context?.action || 'confirm',
      bap_id: payload?.context?.bap_id || '',
      bap_uri: payload?.context?.bap_uri || '',
      bpp_id: payload?.context?.bpp_id || BPP_ID,
      bpp_uri: payload?.context?.bpp_uri || BPP_URI,
      domain: payload?.context?.domain || '',
      country: payload?.context?.country || '',
      city: payload?.context?.city || '',
      core_version: payload?.context?.core_version || '',
      timestamp: payload?.context?.timestamp || new Date().toISOString()
    };
    
    // Store all incoming requests regardless of validation
    try {
      const confirmData = new ConfirmData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: payload?.context || {},
        message: payload?.message || {},
        order: payload?.message?.order || {},
        created_at: new Date()
      });
      await confirmData.save();
      console.log('✅ Raw confirm data saved for audit purposes');
    } catch (storeError) {
      console.error('❌ Failed to store incoming confirm request:', storeError.message);
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
    
    const { context, message } = payload;
    
    // Validate mandatory confirm message structure
    if (!message.order) {
      const errorResponse = createErrorResponse('10002', 'Order details are mandatory in confirm request');
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: context,
        error: errorResponse.error,
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
      return res.status(400).json(errorResponse);
    }
    
    // Store confirm data in MongoDB Atlas - MANDATORY as requested
    try {
      const confirmData = new ConfirmData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context: JSON.parse(JSON.stringify(context)), // Deep copy to ensure all data is stored
        message: JSON.parse(JSON.stringify(message)), // Deep copy to ensure all data is stored
        order: message.order ? JSON.parse(JSON.stringify(message.order)) : undefined
      });
      
      await confirmData.save();
      console.log('✅ Confirm data saved to MongoDB Atlas database for transaction:', context.transaction_id);
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
        context: context,
        message: message,
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
    res.status(500).json(errorResponse);
  }
});

// Debug endpoints to view stored confirm data
router.get('/debug', async (req, res) => {
  try {
    // Get query parameters for filtering
    const { limit = 20000, transaction_id, message_id, bap_id, order_id } = req.query;
    
    // Build query based on filters
    const query = {};
    if (transaction_id) query['context.transaction_id'] = transaction_id;
    if (message_id) query['context.message_id'] = message_id;
    if (bap_id) query['context.bap_id'] = bap_id;
    if (order_id) query['order.id'] = order_id;
    
    // Get confirm requests with pagination and filtering
    const confirmRequests = await ConfirmData.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));
    
    // Process data to handle undefined context properties
    const safeRequests = confirmRequests.map(request => {
      const safeRequest = request.toObject();
      if (!safeRequest.context) {
        safeRequest.context = {};
      }
      return safeRequest;
    });
    
    // Return formatted response
    res.json({
      count: confirmRequests.length,
      total_in_db: await ConfirmData.countDocuments(),
      filters_applied: { transaction_id, message_id, bap_id, order_id, limit },
      requests: safeRequests
    });
    
  } catch (error) {
    console.error('Error in /confirm/debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific confirm request by transaction_id and message_id
router.get('/debug/:transaction_id/:message_id', async (req, res) => {
  try {
    const { transaction_id, message_id } = req.params;
    
    const confirmRequest = await ConfirmData.findOne({
      'context.transaction_id': transaction_id,
      'context.message_id': message_id
    });
    
    if (!confirmRequest) {
      return res.status(404).json({ 
        error: 'Confirm request not found',
        transaction_id,
        message_id
      });
    }
    
    res.json({
      request: confirmRequest
    });
    
  } catch (error) {
    console.error('Error in /confirm/debug/:transaction_id/:message_id endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;