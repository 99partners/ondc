const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// BPP Configuration - Pramaan Mock Handler
// const BPP_ID = 'staging.99digicom.com';
// const BPP_URI = 'https://staging.99digicom.com';

const BPP_IDS = ['preprod.99digicom.com', 'staging.99digicom.com'];
const BPP_URIS = ['https://preprod.99digicom.com', 'https://staging.99digicom.com'];
const BPP_ID = BPP_IDS[0];
const BPP_URI = BPP_URIS[0];

// ONDC Error Codes
const ONDC_ERRORS = {
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
};

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

// ----------------- VALIDATION (Pramaan Mock - Flexible) -----------------
function validateContext(context) {
  const errors = [];
  
  if (!context) {
    errors.push('Context is required');
    return errors;
  }

  // Core required fields
  const required = [
    'domain',
    'action',
    'core_version',
    'bap_id',
    'bap_uri',
    'transaction_id',
    'message_id',
    'timestamp'
  ];

  required.forEach((field) => {
    if (!context[field]) {
      errors.push(`${field} is required`);
    }
  });

  // Allow missing fields in Pramaan mock (warn only)
  if (!context.country) console.warn('⚠️  country missing (allowed for Pramaan mock)');
  if (!context.city) console.warn('⚠️  city missing (allowed for Pramaan mock)');
  if (!context.ttl) console.warn('⚠️  ttl missing (allowed for Pramaan mock)');

  return errors;
}

// ----------------- UTILITY FUNCTIONS -----------------
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

// ----------------- Pramaan Mock Search Endpoint -----------------
router.post('/pramaan', async (req, res) => {
  const payload = req.body;
  
  console.log('=== INCOMING SEARCH (Pramaan Mock) ===');
  console.log(JSON.stringify(payload, null, 2));

  // Validate request structure
  if (!payload?.context || !payload?.message) {
    console.error('❌ Invalid request structure');
    return res.status(400).json({
      message: { ack: { status: 'NACK' } },
      error: { message: 'Invalid request structure' },
    });
  }

  const { context, message } = payload;
  
  // Validate context (with Pramaan flexibility)
  const errors = validateContext(context);
  if (errors.length > 0) {
    console.error('❌ Context validation failed:', errors.join(', '));
    return res.status(400).json({
      message: { ack: { status: 'NACK' } },
      error: { message: `Invalid context: ${errors.join(', ')}` },
    });
  }

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
});

// Debug endpoint for Pramaan search data
router.get('/pramaan/debug', async (req, res) => {
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

