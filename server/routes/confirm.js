const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse, extractSafePayload, createTransactionTrailData } = require('../utils/contextValidator');

// BPP configuration
const BPP_ID = process.env.BPP_ID || 'ondc.bpp.com';
const BPP_URI = process.env.BPP_URI || 'https://ondc.bpp.com/api';

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

// Store transaction trail
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
    // Retry once after a short delay
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const trail = new TransactionTrail(data);
      await trail.save();
      console.log(`✅ Transaction trail stored (retry): ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
    } catch (retryError) {
      console.error('❌ Failed to store transaction trail (retry):', retryError);
    }
  }
}

// /confirm API - Buyer app sends confirm request
router.post('/', async (req, res) => {
  try {
    // Extract safe payload using shared utility
    const { safeContext, safeMessage, isValid, errors } = extractSafePayload(req.body, 'confirm');
    
    console.log('=== INCOMING CONFIRM REQUEST ===');
    console.log('Transaction ID:', safeContext.transaction_id);
    console.log('Message ID:', safeContext.message_id);
    console.log('BAP ID:', safeContext.bap_id);
    console.log('Domain:', safeContext.domain);
    console.log('Action:', safeContext.action);
    console.log('================================');
    
    // Store all incoming requests regardless of validation
    try {
      const incomingData = new ConfirmData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: req.body?.context || {},
        message: req.body?.message || {},
        order: req.body?.message?.order || {},
        created_at: new Date()
      });
      await incomingData.save();
      console.log(`✅ Raw confirm data stored: ${safeContext.transaction_id}/${safeContext.message_id}`);
    } catch (storeErr) {
      console.error('❌ Failed to store raw confirm request:', storeErr.message);
      // Retry once after a short delay
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const incomingData = new ConfirmData({
          transaction_id: safeContext.transaction_id,
          message_id: safeContext.message_id,
          context: req.body?.context || {},
          message: req.body?.message || {},
          order: req.body?.message?.order || {},
          created_at: new Date()
        });
        await incomingData.save();
        console.log(`✅ Raw confirm data stored (retry): ${safeContext.transaction_id}/${safeContext.message_id}`);
      } catch (retryErr) {
        console.error('❌ Failed to store raw confirm request (retry):', retryErr.message);
      }
    }

    // Basic validation
    if (!isValid) {
      const errorResponse = createErrorResponse('10001', `Invalid request: ${errors.join(', ')}`);
      await storeTransactionTrail(createTransactionTrailData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      }));
      return res.status(400).json(errorResponse);
    }

    // Validate message - confirm specific validation
    if (!safeMessage.order) {
      const errorResponse = createErrorResponse('10002', 'Invalid message: order is required');
      await storeTransactionTrail(createTransactionTrailData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'confirm',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI
      }));
      return res.status(400).json(errorResponse);
    }

    // Get init data for this transaction
    console.log('🔍 INIT DATA SEARCH RESULT:');
    console.log('- Transaction ID searched:', safeContext.transaction_id);
    const initData = await getInitDataForTransaction(safeContext.transaction_id);
    const hasInitData = !!initData;
    console.log('- Found init data:', hasInitData);

    // CONFIRM-SPECIFIC BILLING LOGIC
    // Check if we have the order and billing details
    const hasOrder = !!safeMessage.order;
    const hasBilling = !!safeMessage.order?.billing;
    
    console.log('⚠️  Billing check status:', { hasOrder, hasBilling, hasInitData });

    // If we have init data and confirm has billing, check timestamps
    let billingMatched = false;
    let initBillingCreatedAt = null;
    let confirmBillingCreatedAt = null;

    if (hasInitData && hasOrder && hasBilling) {
      // Extract billing timestamps
      initBillingCreatedAt = initData.message?.order?.billing?.created_at;
      confirmBillingCreatedAt = safeMessage.order?.billing?.created_at;
      
      // Check if billing timestamps match
      if (initBillingCreatedAt && confirmBillingCreatedAt && initBillingCreatedAt === confirmBillingCreatedAt) {
        billingMatched = true;
        console.log('✅ Billing timestamps match!');
        console.log('- Init billing created_at:', initBillingCreatedAt);
        console.log('- Confirm billing created_at:', confirmBillingCreatedAt);
      } else {
        console.log('❌ Billing timestamps do not match!');
        console.log('- Init billing created_at:', initBillingCreatedAt);
        console.log('- Confirm billing created_at:', confirmBillingCreatedAt);
      }
    }

    // Store the confirm data with billing match status
    try {
      const confirmData = new ConfirmData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: req.body?.context,
        message: req.body?.message,
        order: safeMessage.order,
        billing_matched: billingMatched,
        init_billing_created_at: initBillingCreatedAt,
        confirm_billing_created_at: confirmBillingCreatedAt,
        created_at: new Date()
      });
      await confirmData.save();
      console.log(`✅ Confirm data stored: ${safeContext.transaction_id}/${safeContext.message_id}`);
    } catch (error) {
      console.error('❌ Failed to store confirm data:', error.message);
      // Retry once after a short delay
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const confirmData = new ConfirmData({
          transaction_id: safeContext.transaction_id,
          message_id: safeContext.message_id,
          context: req.body?.context,
          message: req.body?.message,
          order: safeMessage.order,
          billing_matched: billingMatched,
          init_billing_created_at: initBillingCreatedAt,
          confirm_billing_created_at: confirmBillingCreatedAt,
          created_at: new Date()
        });
        await confirmData.save();
        console.log(`✅ Confirm data stored (retry): ${safeContext.transaction_id}/${safeContext.message_id}`);
      } catch (retryError) {
        console.error('❌ Failed to store confirm data (retry):', retryError.message);
      }
    }

    // Store transaction trail for successful request
    await storeTransactionTrail(createTransactionTrailData({
      transaction_id: safeContext.transaction_id,
      message_id: safeContext.message_id,
      action: 'confirm',
      direction: 'incoming',
      status: 'ACK',
      context: safeContext,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI
    }));

    // Return ACK response
    return res.status(200).json(createAckResponse());
  } catch (error) {
    console.error('❌ Error processing confirm request:', error);
    
    // Create a safe context from the request body
    const safeContext = ensureSafeContext(req.body?.context);
    
    // Store transaction trail for error
    await storeTransactionTrail(createTransactionTrailData({
      transaction_id: safeContext.transaction_id,
      message_id: safeContext.message_id,
      action: 'confirm',
      direction: 'incoming',
      status: 'NACK',
      context: safeContext,
      error: { type: 'INTERNAL-ERROR', code: '500', message: 'Internal server error' },
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI
    }));
    
    return res.status(500).json(createErrorResponse('10003', 'Internal server error'));
  }
});

// Debug endpoint to view stored data
router.get('/debug', async (req, res) => {
  try {
    const confirmRequests = await ConfirmData.find().sort({ created_at: -1 }).limit(50);
    const initRequests = await InitData.find().sort({ created_at: -1 }).limit(50);
    
    res.json({
      confirm_count: confirmRequests.length,
      init_count: initRequests.length,
      confirm_requests: confirmRequests.map(req => ({
        transaction_id: req.transaction_id,
        message_id: req.message_id,
        billing_matched: req.billing_matched,
        init_billing_created_at: req.init_billing_created_at,
        confirm_billing_created_at: req.confirm_billing_created_at,
        created_at: req.created_at
      })),
      init_requests: initRequests.map(req => ({
        transaction_id: req.transaction_id,
        message_id: req.message_id,
        billing_created_at: req.message?.order?.billing?.created_at,
        created_at: req.created_at
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to check init data for a specific transaction
router.get('/debug/:transaction_id', async (req, res) => {
  try {
    const { transaction_id } = req.params;
    const initData = await getInitDataForTransaction(transaction_id);
    const confirmData = await ConfirmData.find({ transaction_id }).sort({ created_at: -1 });
    
    res.json({
      transaction_id,
      init_data: initData ? {
        message_id: initData.message_id,
        billing: initData.message?.order?.billing,
        created_at: initData.created_at
      } : null,
      confirm_attempts: confirmData.map(item => ({
        message_id: item.message_id,
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