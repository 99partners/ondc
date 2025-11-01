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
//   raw_payload: { type: Object, required: true }, // Store the complete raw request
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
//     // Safely extract payload with defaults if req.body is undefined
//     const payload = req.body || {};
    
//     console.log('=== INCOMING CONFIRM REQUEST ===');
//     console.log('Transaction ID:', payload?.context?.transaction_id);
//     console.log('Message ID:', payload?.context?.message_id);
//     console.log('BAP ID:', payload?.context?.bap_id);
//     console.log('Domain:', payload?.context?.domain);
//     console.log('Action:', payload?.context?.action);
//     console.log('Full Request Payload:', JSON.stringify(payload, null, 2));
//     console.log('================================');
    
//     // Store ALL incoming requests immediately regardless of validation
//     try {
//       // Create a deep copy of the payload to avoid reference issues
//       const rawPayload = JSON.parse(JSON.stringify(payload));
      
//       const confirmData = new ConfirmData({
//         transaction_id: payload?.context?.transaction_id || 'unknown',
//         message_id: payload?.context?.message_id || 'unknown',
//         context: payload?.context || {},
//         message: payload?.message || {},
//         order: payload?.message?.order || {},
//         raw_payload: rawPayload, // Store the complete raw request
//         created_at: new Date()
//       });
      
//       // Use await to ensure the data is saved before proceeding
//       await confirmData.save();
//       console.log('✅ Confirm data saved to MongoDB Atlas database');
//       console.log('📊 Saved confirm request for transaction:', payload?.context?.transaction_id || 'unknown');
//     } catch (dbError) {
//       console.error('❌ Failed to save confirm data to MongoDB Atlas:', dbError.message);
//       // Continue execution but log the error
//     }
    
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
const { validateContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Schemas
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
  created_at: { type: Date, default: Date.now }
});

const TransactionTrail =
  mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);

const ConfirmData =
  mongoose.models.ConfirmData || mongoose.model('ConfirmData', ConfirmDataSchema);

// Helper to store transaction trail
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}`);
  } catch (err) {
    console.error('❌ Failed to store transaction trail:', err.message);
  }
}

// /confirm POST route
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};

    console.log('=== INCOMING CONFIRM REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id || 'undefined');
    console.log('Message ID:', payload?.context?.message_id || 'undefined');
    console.log('BAP ID:', payload?.context?.bap_id || 'undefined');
    console.log('Domain:', payload?.context?.domain || 'undefined');
    console.log('Action:', payload?.context?.action || 'undefined');
    console.log('================================');

    // Safe context fallback
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

    // Always store raw incoming data
    try {
      const confirmData = new ConfirmData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: payload.context || {},
        message: payload.message || {},
        order: payload?.message?.order || {},
      });
      await confirmData.save();
      console.log('✅ Raw confirm data saved for audit purposes');
    } catch (err) {
      console.error('❌ Failed to save raw confirm data:', err.message);
    }

    // Basic validation
    if (!payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid confirm request structure');
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

    // Validate ONDC context
    const contextErrors = validateContext(payload.context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
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

    // Store valid confirm data (deep copy)
    try {
      const confirmData = new ConfirmData({
        transaction_id: payload.context.transaction_id,
        message_id: payload.context.message_id,
        context: JSON.parse(JSON.stringify(payload.context)),
        message: JSON.parse(JSON.stringify(payload.message)),
        order: payload.message.order ? JSON.parse(JSON.stringify(payload.message.order)) : undefined
      });
      await confirmData.save();
      console.log('✅ Confirm data saved to MongoDB Atlas for transaction:', payload.context.transaction_id);
    } catch (err) {
      console.error('❌ Failed to store confirm data to MongoDB:', err.message);
    }

    // Store transaction trail (ACK)
    await storeTransactionTrail({
      transaction_id: payload.context.transaction_id,
      message_id: payload.context.message_id,
      action: 'confirm',
      direction: 'incoming',
      status: 'ACK',
      context: payload.context,
      message: payload.message,
      timestamp: new Date(),
      bap_id: payload.context.bap_id,
      bap_uri: payload.context.bap_uri,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI,
      domain: payload.context.domain,
      country: payload.context.country,
      city: payload.context.city,
      core_version: payload.context.core_version
    });

    // Send ACK response
    const ackResponse = createAckResponse();
    console.log('✅ Sending ACK for confirm request');
    return res.status(202).json(ackResponse);

  } catch (err) {
    console.error('❌ Error in /confirm endpoint:', err.message);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${err.message}`);
    return res.status(500).json(errorResponse);
  }
});

// Debug endpoint for /confirm
router.get('/debug', async (req, res) => {
  try {
    const { limit = 20000, transaction_id, message_id, bap_id } = req.query;

    const query = {};
    if (transaction_id) query['context.transaction_id'] = transaction_id;
    if (message_id) query['context.message_id'] = message_id;
    if (bap_id) query['context.bap_id'] = bap_id;

    const confirmRequests = await ConfirmData.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    const safeRequests = confirmRequests.map(r => {
      const o = r.toObject();
      if (!o.context) o.context = {};
      return o;
    });

    res.json({
      count: confirmRequests.length,
      total_in_db: await ConfirmData.countDocuments(),
      filters_applied: { transaction_id, message_id, bap_id, limit },
      requests: safeRequests
    });
  } catch (err) {
    console.error('Error in /confirm/debug:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
