const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(CORS_ORIGINS.length ? cors({ origin: CORS_ORIGINS }) : cors());
app.use(bodyParser.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// MongoDB Atlas Configuration - Using your provided URI
const MONGODB_URI = 'mongodb+srv://99partnersin:99Partnersin@ondcseller.nmuucu3.mongodb.net/ondcSeller?retryWrites=true&w=majority&appName=ondcSeller';

// BPP Configuration
const BPP_ID =  'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Health endpoint
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' }, // Updated message for clarity
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
};

// Transaction Trail Model
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

const TransactionTrail = mongoose.model('TransactionTrail', TransactionTrailSchema);

// Search Data Model - This stores all incoming /search requests
const SearchDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  intent: { type: Object },
  created_at: { type: Date, default: Date.now }
});

const SearchData = mongoose.model('SearchData', SearchDataSchema);

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
    // FIX APPLIED: context.bpp_id and context.bpp_uri are NOT required in an INCOMING /search request
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

// /search API - Buyer app sends search request
app.post('/search', async (req, res) => {
  try {
    const payload = req.body;
    
    console.log('=== INCOMING SEARCH REQUEST ===');
    console.log('Transaction ID:', payload?.context?.transaction_id);
    console.log('Message ID:', payload?.context?.message_id);
    console.log('BAP ID:', payload?.context?.bap_id);
    console.log('Domain:', payload?.context?.domain);
    console.log('Action:', payload?.context?.action);
    console.log('================================');
    
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: payload?.context?.transaction_id || 'unknown',
        message_id: payload?.context?.message_id || 'unknown',
        action: 'search',
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
    
    // Validate context
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        action: 'search',
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

    // Store search data in MongoDB Atlas - MANDATORY as requested
    try {
      const searchData = new SearchData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context,
        message,
        intent: message.intent
      });
      await searchData.save();
      console.log('✅ Search data saved to MongoDB Atlas database');
      console.log('📊 Saved search request for transaction:', context.transaction_id);
    } catch (dbError) {
      console.error('❌ Failed to save search data to MongoDB Atlas:', dbError.message);
      // Continue execution but log the error
    }

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
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
    const ackResponse = createAckResponse();
    console.log('✅ Sending ACK response for search request');
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('❌ Error in /search:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoints to view stored data
app.get('/debug/search-requests', async (req, res) => {
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

app.get('/debug/transactions', async (req, res) => {
  try {
    const transactions = await TransactionTrail.find().sort({ created_at: -1 }).limit(100);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect to MongoDB Atlas and start server
console.log('🔗 Connecting to MongoDB Atlas...');
console.log('Database:', 'ondcseller.nmuucu3.mongodb.net/ondcSeller');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 60000,
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas successfully!');
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`🚀 ONDC Seller BPP listening on http://localhost:${PORT}`);
      console.log('📊 Debug endpoints available:');
      console.log(`   - http://localhost:${PORT}/debug/search-requests`);
      console.log(`   - http://localhost:${PORT}/debug/transactions`);
      console.log('🔍 All incoming /search requests will be stored in MongoDB Atlas');
    });
  }
})
.catch(err => {
  console.error('❌ MongoDB Atlas connection error:', err.message);
  console.log('⚠️  Server will start anyway with limited functionality');
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`🚀 ONDC Seller BPP listening on http://localhost:${PORT} (MongoDB unavailable)`);
    });
  }
});

module.exports = { app };