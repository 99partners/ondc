const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

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

const SearchDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  intent: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const SearchData = mongoose.models.SearchData || mongoose.model('SearchData', SearchDataSchema);

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
  // FIX APPLIED: context.bpp_id and context.bpp_uri are NOT required in an INCOMING /search request
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
    console.log(`✅ Transaction trail stored: ${data.transaction_id}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error.message);
  }
}

// /search API - Buyer app sends search request
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    
    console.log('=== INCOMING SEARCH REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id);
    console.log('Message ID:', payload?.context?.message_id);
    console.log('BAP ID:', payload?.context?.bap_id);
    console.log('Domain:', payload?.context?.domain);
    console.log('Action:', payload?.context?.action);
    console.log('================================');
    
    // We'll store the search data after validation
    
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: payload?.context?.transaction_id || 'unknown',
        message_id: payload?.context?.message_id || 'unknown',
        action: 'search',
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
        action: 'search',
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

    // Store search data in MongoDB Atlas - MANDATORY as requested
    try {
      // Store ALL incoming search requests without any filtering
      const searchData = new SearchData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context: JSON.parse(JSON.stringify(context)), // Deep copy to ensure all data is stored
        message: JSON.parse(JSON.stringify(message)), // Deep copy to ensure all data is stored
        intent: message.intent ? JSON.parse(JSON.stringify(message.intent)) : undefined
      });
      
      // Save the data with a single attempt
      await searchData.save();
      console.log('✅ Search data saved to MongoDB Atlas database for transaction:', context.transaction_id);
    } catch (dbError) {
      console.error('❌ Failed to save search data to MongoDB Atlas:', dbError.message);
      // Continue execution but log the error
    }

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
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
    const ackResponse = createAckResponse();
    console.log('✅ Sending ACK response for search request');
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('❌ Error in /search:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoints to view stored data
router.get('/debug', async (req, res) => {
  try {
    // Get query parameters for filtering
    const { limit = 20000, transaction_id, message_id, bap_id } = req.query;
    
    // Build query based on filters
    const query = {};
    if (transaction_id) query['context.transaction_id'] = transaction_id;
    if (message_id) query['context.message_id'] = message_id;
    if (bap_id) query['context.bap_id'] = bap_id;
    
    // Get search requests with pagination and filtering
    const searchRequests = await SearchData.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));
    
    // Process data to handle undefined context properties
    const safeRequests = searchRequests.map(request => {
      const safeRequest = request.toObject();
      if (!safeRequest.context) {
        safeRequest.context = {};
      }
      return safeRequest;
    });
    
    // Return formatted response
    res.json({
      count: searchRequests.length,
      total_in_db: await SearchData.countDocuments(),
      filters_applied: { transaction_id, message_id, bap_id, limit },
      requests: safeRequests
    });
    
  } catch (error) {
    console.error('Error in /search/debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;