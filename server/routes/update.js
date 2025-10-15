const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// BPP Configuration - These should be moved to a config file in a production environment
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Import InitData model to access init request data
const InitDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  created_at: { type: Date, default: Date.now }
});

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

const UpdateDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const UpdateData = mongoose.models.UpdateData || mongoose.model('UpdateData', UpdateDataSchema);
const InitData = mongoose.models.InitData || mongoose.model('InitData', InitDataSchema);

// Function to get init data for a transaction
async function getInitDataForTransaction(transactionId) {
  try {
    const initData = await InitData.findOne({ transaction_id: transactionId }).sort({ created_at: -1 });
    return initData;
  } catch (error) {
    console.error('❌ Error retrieving init data:', error);
    return null;
  }
}

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
    console.error('❌ Error storing transaction trail:', error);
  }
}

// POST /update - Handle update requests
router.post('/', async (req, res) => {
  console.log('📝 Received update request');
  
  try {
    const { context, message } = req.body;
    
    // Validate context
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      console.error('❌ Context validation failed:', contextErrors);
      
      // Store transaction trail for NACK
      await storeTransactionTrail({
        transaction_id: context?.transaction_id || 'unknown',
        message_id: context?.message_id || 'unknown',
        action: context?.action || 'update',
        direction: 'incoming',
        status: 'NACK',
        context: context || {},
        error: { message: contextErrors.join(', ') },
        timestamp: new Date(),
        bap_id: context?.bap_id,
        bap_uri: context?.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI,
        domain: context?.domain,
        country: context?.country,
        city: context?.city,
        core_version: context?.core_version
      });
      
      return res.status(400).json(createErrorResponse('10001', contextErrors.join(', ')));
    }
    
    // Validate message
    if (!message) {
      console.error('❌ Message validation failed: Message is required');
      
      // Store transaction trail for NACK
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: context.action,
        direction: 'incoming',
        status: 'NACK',
        context,
        error: { message: 'Message is required' },
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
      
      return res.status(400).json(createErrorResponse('10002', 'Message is required'));
    }
    
    // Store transaction trail for ACK
    await storeTransactionTrail({
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      action: context.action,
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
    
    // Get init data to ensure billing.created_at timestamp consistency
    const initData = await getInitDataForTransaction(context.transaction_id);
    
    // CRITICAL: Ensure billing.created_at matches exactly with on_init
    if (message.order && message.order.billing) {
      // First try to get the timestamp from initData
      if (initData && initData.message && initData.message.order && initData.message.order.billing) {
        // Force exact string match for created_at timestamp
        const initCreatedAt = initData.message.order.billing.created_at;
        message.order.billing.created_at = initCreatedAt;
        
        console.log('✅ EXACT MATCH: Set billing.created_at to:', initCreatedAt);
        
        // Also ensure all other billing fields match exactly
        const initBilling = initData.message.order.billing;
        message.order.billing = { ...initBilling };
        
        console.log('✅ Copied entire billing object from on_init');
      } else {
        // If we can't find init data, we need to handle this case
        console.log('⚠️ WARNING: Could not find init billing data');
        
        // Store the current timestamp for debugging
        console.log('⚠️ Current billing.created_at:', message.order.billing.created_at);
      }
    }
    
    // Store update data
    const updateData = new UpdateData({
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      context,
      message,
      order: message.order,
      created_at: initData ? initData.created_at : new Date()
    });
    
    await updateData.save();
    console.log(`✅ Update data stored: ${context.transaction_id}/${context.message_id}`);
    
    // Send ACK response
    return res.status(200).json(createAckResponse());
  } catch (error) {
    console.error('❌ Error processing update request:', error);
    
    // Send error response
    return res.status(500).json(createErrorResponse('50000', 'Internal server error'));
  }
});

// GET /update/debug - Get recent update requests for debugging
router.get('/debug', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const updateData = await UpdateData.find().sort({ created_at: -1 }).limit(limit);
    
    return res.status(200).json({
      count: updateData.length,
      data: updateData
    });
  } catch (error) {
    console.error('❌ Error retrieving update data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;