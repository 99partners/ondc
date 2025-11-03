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
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' },
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
function getInitDataForTransaction(transactionId) {
  return InitData.findOne({ transaction_id: transactionId }).sort({ created_at: -1 });
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

function createAcknowledgmentResponse(context) {
  return {
    context: {
      domain: context.domain,
      country: context.country,
      city: context.city,
      action: 'on_confirm',
      core_version: context.core_version,
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI,
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      timestamp: new Date().toISOString()
    },
    message: {
      ack: {
        status: 'ACK'
      }
    }
  };
}

// Function to store transaction trail
function storeTransactionTrail(data) {
  const trail = new TransactionTrail(data);
  return trail.save()
    .then(() => console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`))
    .catch(error => console.error('❌ Failed to store transaction trail:', error));
}

// /confirm API - Buyer app sends confirm request
router.post('/', (req, res) => {
  console.log('🔵 Received confirm request from buyer app');
  
  // Store the complete raw request for debugging and audit
  const rawRequest = req.body;
  console.log('📥 Raw request:', JSON.stringify(rawRequest, null, 2));
  
  // Create a raw request log entry
  const rawRequestLog = {
    endpoint: '/confirm',
    method: 'POST',
    headers: req.headers,
    body: rawRequest,
    timestamp: new Date(),
    ip: req.ip || req.connection.remoteAddress
  };
  
  // Store raw request in MongoDB (create a collection if needed)
  mongoose.connection.collection('raw_requests').insertOne(rawRequestLog)
    .then(() => console.log('✅ Raw request stored successfully'))
    .catch(err => console.error('❌ Failed to store raw request:', err));
  
  const { context, message } = req.body;
  console.log('📝 Context:', JSON.stringify(context, null, 2));
  console.log('📝 Message:', JSON.stringify(message, null, 2));
  
  // Validate context
  const contextErrors = validateContext(context);
  if (contextErrors.length > 0) {
    console.error('❌ Context validation failed:', contextErrors);
    const errorResponse = createErrorResponse('10001', 'Invalid context: ' + contextErrors.join(', '));
    
    // Store transaction trail for NACK
    storeTransactionTrail({
      transaction_id: context?.transaction_id || 'unknown',
      message_id: context?.message_id || 'unknown',
      action: 'confirm',
      direction: 'incoming',
      status: 'NACK',
      context,
      message,
      error: errorResponse.error,
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
    
    return res.status(400).json(errorResponse);
  }
  
  // Get init data for this transaction to override billing information
  getInitDataForTransaction(context.transaction_id)
    .then(initData => {
      // Store transaction trail for ACK
      storeTransactionTrail({
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
      
      // Store confirm data in MongoDB Atlas with retry mechanism and improved error handling
      console.log('🔄 Attempting to save confirm data to database...');
      
      // Create a direct document to insert
      const confirmDataDoc = {
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context: context,
        message: message,
        order: message.order,
        billing_matched: true,
        init_billing_created_at: initData?.created_at ? new Date(initData.created_at).toISOString() : null,
        confirm_billing_created_at: new Date().toISOString(),
        raw_request: rawRequestLog, // Store the complete raw request with headers and IP
        created_at: new Date()
      };
      
      const saveConfirmData = (retryCount = 0) => {
        const maxRetries = 3;
        
        // Use direct MongoDB collection insert instead of Mongoose
        return mongoose.connection.collection('confirmdatas').insertOne(confirmDataDoc)
          .then(result => {
            console.log('✅ Confirm data saved to MongoDB Atlas database with ID:', result.insertedId);
            console.log('📊 Saved confirm request for transaction:', context.transaction_id);
            
            // Send on_confirm response after a short delay
            setTimeout(() => {
              // Create on_confirm response
              const onConfirmResponse = {
                context: {
                  domain: context.domain,
                  country: context.country,
                  city: context.city,
                  action: 'on_confirm',
                  core_version: context.core_version,
                  bap_id: context.bap_id,
                  bap_uri: context.bap_uri,
                  bpp_id: BPP_ID,
                  bpp_uri: BPP_URI,
                  transaction_id: context.transaction_id,
                  message_id: context.message_id,
                  timestamp: new Date().toISOString()
                },
                message: {
                  order: {
                    id: message.order.id,
                    state: 'Accepted',
                    provider: message.order.provider,
                    items: message.order.items,
                    billing: message.order.billing,
                    fulfillment: message.order.fulfillment,
                    quote: message.order.quote,
                    payment: message.order.payment,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }
                }
              };
              
              // Store transaction trail for on_confirm
              storeTransactionTrail({
                transaction_id: context.transaction_id,
                message_id: context.message_id,
                action: 'on_confirm',
                direction: 'outgoing',
                status: 'ACK',
                context: onConfirmResponse.context,
                message: onConfirmResponse.message,
                timestamp: new Date()
              });
              
              console.log('🟢 Sending on_confirm response to buyer app');
            }, 500);
          })
          .catch(error => {
            console.error(`❌ Failed to save confirm data to MongoDB Atlas (Attempt ${retryCount + 1}/${maxRetries}):`, error.message);
            
            if (retryCount < maxRetries - 1) {
              console.log(`🔄 Retrying save operation in ${(retryCount + 1) * 1000}ms...`);
              setTimeout(() => saveConfirmData(retryCount + 1), (retryCount + 1) * 1000);
            } else {
              console.error('❌ Max retries reached. Could not save confirm data. Error:', error);
              // Try direct collection insert as a last resort
              try {
                mongoose.connection.db.collection('confirm_data_backup').insertOne(confirmDataDoc)
                  .then(() => console.log('✅ Saved to backup collection as last resort'))
                  .catch(err => console.error('❌ Even backup save failed:', err));
              } catch (finalError) {
                console.error('❌ Final attempt to save data failed:', finalError);
              }
            }
          });
      };
      
      saveConfirmData()
        .then(() => {
          // Send ACK response immediately
          res.json(createAcknowledgmentResponse(context));
        })
        .catch(error => {
          console.error('❌ Failed to save confirm data after all retries:', error);
          // Still send ACK response to maintain protocol flow
          res.json(createAcknowledgmentResponse(context));
        });
    })
    .catch(error => {
      console.error('❌ Error processing confirm request:', error);
      res.status(500).json(createErrorResponse('30000', 'Internal Server Error'));
    });
});

// Debug endpoint to view confirm requests
router.get('/debug', (req, res) => {
  // Get query parameters for filtering
  const { transaction_id, message_id, bap_id } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  
  // Build query based on filters
  const query = {};
  if (transaction_id) query.transaction_id = transaction_id;
  if (message_id) query.message_id = message_id;
  if (bap_id && bap_id !== 'undefined') {
    query['context.bap_id'] = bap_id;
  }
  
  ConfirmData.find(query).sort({ created_at: -1 }).limit(limit)
    .then(confirmRequests => {
      // Process data to handle undefined context properties
      const safeRequests = confirmRequests.map(request => {
        const safeRequest = request.toObject ? request.toObject() : {...request};
        if (!safeRequest.context) {
          safeRequest.context = {};
        }
        return safeRequest;
      });
      
      res.json({
        count: confirmRequests.length,
        filters: { transaction_id, message_id, bap_id, limit },
        requests: safeRequests
      });
    })
    .catch(error => {
      res.status(500).json({ error: error.message });
    });
}); 

// Endpoint to check init data for a specific transaction
router.get('/debug/:transaction_id', (req, res) => {
  const { transaction_id } = req.params;
  
  Promise.all([
    getInitDataForTransaction(transaction_id),
    ConfirmData.find({ transaction_id }).sort({ created_at: -1 })
  ])
  .then(([initData, confirmData]) => {
    res.json({
      transaction_id,
      init_data: initData ? {
        message_id: initData.message_id,
        billing: initData.message?.order?.billing,
        created_at: initData.created_at
      } : null,
      confirm_attempts: confirmData.map(item => ({
        message_id: item.message_id,
        created_at: item.created_at,
        billing_matched: item.billing_matched
      }))
    });
  })
  .catch(error => {
    res.status(500).json({ error: error.message });
  });
});

// Export router
module.exports = router;