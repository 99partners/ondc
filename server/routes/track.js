const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// BPP Configuration
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
};

// Transaction Trail Schema
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

// Track Data Schema
const TrackDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order_id: { type: String, index: true },
  created_at: { type: Date, default: Date.now }
});

// Register Models
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const TrackData = mongoose.models.TrackData || mongoose.model('TrackData', TrackDataSchema);

// Utility Functions
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
  if (!context.bpp_id) errors.push('bpp_id is required');
  if (!context.bpp_uri) errors.push('bpp_uri is required');
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

async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
  }
}


// --- Track Endpoint --- //
router.post('/track', async (req, res) => {
  const { context, message } = req.body;

  // Validate Context
  const contextErrors = validateContext(context);
  if (contextErrors.length > 0) {
    const errorResponse = createErrorResponse('10001', contextErrors.join(', '));
    await storeTransactionTrail({
      ...context,
      action: 'track',
      direction: 'incoming',
      status: 'NACK',
      error: errorResponse.error,
      timestamp: new Date()
    });
    return res.status(400).json(errorResponse);
  }

  // Validate Message
  if (!message || !message.order_id) {
    const errorResponse = createErrorResponse('10002', 'order_id is required in the message');
    await storeTransactionTrail({
      ...context,
      action: 'track',
      direction: 'incoming',
      status: 'NACK',
      error: errorResponse.error,
      timestamp: new Date()
    });
    return res.status(400).json(errorResponse);
  }

  // Store Track Data
  try {
    const trackData = new TrackData({
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      context: context,
      message: message,
      order_id: message.order_id
    });
    await trackData.save();
    console.log(`✅ Track data stored: ${trackData.transaction_id}/${trackData.message_id}`);

    // Store Transaction Trail
    await storeTransactionTrail({
      ...context,
      action: 'track',
      direction: 'incoming',
      status: 'ACK',
      message: message,
      timestamp: new Date()
    });

    // Send ACK Response
    const ackResponse = createAckResponse();
    res.json(ackResponse);

  } catch (error) {
    console.error('❌ Error storing track data:', error);
    const errorResponse = createErrorResponse('500', 'Internal Server Error');
    await storeTransactionTrail({
      ...context,
      action: 'track',
      direction: 'incoming',
      status: 'NACK',
      error: errorResponse.error,
      timestamp: new Date()
    });
    res.status(500).json(errorResponse);
  }
});

// --- Debug Endpoint to View Stored Track Data --- //
router.get('/debug/track', async (req, res) => {
  try {
    const tracks = await TrackData.find().sort({ created_at: -1 }).limit(50);
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;