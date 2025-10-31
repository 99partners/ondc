const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration - Pramaan Mock Handler
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Import models
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

const SearchDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  intent: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const SearchData = mongoose.models.SearchData || mongoose.model('SearchData', SearchDataSchema);

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

// Main route handler
router.post('/', async (req, res) => {
  try {
    // Safely extract payload with defaults if req.body is undefined
    const payload = req.body || {};
    
    console.log('=== INCOMING SEARCH (Pramaan) ===');
    console.log('Transaction ID:', payload?.context?.transaction_id || 'undefined');
    console.log('Message ID:', payload?.context?.message_id || 'undefined');
    console.log('BAP ID:', payload?.context?.bap_id || 'undefined');
    console.log('Domain:', payload?.context?.domain || 'undefined');
    console.log('Action:', payload?.context?.action || 'undefined');
    console.log('================================');
    
    // Create a safe context object with default values for missing properties
    const safeContext = {
      transaction_id: payload?.context?.transaction_id || 'unknown',
      message_id: payload?.context?.message_id || 'unknown',
      action: payload?.context?.action || 'search',
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
      const searchData = new SearchData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: payload?.context || {},
        message: payload?.message || {},
        intent: payload?.message?.intent || {},
        created_at: new Date()
      });
      await searchData.save();
      console.log('✅ Raw search data saved for audit purposes');
    } catch (storeError) {
      console.error('❌ Failed to store incoming search request:', storeError.message);
    }
    
    // Basic validation
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'search',
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
    
    // Store search data in MongoDB
    try {
      const searchData = new SearchData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context,
        message,
        intent: message.intent
      });
      await searchData.save();
      console.log('✅ Search data saved to MongoDB');
      console.log('📊 Saved search request for transaction:', context.transaction_id);
    } catch (dbError) {
      console.error('❌ Failed to save search data:', dbError.message);
    }

    // Store transaction trail
    try {
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'search',
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
    console.log('✅ Sending ACK...');
    res.status(202).json({ message: { ack: { status: 'ACK' } } });
  } catch (error) {
    console.error('❌ Error in /search-pramaan:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoint for Pramaan search data
router.get('/debug', async (req, res) => {
  try {
    const searchRequests = await SearchData.find().sort({ created_at: -1 }).limit(50);
    res.json({
      count: searchRequests.length,
      requests: searchRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

