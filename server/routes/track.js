const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { validateContext, ensureSafeContext, extractSafePayload, createErrorResponse, createAckResponse, createTransactionTrailData } = require('../utils/contextValidator');

// BPP Configuration
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Validators and response helpers are imported from utils/contextValidator

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
  raw_payload: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Register Models
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const TrackData = mongoose.models.TrackData || mongoose.model('TrackData', TrackDataSchema);

// Utility Functions
// Validation and response helpers are now imported; remove local implementations

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
// Mounted at '/track' and alias '/on_track'; use root path here
router.post('/', async (req, res) => {
  try {
    // Safely extract payload and create safe context
    const { payload, safeContext, message } = extractSafePayload(req);

    // Store raw incoming request (best-effort)
    try {
      const rawRecord = new TrackData({ raw_payload: payload, created_at: new Date(), transaction_id: safeContext.transaction_id, message_id: safeContext.message_id, context: safeContext, message, order_id: message.order_id || '' });
      await rawRecord.save();
    } catch (storeError) {
      console.error('❌ Failed to store raw track request:', storeError.message);
    }

  // Validate Context
  const contextErrors = validateContext(payload.context);
  if (contextErrors.length > 0) {
    const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
    await storeTransactionTrail(createTransactionTrailData({ error: errorResponse.error }, safeContext, 'track', 'NACK', { BPP_ID, BPP_URI }));
    return res.status(400).json(errorResponse);
  }

  // Validate Message
  if (!payload.message || !payload.message.order_id) {
    const errorResponse = createErrorResponse('10002', 'order_id is required in the message');
    await storeTransactionTrail(createTransactionTrailData({ error: errorResponse.error }, safeContext, 'track', 'NACK', { BPP_ID, BPP_URI }));
    return res.status(400).json(errorResponse);
  }

  // Store Track Data
  let retries = 0;
  const maxRetries = 3;
  while (retries < maxRetries) {
    try {
      const trackData = new TrackData({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        context: safeContext,
        message: payload.message,
        order_id: payload.message.order_id,
        raw_payload: payload
      });
      await trackData.save();
      console.log('✅ Track data saved to MongoDB Atlas database');
      break;
    } catch (dbError) {
      retries++;
      console.error(`❌ Failed to save track data to MongoDB Atlas (Attempt ${retries}/${maxRetries}):`, dbError.message);
      if (retries >= maxRetries) {
        console.error('❌ Max retries reached. Could not save track data.');
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Store transaction trail
  try {
    await storeTransactionTrail(createTransactionTrailData({ message: payload.message }, safeContext, 'track', 'ACK', { BPP_ID, BPP_URI }));
  } catch (trailError) {
    console.error('❌ Failed to store transaction trail:', trailError.message);
  }

  // Send ACK response with echoed safe context
  const ackWithContext = { ...createAckResponse(), context: safeContext };
  console.log('✅ Sending ACK response for track request');
  return res.status(202).json(ackWithContext);
} catch (error) {
  console.error('❌ Error in /track:', error);
  const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
  return res.status(500).json(errorResponse);
}
});

// --- Debug Endpoint to View Stored Track Data --- //
// Exposed as '/track/debug' and '/on_track/debug'
router.get('/debug', async (req, res) => {
  try {
    const tracks = await TrackData.find().sort({ created_at: -1 }).limit(50);
    const safeRequests = tracks.map(doc => {
      const safe = doc.toObject();
      safe.context = ensureSafeContext(safe.context);
      const requiredProps = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
      requiredProps.forEach(prop => {
        if (!safe.context[prop]) safe.context[prop] = '';
      });
      return safe;
    });
    res.json({ count: tracks.length, requests: safeRequests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;