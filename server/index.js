const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const SearchData = require('./models/searchData');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_DEV_URI = 'mongodb://localhost:27017/sellerApp';
const DEFAULT_PROD_URI = 'mongodb+srv://99partnersin:99Partnersin@sellerondc.ygkwjfx.mongodb.net/ondcSeller?retryWrites=true&w=majority&appName=sellerONDC';
const MONGODB_URI = process.env.MONGODB_URI || (NODE_ENV === 'production' ? DEFAULT_PROD_URI : DEFAULT_DEV_URI);

// BPP config (retail domain)
const BPP_ID = process.env.BPP_ID || 'staging.99digicom.com';
const BPP_URI = process.env.BPP_URI || 'https://staging.99digicom.com';

// Health
app.get('/health', (req, res) => res.send('OK'));

// ONDC Retail: Receive buyer app search and store payload
app.post('/search', async (req, res) => {
  try {
    const payload = req.body || {};
    const context = payload.context || {};

    // Basic context validations per ONDC retail search
    if (!context || context.action !== 'search') {
      return res.status(400).json({ message: 'Invalid context.action; expected "search"' });
    }
    if (!context.bap_id || !context.bap_uri) {
      return res.status(400).json({ message: 'Missing bap_id or bap_uri in context' });
    }

    // Persist the incoming payload for audit/traceability
    const queryName = payload?.message?.intent?.item?.descriptor?.name || payload?.message?.intent?.category?.descriptor?.name || '';

    await SearchData.create({
      fullPayload: payload,
      domain: context.domain,
      country: context.country,
      city: context.city,
      core_version: context.core_version,
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      timestamp: context.timestamp ? new Date(context.timestamp) : undefined,
      action: context.action,
      query: queryName,
      source: 'buyer-app'
    });

    // As per spec, ACK with 202. An optional minimal on_search trigger
    // can be implemented separately; here we only store the incoming payload.
    return res.status(202).json({
      message: 'Search received and stored',
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI,
      transaction_id: context.transaction_id,
      message_id: context.message_id
    });
  } catch (err) {
    console.error('Error in /search:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Connect DB and start server
mongoose.connect(MONGODB_URI)
.then(() => {
  console.log(`Connected to MongoDB (${NODE_ENV})`);
  if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 Seller app listening on http://localhost:${PORT}`));
  }
})
.catch(err => {
  console.error('MongoDB connection error:', err.message);
});

module.exports = { app };


