const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Import route files
const searchRoutes = require('./routes/search');
const selectRoutes = require('./routes/select');
const initRoutes = require('./routes/init');
const updateRoutes = require('./routes/update');
const statusRoutes = require('./routes/status');
const cancelRoutes = require('./routes/cancel');
const confirmRouter = require('./routes/confirm');

const app = express();

// Middleware
const allowedOrigins = [
  'https://pramaan.ondc.org',
  'https://pramaan.ondc.org/beta/staging/mock',
  'https://staging.99digicom.com',
  'http://staging.99digicom.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // 临时允许所有来源，以便调试
    }
  },
  credentials: true
}));
app.use(bodyParser.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// MongoDB Atlas Configuration - Using your provided URI
const MONGODB_URI = 'mongodb+srv://99partnersin:99Partnersin@ondcseller.nmuucu3.mongodb.net/ondcSeller?retryWrites=true&w=majority&appName=ondcSeller';

// Health endpoint
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Root endpoint - helpful message instead of "Cannot GET /"
app.get('/', (req, res) => {
  res.json({
    service: 'ONDC Seller BPP',
    status: 'running',
    message: 'Use POST /search for ONDC search requests. See /health for status.'
  });
});
 // adjust path if needed
app.use('/confirm', confirmRouter);
app.use('/search', searchRoutes); // Standard search endpoint
app.use('/select', selectRoutes);
app.use('/init', initRoutes);
app.use('/update', updateRoutes);
app.use('/status', statusRoutes);
app.use('/cancel', cancelRoutes);

// Debug endpoint for transaction trails
app.get('/debug/transactions', async (req, res) => {
  try {
    const TransactionTrail = mongoose.model('TransactionTrail');
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
      console.log(`   - http://localhost:${PORT}/search/debug`);
      console.log(`   - http://localhost:${PORT}/search/pramaan/debug`);
      console.log(`   - http://localhost:${PORT}/select/debug`);
      console.log(`   - http://localhost:${PORT}/init/debug`);
      console.log(`   - http://localhost:${PORT}/confirm/debug`);
      console.log(`   - http://localhost:${PORT}/update/debug`);
      console.log(`   - http://localhost:${PORT}/debug/transactions`);
      console.log('🔍 Search endpoints:');
      console.log(`   - POST http://localhost:${PORT}/search (Standard)`);
      console.log(`   - POST http://localhost:${PORT}/search/pramaan (Pramaan Mock)`);
      console.log('📊 All incoming /search and /select requests will be stored in MongoDB Atlas');
    });
  }
})
.catch(err => {
  console.error('❌ MongoDB Atlas connection error:', err.message);
  console.log('⚠️  Server will start anyway with limited functionality');
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`🚀 ONDC Seller BPP listening on http://localhost:${PORT} (MongoDB unavailable)`);
    });
  }
});

module.exports = { app };