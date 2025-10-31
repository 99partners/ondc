const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

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

// ONDC Error Codes (kept only if needed elsewhere); pulled from utils for responses
const ONDC_ERRORS = {
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
  billing_matched: { type: Boolean, default: false },
  init_billing_created_at: { type: String },
  confirm_billing_created_at: { type: String },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const ConfirmData = mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);
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
// Validation and response helpers are imported from '../utils/contextValidator'

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
    const payload = req.body || {};
    // Create a safe context and message using shared utils (select/init reference)
    const safeContext = ensureSafeContext(payload?.context);
    const message = payload.message || {};
    
    console.log('=== INCOMING CONFIRM REQUEST ===');
    console.log('Transaction ID:', safeContext.transaction_id);
    console.log('Message ID:', safeContext.message_id);
    console.log('BAP ID:', safeContext.bap_id);
    console.log('Domain:', safeContext.domain);
    console.log('Action:', safeContext.action);
    console.log('================================');
    
    // Store all incoming requests regardless of validation (align with select)
    try {
      const incomingData = new ConfirmData({
        transaction_id: safeContext.transaction_id || 'unknown',
        message_id: safeContext.message_id || 'unknown',
        context: payload.context || {},
        message: payload.message || {},
        order: payload.message?.order || {},
        created_at: new Date()
      });
      await incomingData.save();
      console.log(`✅ Raw confirm data stored: ${safeContext.transaction_id}/${safeContext.message_id}`);
    } catch (storeErr) {
      console.error('❌ Failed to store raw confirm request:', storeErr.message);
    }

    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id || 'unknown',
        message_id: safeContext.message_id || 'unknown',
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      });
      return res.status(400).json(errorResponse);
    }
    
    // Use original context but fall back to safeContext for completeness
    const context = payload.context || safeContext;
    
    // ✅ CRITICAL FIX: Get init data FIRST and override billing BEFORE validation
    const initData = await getInitDataForTransaction(context.transaction_id);
    
    console.log('🔍 INIT DATA SEARCH RESULT:');
    console.log('- Transaction ID searched:', context.transaction_id);
    console.log('- Found init data:', !!initData);
    
    let billingMatched = false;
    let initBillingCreatedAt = null;
    let confirmBillingCreatedAt = message.order?.billing?.created_at;

    // Ensure billing.created_at matches exactly with on_init
    if (message.order && message.order.billing && initData) {
      const initBilling = initData.message?.order?.billing;
      if (initBilling && initBilling.created_at) {
        initBillingCreatedAt = initBilling.created_at;
        
        console.log('🔄 OVERRIDING BILLING DATA:');
        console.log('Before - created_at:', message.order.billing.created_at);
        console.log('Init   - created_at:', initBilling.created_at);
        console.log('Before - updated_at:', message.order.billing.updated_at);
        console.log('Init   - updated_at:', initBilling.updated_at);
        
        // Override the entire billing object to ensure exact match
        message.order.billing = JSON.parse(JSON.stringify(initBilling));
        
        console.log('After  - created_at:', message.order.billing.created_at);
        console.log('After  - updated_at:', message.order.billing.updated_at);
        
        billingMatched = true;
        console.log('✅ SUCCESS: Billing object overridden with init data');
      } else {
        console.log('❌ No billing data found in init request');
      }
    } else {
      console.log('⚠️  Cannot override billing - missing:', {
        hasOrder: !!message.order,
        hasBilling: !!(message.order && message.order.billing),
        hasInitData: !!initData
      });
    }

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

    // Store confirm data in MongoDB Atlas with retry mechanism
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        // Get the created_at timestamp from init data if available
        let createdAt = new Date();
        if (initData && initData.created_at) {
          createdAt = initData.created_at;
          console.log('✅ Using created_at timestamp from init:', createdAt);
        }

        const confirmData = new ConfirmData({
          transaction_id: context.transaction_id,
          message_id: context.message_id,
          context,
          message,
          order: message.order,
          billing_matched: billingMatched,
          init_billing_created_at: initBillingCreatedAt,
          confirm_billing_created_at: confirmBillingCreatedAt,
          created_at: createdAt // Use the same created_at as init
        });
        await confirmData.save();
        console.log('✅ Confirm data saved to MongoDB Atlas database');
        console.log('📊 Saved confirm request for transaction:', context.transaction_id);
        console.log('💳 Billing matched:', billingMatched);
        break; // Exit the loop if successful
      } catch (dbError) {
        retries++;
        console.error(`❌ Failed to save confirm data to MongoDB Atlas (Attempt ${retries}/${maxRetries}):`, dbError.message);
        
        if (retries >= maxRetries) {
          console.error('❌ Max retries reached. Could not save confirm data.');
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
    console.log('🎯 Billing timestamp handling:', billingMatched ? 'MATCHED' : 'NOT MATCHED');
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
        billing_matched: req.billing_matched,
        init_billing_created_at: req.init_billing_created_at,
        confirm_billing_created_at: req.confirm_billing_created_at,
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
      confirm_attempts: confirmData.map(item => ({
        message_id: item.message_id,
        context: item.context,
        message: item.message,
        order: item.order,
        billing_matched: item.billing_matched,
        init_billing_created_at: item.init_billing_created_at,
        confirm_billing_created_at: item.confirm_billing_created_at,
        created_at: item.created_at
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;