const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// BPP Configuration - These should be moved to a config file in a production environment
const BPP_IDS = ['preprod.99digicom.com', 'staging.99digicom.com'];
const BPP_URIS = ['https://preprod.99digicom.com', 'https://staging.99digicom.com'];
const BPP_ID = BPP_IDS[0];
const BPP_URI = BPP_URIS[0];

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
};

// Models
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

const TrackDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order_id: { type: String, index: true },
  created_at: { type: Date, default: Date.now }
});

const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const TrackData = mongoose.models.TrackData || mongoose.model('TrackData', TrackDataSchema);

// Utils
function validateContext(context) {
  const errors = [];
  if (!context) {
    errors.push('Context is required');
    return errors;
  }
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

function createErrorResponse(errorCode, message, context = null) {
  const error = ONDC_ERRORS[errorCode] || { type: 'CONTEXT-ERROR', code: errorCode, message };
  const response = {
    message: { ack: { status: 'NACK' } },
    error: { type: error.type, code: error.code, message: error.message }
  };
  if (context) response.context = context;
  return response;
}

function createAckResponse(context) {
  return { context, message: { ack: { status: 'ACK' } } };
}

async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
  }
}

// /track API - Buyer app sends track request
router.post('/', async (req, res) => {
  try {
    const payload = req.body;

    console.log('=== INCOMING TRACK REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id);
    console.log('Message ID:', payload?.context?.message_id);
    console.log('BAP ID:', payload?.context?.bap_id);
    console.log('Action:', payload?.context?.action);
    console.log('================================');

    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure', payload?.context || null);
      await storeTransactionTrail({
        transaction_id: payload?.context?.transaction_id || 'unknown',
        message_id: payload?.context?.message_id || 'unknown',
        action: 'track',
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

    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`, context);
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'track',
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

    // Persist track request
    try {
      const trackData = new TrackData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context,
        message,
        order_id: message.order_id
      });
      await trackData.save();
      console.log('✅ Track data saved to MongoDB Atlas');
    } catch (dbError) {
      console.error('❌ Failed to save track data:', dbError.message);
    }

    // Store ACK trail
    await storeTransactionTrail({
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      action: 'track',
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

    // Send ACK
    res.status(202).json(createAckResponse(context));

  } catch (error) {
    console.error('❌ Error in /track:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoint to view stored track requests
router.get('/debug', async (req, res) => {
  try {
    const trackRequests = await TrackData.find().sort({ created_at: -1 }).limit(50);
    res.json({ count: trackRequests.length, requests: trackRequests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;