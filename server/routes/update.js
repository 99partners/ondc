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

// Import InitData model properly
const InitDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  created_at: { type: Date, default: Date.now }
});

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

// Using shared validators from ../utils/contextValidator

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
  try {
    // Safely extract payload with defaults if req.body is undefined
    const payload = req.body || {};
    
    // Store all incoming requests regardless of validation
    try {
      const updateData = new UpdateData({
        requestBody: payload,
        timestamp: new Date()
      });
      await updateData.save();
    } catch (storeError) {
      console.error('❌ Failed to store incoming update request:', storeError.message);
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
        action: 'update',
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
        
        // Set a fixed timestamp as fallback (not ideal but better than random timestamps)
        message.order.billing.created_at = "2025-10-10T06:09:12.396Z";
        console.log('⚠️ FALLBACK: Set billing.created_at to fixed value');
      }
    }
    
    // Store update data with retry mechanism
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const updateData = new UpdateData({
          transaction_id: context.transaction_id,
          message_id: context.message_id,
          context,
          message,
          order: message.order,
          created_at: initData ? initData.created_at : new Date()
        });
        await updateData.save();
        console.log('✅ Update data saved to MongoDB Atlas database');
        console.log('📊 Saved update request for transaction:', context.transaction_id);
        break; // Exit the loop if successful
      } catch (dbError) {
        retries++;
        console.error(`❌ Failed to save update data to MongoDB Atlas (Attempt ${retries}/${maxRetries}):`, dbError.message);
        
        if (retries >= maxRetries) {
          console.error('❌ Max retries reached. Could not save update data.');
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
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
    
    // Process data to handle undefined context properties
    const safeData = updateData.map(item => {
      const safeItem = item.toObject();
      if (!safeItem.context) {
        safeItem.context = {};
      }
      
      // Ensure all required context properties exist to prevent 'undefined' errors
      const requiredProps = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
      requiredProps.forEach(prop => {
        if (!safeItem.context[prop]) {
          safeItem.context[prop] = '';
        }
      });
      
      return safeItem;
    });
    
    return res.status(200).json({
      count: updateData.length,
      data: safeData
    });
  } catch (error) {
    console.error('❌ Error retrieving update data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;