const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Middleware
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(CORS_ORIGINS.length ? cors({ origin: CORS_ORIGINS }) : cors());
app.use(bodyParser.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_DEV_URI = 'mongodb://localhost:27017/ondc_seller';
const DEFAULT_PROD_URI = 'mongodb+srv://99partnersin:99Partnersin@ondcseller.nmuucu3.mongodb.net/ondcSeller?retryWrites=true&w=majority&appName=ondcSeller';
const MONGODB_URI = process.env.MONGODB_URI || (NODE_ENV === 'production' ? DEFAULT_PROD_URI : DEFAULT_DEV_URI);

// BPP Configuration
const BPP_ID = process.env.BPP_ID || 'staging.99digicom.com';
const BPP_URI = process.env.BPP_URI || 'https://staging.99digicom.com';

// Health endpoint
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' },
  '10003': { type: 'CONTEXT-ERROR', code: '10003', message: 'Invalid signature' },
  '10004': { type: 'CONTEXT-ERROR', code: '10004', message: 'Invalid domain' },
  '10005': { type: 'CONTEXT-ERROR', code: '10005', message: 'Invalid country' },
  '10006': { type: 'CONTEXT-ERROR', code: '10006', message: 'Invalid city' },
  '10007': { type: 'CONTEXT-ERROR', code: '10007', message: 'Invalid action' },
  '10008': { type: 'CONTEXT-ERROR', code: '10008', message: 'Invalid core_version' },
  '10009': { type: 'CONTEXT-ERROR', code: '10009', message: 'Invalid bap_id' },
  '10010': { type: 'CONTEXT-ERROR', code: '10010', message: 'Invalid bap_uri' },
  '10011': { type: 'CONTEXT-ERROR', code: '10011', message: 'Invalid bpp_id' },
  '10012': { type: 'CONTEXT-ERROR', code: '10012', message: 'Invalid bpp_uri' },
  '10013': { type: 'CONTEXT-ERROR', code: '10013', message: 'Invalid transaction_id' },
  '10014': { type: 'CONTEXT-ERROR', code: '10014', message: 'Invalid message_id' },
  '10015': { type: 'CONTEXT-ERROR', code: '10015', message: 'Invalid timestamp' },
  '10016': { type: 'CONTEXT-ERROR', code: '10016', message: 'Invalid ttl' },
  '10017': { type: 'CONTEXT-ERROR', code: '10017', message: 'Invalid key' },
  '10018': { type: 'CONTEXT-ERROR', code: '10018', message: 'Invalid encryption' },
  '10019': { type: 'CONTEXT-ERROR', code: '10019', message: 'Invalid signature' },
  '10020': { type: 'CONTEXT-ERROR', code: '10020', message: 'Invalid signature' },
  '10021': { type: 'CONTEXT-ERROR', code: '10021', message: 'Invalid signature' },
  '10022': { type: 'CONTEXT-ERROR', code: '10022', message: 'Invalid signature' },
  '10023': { type: 'CONTEXT-ERROR', code: '10023', message: 'Invalid signature' },
  '10024': { type: 'CONTEXT-ERROR', code: '10024', message: 'Invalid signature' },
  '10025': { type: 'CONTEXT-ERROR', code: '10025', message: 'Invalid signature' },
  '10026': { type: 'CONTEXT-ERROR', code: '10026', message: 'Invalid signature' },
  '10027': { type: 'CONTEXT-ERROR', code: '10027', message: 'Invalid signature' },
  '10028': { type: 'CONTEXT-ERROR', code: '10028', message: 'Invalid signature' },
  '10029': { type: 'CONTEXT-ERROR', code: '10029', message: 'Invalid signature' },
  '10030': { type: 'CONTEXT-ERROR', code: '10030', message: 'Invalid signature' },
  '10031': { type: 'CONTEXT-ERROR', code: '10031', message: 'Invalid signature' },
  '10032': { type: 'CONTEXT-ERROR', code: '10032', message: 'Invalid signature' },
  '10033': { type: 'CONTEXT-ERROR', code: '10033', message: 'Invalid signature' },
  '10034': { type: 'CONTEXT-ERROR', code: '10034', message: 'Invalid signature' },
  '10035': { type: 'CONTEXT-ERROR', code: '10035', message: 'Invalid signature' },
  '10036': { type: 'CONTEXT-ERROR', code: '10036', message: 'Invalid signature' },
  '10037': { type: 'CONTEXT-ERROR', code: '10037', message: 'Invalid signature' },
  '10038': { type: 'CONTEXT-ERROR', code: '10038', message: 'Invalid signature' },
  '10039': { type: 'CONTEXT-ERROR', code: '10039', message: 'Invalid signature' },
  '10040': { type: 'CONTEXT-ERROR', code: '10040', message: 'Invalid signature' },
  '10041': { type: 'CONTEXT-ERROR', code: '10041', message: 'Invalid signature' },
  '10042': { type: 'CONTEXT-ERROR', code: '10042', message: 'Invalid signature' },
  '10043': { type: 'CONTEXT-ERROR', code: '10043', message: 'Invalid signature' },
  '10044': { type: 'CONTEXT-ERROR', code: '10044', message: 'Invalid signature' },
  '10045': { type: 'CONTEXT-ERROR', code: '10045', message: 'Invalid signature' },
  '10046': { type: 'CONTEXT-ERROR', code: '10046', message: 'Invalid signature' },
  '10047': { type: 'CONTEXT-ERROR', code: '10047', message: 'Invalid signature' },
  '10048': { type: 'CONTEXT-ERROR', code: '10048', message: 'Invalid signature' },
  '10049': { type: 'CONTEXT-ERROR', code: '10049', message: 'Invalid signature' },
  '10050': { type: 'CONTEXT-ERROR', code: '10050', message: 'Invalid signature' }
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
  correlation_id: { type: String, index: true },
  bap_id: { type: String, index: true },
  bap_uri: { type: String },
  bpp_id: { type: String, index: true },
  bpp_uri: { type: String },
  domain: { type: String },
  country: { type: String },
  city: { type: String },
  core_version: { type: String },
  ttl: { type: String },
  key: { type: String },
  encryption: { type: String },
  signature: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const TransactionTrail = mongoose.model('TransactionTrail', TransactionTrailSchema);

// Search Data Model
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

async function isStaleRequest(transactionId, messageId, timestamp) {
  try {
    // Check if we've already processed this transaction_id + message_id combination
    // and if the timestamp is older than the previously processed one
    const existing = await TransactionTrail.findOne({
      transaction_id,
      message_id,
      timestamp: { $gt: new Date(timestamp) }
    });
    return !!existing;
  } catch (error) {
    console.warn('Failed to check for stale request:', error.message);
    // If database is not available, assume request is not stale
    return false;
  }
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
    console.log(`Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('Failed to store transaction trail:', error);
  }
}

// /search API - Buyer app sends search request
app.post('/search', async (req, res) => {
  try {
    const payload = req.body;

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

    // Check for stale request
    const isStale = await isStaleRequest(context.transaction_id, context.message_id, context.timestamp);
    if (isStale) {
      const errorResponse = createErrorResponse('20002', 'Stale request detected');
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

    // Store search data (optional - continue even if DB fails)
    try {
      const searchData = new SearchData({
        transaction_id: context.transaction_id,
        message_id: context.message_id,
        context,
        message,
        intent: message.intent
      });
      await searchData.save();
      console.log('Search data saved to database');
    } catch (dbError) {
      console.warn('Failed to save search data to database:', dbError.message);
      // Continue execution even if database save fails
    }

    // Store transaction trail (optional - continue even if DB fails)
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
        bpp_uri: BPP_URI
      });
      console.log('Transaction trail stored');
    } catch (trailError) {
      console.warn('Failed to store transaction trail:', trailError.message);
      // Continue execution even if transaction trail fails
    }

    // Send ACK response
    const ackResponse = createAckResponse();
    res.status(202).json(ackResponse);

    // TODO: Trigger async /on_search callback to buyer app
    // This would typically be done in a separate process or queue
    
  } catch (error) {
    console.error('Error in /search:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// /on_search API - BPP sends search response to buyer app
app.post('/on_search', async (req, res) => {
  try {
    const payload = req.body;
    
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      return res.status(400).json(errorResponse);
    }

    const { context, message } = payload;
    
    // Validate context
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      return res.status(400).json(errorResponse);
    }

    // Store transaction trail
    await storeTransactionTrail({
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      action: 'on_search',
      direction: 'incoming',
      status: 'ACK',
      context,
      message,
      timestamp: new Date(),
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI
    });

    // Send ACK response
    const ackResponse = createAckResponse();
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('Error in /on_search:', error);
    const errorResponse = createErrorResponse('10002', 'Internal server error');
    res.status(500).json(errorResponse);
  }
});

// /select API - Buyer app sends item selection
app.post('/select', async (req, res) => {
  try {
    const payload = req.body;
    
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      return res.status(400).json(errorResponse);
    }

    const { context, message } = payload;
    
    // Validate context
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      return res.status(400).json(errorResponse);
    }

    // Store transaction trail
    await storeTransactionTrail({
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      action: 'select',
      direction: 'incoming',
      status: 'ACK',
      context,
      message,
      timestamp: new Date(),
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI
    });

    // Send ACK response
    const ackResponse = createAckResponse();
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('Error in /select:', error);
    const errorResponse = createErrorResponse('10002', 'Internal server error');
    res.status(500).json(errorResponse);
  }
});

// /init API - Buyer app sends order initialization
app.post('/init', async (req, res) => {
  try {
    const payload = req.body;
    
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      return res.status(400).json(errorResponse);
    }

    const { context, message } = payload;
    
    // Validate context
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      return res.status(400).json(errorResponse);
    }

    // Store transaction trail
    await storeTransactionTrail({
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      action: 'init',
      direction: 'incoming',
      status: 'ACK',
      context,
      message,
      timestamp: new Date(),
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI
    });

    // Send ACK response
    const ackResponse = createAckResponse();
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('Error in /init:', error);
    const errorResponse = createErrorResponse('10002', 'Internal server error');
    res.status(500).json(errorResponse);
  }
});

// /confirm API - Buyer app sends order confirmation
app.post('/confirm', async (req, res) => {
  try {
    const payload = req.body;
    
    // Validate payload structure
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      return res.status(400).json(errorResponse);
    }

    const { context, message } = payload;
    
    // Validate context
    const contextErrors = validateContext(context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      return res.status(400).json(errorResponse);
    }

    // Store transaction trail
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
      bpp_uri: BPP_URI
    });

    // Send ACK response
    const ackResponse = createAckResponse();
    res.status(202).json(ackResponse);
    
  } catch (error) {
    console.error('Error in /confirm:', error);
    const errorResponse = createErrorResponse('10002', 'Internal server error');
    res.status(500).json(errorResponse);
  }
});

// Debug endpoints
app.get('/debug/transactions', async (req, res) => {
  try {
    const transactions = await TransactionTrail.find().sort({ created_at: -1 }).limit(100);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/debug/transactions/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transactions = await TransactionTrail.find({ transaction_id: transactionId }).sort({ created_at: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View incoming search requests
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

// View search requests by transaction ID
app.get('/debug/search-requests/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const searchRequest = await SearchData.findOne({ transaction_id: transactionId });
    if (!searchRequest) {
      return res.status(404).json({ error: 'Search request not found' });
    }
    res.json(searchRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View all incoming requests (search, select, init, confirm)
app.get('/debug/incoming-requests', async (req, res) => {
  try {
    const incomingRequests = await TransactionTrail.find({ 
      direction: 'incoming' 
    }).sort({ created_at: -1 }).limit(100);
    
    res.json({
      count: incomingRequests.length,
      requests: incomingRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect to MongoDB and start server
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log(`Connected to MongoDB (${NODE_ENV})`);
  if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 ONDC Seller BPP listening on http://localhost:${PORT}`));
  }
})
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  console.log('Server will start anyway with limited functionality');
  if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 ONDC Seller BPP listening on http://localhost:${PORT} (MongoDB unavailable)`));
  }
});

module.exports = { app };