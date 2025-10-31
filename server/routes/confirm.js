// const express = require('express');
// const router = express.Router();
// const mongoose = require('mongoose');

// // BPP Configuration - These should be moved to a config file in a production environment
// const BPP_ID = 'staging.99digicom.com';
// const BPP_URI = 'https://staging.99digicom.com';

// // Import InitData model to access init request data
// const InitDataSchema = new mongoose.Schema({
//   transaction_id: { type: String, required: true, index: true },
//   message_id: { type: String, required: true, index: true },
//   context: { type: Object, required: true },
//   message: { type: Object, required: true },
//   order: { type: Object },
//   created_at: { type: Date, default: Date.now }
// });

// // ONDC Error Codes
// const ONDC_ERRORS = {
//   '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
//   '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
//   '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' },
//   '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
// };

// // Import models - These should be moved to separate model files in a production environment
// const TransactionTrailSchema = new mongoose.Schema({
//   transaction_id: { type: String, required: true, index: true },
//   message_id: { type: String, required: true, index: true },
//   action: { type: String, required: true },
//   direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
//   status: { type: String, enum: ['ACK', 'NACK'], required: true },
//   context: { type: Object, required: true },
//   message: { type: Object },
//   error: { type: Object },
//   timestamp: { type: Date, required: true },
//   bap_id: { type: String, index: true },
//   bap_uri: { type: String },
//   bpp_id: { type: String, index: true },
//   bpp_uri: { type: String },
//   domain: { type: String },
//   country: { type: String },
//   city: { type: String },
//   core_version: { type: String },
//   created_at: { type: Date, default: Date.now }
// });

// const ConfirmDataSchema = new mongoose.Schema({
//   transaction_id: { type: String, required: true, index: true },
//   message_id: { type: String, required: true, index: true },
//   context: { type: Object, required: true },
//   message: { type: Object, required: true },
//   order: { type: Object },
//   created_at: { type: Date, default: Date.now }
// });

// // Check if models are already registered to avoid OverwriteModelError
// const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
// const ConfirmData = mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);
// const InitData = mongoose.models.InitData || mongoose.model('InitData', InitDataSchema);

// // Function to get init data for a transaction
// async function getInitDataForTransaction(transactionId) {
//   try {
//     const initData = await InitData.findOne({ transaction_id: transactionId }).sort({ created_at: -1 });
//     return initData;
//   } catch (error) {
//     console.error('❌ Error retrieving init data:', error);
//     return null;
//   }
// }

// // Utility Functions
// function validateContext(context) {
//   const errors = [];
  
//   if (!context) {
//     errors.push('Context is required');
//     return errors;
//   }
  
//   // --- ONDC Mandatory Context Fields for BAP -> BPP Request (as per V1.2.0) ---
//   if (!context.domain) errors.push('domain is required');
//   if (!context.country) errors.push('country is required');
//   if (!context.city) errors.push('city is required');
//   if (!context.action) errors.push('action is required');
//   if (!context.core_version) errors.push('core_version is required');
//   if (!context.bap_id) errors.push('bap_id is required');
//   if (!context.bap_uri) errors.push('bap_uri is required');
//   if (!context.transaction_id) errors.push('transaction_id is required');
//   if (!context.message_id) errors.push('message_id is required');
//   if (!context.timestamp) errors.push('timestamp is required');
//   if (!context.ttl) errors.push('ttl is required');
  
//   return errors;
// }

// function createErrorResponse(errorCode, message) {
//   const error = ONDC_ERRORS[errorCode] || { type: 'CONTEXT-ERROR', code: errorCode, message };
//   return {
//     message: { ack: { status: 'NACK' } },
//     error: {
//       type: error.type,
//       code: error.code,
//       message: error.message
//     }
//   };
// }

// function createAckResponse() {
//   return {
//     message: { ack: { status: 'ACK' } }
//   };
// }

// // Store transaction trail
// async function storeTransactionTrail(data) {
//   try {
//     const trail = new TransactionTrail(data);
//     await trail.save();
//     console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
//   } catch (error) {
//     console.error('❌ Failed to store transaction trail:', error);
//   }
// }

// // /confirm API - Buyer app sends confirm request
// router.post('/', async (req, res) => {
//   try {
//     const payload = req.body;
    
//     console.log('=== INCOMING CONFIRM REQUEST ===');
//     console.log('Transaction ID:', payload?.context?.transaction_id);
//     console.log('Message ID:', payload?.context?.message_id);
//     console.log('BAP ID:', payload?.context?.bap_id);
//     console.log('Domain:', payload?.context?.domain);
//     console.log('Action:', payload?.context?.action);
//     console.log('================================');
    
//     // Validate payload structure
//     if (!payload || !payload.context || !payload.message) {
//       const errorResponse = createErrorResponse('10001', 'Invalid request structure');
//       await storeTransactionTrail({
//         transaction_id: payload?.context?.transaction_id || 'unknown',
//         message_id: payload?.context?.message_id || 'unknown',
//         action: 'confirm',
//         direction: 'incoming',
//         status: 'NACK',
//         context: payload?.context || {},
//         error: errorResponse.error,
//         timestamp: new Date(),
//         bap_id: payload?.context?.bap_id,
//         bap_uri: payload?.context?.bap_uri,
//         bpp_id: BPP_ID,
//         bpp_uri: BPP_URI
//       });
//       return res.status(400).json(errorResponse);
//     }

//     const { context, message } = payload;
    
//     // Validate context
//     const contextErrors = validateContext(context);
//     if (contextErrors.length > 0) {
//       const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
//       await storeTransactionTrail({
//         transaction_id: context.transaction_id,
//         message_id: context.message_id,
//         action: 'confirm',
//         direction: 'incoming',
//         status: 'NACK',
//         context,
//         error: errorResponse.error,
//         timestamp: new Date(),
//         bap_id: context.bap_id,
//         bap_uri: context.bap_uri,
//         bpp_id: BPP_ID,
//         bpp_uri: BPP_URI
//       });
//       return res.status(400).json(errorResponse);
//     }

//     // Get init data to reuse billing timestamp
//     const initData = await getInitDataForTransaction(context.transaction_id);
    
//     // CRITICAL: Ensure billing.created_at matches exactly with on_init
//     if (message.order && message.order.billing) {
//       // First try to get the timestamp from initData
//       if (initData && initData.message && initData.message.order && initData.message.order.billing) {
//         // Force exact string match for created_at timestamp
//         const initCreatedAt = initData.message.order.billing.created_at;
//         message.order.billing.created_at = initCreatedAt;
        
//         console.log('✅ EXACT MATCH: Set billing.created_at to:', initCreatedAt);
        
//         // Also ensure all other billing fields match exactly
//         const initBilling = initData.message.order.billing;
//         message.order.billing = { ...initBilling };
        
//         console.log('✅ Copied entire billing object from on_init');
//       } else {
//         // If we can't find init data, we need to handle this case
//         console.log('⚠️ WARNING: Could not find init billing data');
        
//         // Store the current timestamp for debugging
//         console.log('⚠️ Current billing.created_at:', message.order.billing.created_at);
        
//         // Set a fixed timestamp as fallback (not ideal but better than random timestamps)
//         message.order.billing.created_at = "2025-10-10T06:09:12.396Z";
//         console.log('⚠️ FALLBACK: Set billing.created_at to fixed value');
//       }
//     }
    
//     // Store confirm data in MongoDB Atlas
//     try {
//       // Get the created_at timestamp from init data if available
//       let createdAt = new Date();
//       if (initData && initData.created_at) {
//         createdAt = initData.created_at;
//         console.log('✅ Using created_at timestamp from init:', createdAt);
//       }

//       const confirmData = new ConfirmData({
//         transaction_id: context.transaction_id,
//         message_id: context.message_id,
//         context,
//         message,
//         order: message.order,
//         created_at: createdAt // Use the same created_at as init
//       });
//       await confirmData.save();
//       console.log('✅ Confirm data saved to MongoDB Atlas database');
//       console.log('📊 Saved confirm request for transaction:', context.transaction_id);
//     } catch (dbError) {
//       console.error('❌ Failed to save confirm data to MongoDB Atlas:', dbError.message);
//       // Continue execution but log the error
//     }

//     // Store transaction trail in MongoDB Atlas - MANDATORY for audit
//     try {
//       await storeTransactionTrail({
//         transaction_id: context.transaction_id,
//         message_id: context.message_id,
//         action: 'confirm',
//         direction: 'incoming',
//         status: 'ACK',
//         context,
//         message,
//         timestamp: new Date(),
//         bap_id: context.bap_id,
//         bap_uri: context.bap_uri,
//         bpp_id: BPP_ID,
//         bpp_uri: BPP_URI,
//         domain: context.domain,
//         country: context.country,
//         city: context.city,
//         core_version: context.core_version
//       });
//     } catch (trailError) {
//       console.error('❌ Failed to store transaction trail:', trailError.message);
//     }

//     // Send ACK response
//     const ackResponse = createAckResponse();
//     console.log('✅ Sending ACK response for confirm request');
//     res.status(202).json(ackResponse);
    
//   } catch (error) {
//     console.error('❌ Error in /confirm:', error);
//     const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
//     res.status(500).json(errorResponse);
//   }
// });

// // Debug endpoint to view stored data
// router.get('/debug', async (req, res) => {
//   try {
//     const confirmRequests = await ConfirmData.find().sort({ created_at: -1 }).limit(50);
//     res.json({
//       count: confirmRequests.length,
//       requests: confirmRequests
//     });
    
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;

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
    console.error('❌ Failed to store transaction trail:', error);
  }
}

// Main route handler
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