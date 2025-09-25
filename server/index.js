const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const SearchData = require('./models/searchData');
const { bpp, server } = require('./config');
const { validateSearchContext, buildOnSearchResponse, deriveCatalogForDomain, putCatalog, getCatalog } = require('./services/bppService');

const app = express();
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(CORS_ORIGINS.length ? cors({ origin: CORS_ORIGINS }) : cors());
app.use(bodyParser.json({ limit: '5mb' }));

const PORT = server.port;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_DEV_URI = 'mongodb://localhost:27017/sellerApp';
const DEFAULT_PROD_URI = 'mongodb+srv://99partnersin:99Partnersin@sellerondc.ygkwjfx.mongodb.net/ondcSeller?retryWrites=true&w=majority&appName=sellerONDC';
const MONGODB_URI = process.env.MONGODB_URI || (NODE_ENV === 'production' ? DEFAULT_PROD_URI : DEFAULT_DEV_URI);

// BPP config (retail domain)
const BPP_ID = process.env.BPP_ID || 'staging.99digicom.com';
const BPP_URI = process.env.BPP_URI || 'https://staging.99digicom.com';

// Health
app.get('/health', (req, res) => res.send('OK'));

// DB status for debugging
app.get('/debug/db-status', (req, res) => {
  const state = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
  res.json({ readyState: state });
});

// ONDC Retail: Receive buyer app search and store payload
app.post('/search', async (req, res, next) => {
  try {
    const payload = req.body;

    // No payload received → NACK
    if (!payload || typeof payload !== 'object') {
      return res.status(200).json({
        message: { ack: { status: 'NACK' } },
        error: { code: 'bad_request', message: 'Empty or invalid payload' }
      });
    }

    const context = payload.context || {};
    const intent = payload.message?.intent || {};
    const responseMode = payload.message?.response?.mode || 'inline'; // 'inline' | 'link'

    // Basic context validations per ONDC retail search
    const validationError = validateSearchContext(context);
    if (validationError) {
      return res.status(200).json({
        message: { ack: { status: 'NACK' } },
        error: { code: 'invalid_context', message: validationError }
      });
    }

    // Persist the incoming payload for audit/traceability
    const queryName = payload?.message?.intent?.item?.descriptor?.name || payload?.message?.intent?.category?.descriptor?.name || '';

    const docToCreate = {
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
    };

    // Log size info to help debug Atlas limits
    try {
      const created = await SearchData.create(docToCreate);
      console.log('Saved /search payload:', {
        _id: created._id.toString(),
        transaction_id: created.transaction_id,
        message_id: created.message_id
      });
    } catch (dbErr) {
      console.error('Mongo save failed:', dbErr.message);
      return res.status(200).json({
        message: { ack: { status: 'NACK' } },
        error: { code: 'db_error', message: dbErr.message }
      });
    }

    // Build mock catalog
    const onSearch = buildOnSearchResponse(context, intent);

    if (responseMode === 'link') {
      const { token, expiresAt } = putCatalog(context.transaction_id, onSearch, 300);
      return res.status(200).json({
        context: onSearch.context,
        message: {
          catalog: {
            descriptor: { name: 'Catalog Link' }
          },
          link: {
            url: `${bpp.uri}/catalog/${encodeURIComponent(context.transaction_id)}?token=${token}`,
            valid_till: new Date(expiresAt).toISOString()
          }
        }
      });
    }

    // Inline
    return res.status(200).json(onSearch);
  } catch (err) {
    console.error('Error in /search:', err);
    return next(err);
  }
});

// Authorized catalog download endpoint for link-mode
app.get('/catalog/:transactionId', (req, res) => {
  const { transactionId } = req.params;
  const { token } = req.query;
  const entry = getCatalog(transactionId);
  if (!entry) return res.status(404).json({ message: 'Not found or expired' });
  if (!token || token !== entry.token) return res.status(403).json({ message: 'Forbidden' });
  res.json(entry.data);
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

// Global error handler
// Placeholder: plug signature verification earlier in the chain when implementing
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    message: { ack: { status: 'NACK' } },
    error: { code: 'internal_error', message: err.message || 'Server error' }
  });
});


