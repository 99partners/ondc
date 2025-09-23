const express = require('express');
require('dotenv').config();
const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const { isHeaderValid } = require('ondc-crypto-sdk-nodejs');
const SearchData = require('./models/searchData'); // Make sure this file exists

//-------------------------------------------------------------
// CONFIGURATION
//-------------------------------------------------------------
const PORT = process.env.PORT || 3000;

// Keys for ONDC subscription / site verification
const ENCRYPTION_PRIVATE_KEY =
  process.env.ENCRYPTION_PRIVATE_KEY ||
  'MC4CAQAwBQYDK2VuBCIEIHA+jwRt3qb7iISfxBgvJh5rrLjfEoI7i873grc7BBRq';
const ONDC_PUBLIC_KEY =
  process.env.ONDC_PUBLIC_KEY ||
  'MCowBQYDK2VuAyEAa9Wbpvd9SsrpOZFcynyt/TO3x0Yrqyys4NUGIvyxX2Q=';
const REQUEST_ID = process.env.REQUEST_ID || '99digicom-req-20250904-001';
const SIGNING_PRIVATE_KEY =
  process.env.SIGNING_PRIVATE_KEY ||
  'T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==';

// BPP (Seller Platform) config
const BPP_CONFIG = {
  id: process.env.BPP_ID || 'staging.99digicom.com',
  uri: process.env.BPP_URI || 'https://staging.99digicom.com',
};

//-------------------------------------------------------------
// SITE VERIFICATION HTML TEMPLATE
//-------------------------------------------------------------
const htmlFile = `
<html>
  <head>
    <meta
      name="ondc-site-verification"
      content="SIGNED_UNIQUE_REQ_ID"
    />
  </head>
  <body>
    ONDC Site Verification Page
  </body>
</html>
`;

//-------------------------------------------------------------
// CRYPTO SETUP
//-------------------------------------------------------------
const privateKey = crypto.createPrivateKey({
  key: Buffer.from(ENCRYPTION_PRIVATE_KEY, 'base64'),
  format: 'der',
  type: 'pkcs8',
});
const publicKey = crypto.createPublicKey({
  key: Buffer.from(ONDC_PUBLIC_KEY, 'base64'),
  format: 'der',
  type: 'spki',
});

// Shared secret key
const sharedKey = crypto.diffieHellman({
  privateKey: privateKey,
  publicKey: publicKey,
});

//-------------------------------------------------------------
// EXPRESS APP
//-------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

//-------------------------------------------------------------
// UTILITY FUNCTIONS
//-------------------------------------------------------------
async function getSenderPublicKey(req) {
  // Prefer explicit env overrides per environment/setup
  if (process.env.BUYER_APP_PUBLIC_KEY) return process.env.BUYER_APP_PUBLIC_KEY;
  if (process.env.SENDER_PUBLIC_KEY) return process.env.SENDER_PUBLIC_KEY;
  // Fallback to known ONDC public key if configured
  return ONDC_PUBLIC_KEY;
}

async function verifyAuthHeader(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const publicKey = await getSenderPublicKey(req);
    const valid = await isHeaderValid({ header: authHeader, body: req.body, publicKey });
    if (!valid) {
      return res.status(401).json({ message: 'Invalid authorization header' });
    }
    return next();
  } catch (err) {
    console.error('Auth header verification failed:', err.message);
    return res.status(500).json({ message: 'Header verification error', error: err.message });
  }
}
function decryptAES256ECB(key, encrypted) {
  const iv = Buffer.alloc(0); // ECB has no IV
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function signMessage(signingString, privateKey) {
  await _sodium.ready;
  const sodium = _sodium;
  const signedMessage = sodium.crypto_sign_detached(
    signingString,
    sodium.from_base64(privateKey, _sodium.base64_variants.ORIGINAL)
  );
  return sodium.to_base64(signedMessage, _sodium.base64_variants.ORIGINAL);
}

const sendResponseToBAP = async (bapUri, payload) => {
  try {
    const response = await axios.post(bapUri, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Response sent to BAP successfully:', response.status);
    return response;
  } catch (error) {
    console.error('Error sending response to BAP:', error.message);
    throw error;
  }
};

//-------------------------------------------------------------
// ONDC SUBSCRIPTION ENDPOINTS
//-------------------------------------------------------------
app.get('/on_subscribe', (req, res) => {
  res.status(200).send("✅ ONDC on_subscribe endpoint is up! Use POST for verification.");
});

app.post('/on_subscribe', (req, res) => {
  try {
    const { challenge } = req.body || {};
    if (!challenge) return res.status(400).json({ message: 'challenge is required' });
    const answer = decryptAES256ECB(sharedKey, challenge);
    res.status(200).json({ answer });
  } catch (err) {
    console.error('on_subscribe error:', err.message);
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
});

app.get('/ondc-site-verification.html', async (req, res) => {
  const signedContent = await signMessage(REQUEST_ID, SIGNING_PRIVATE_KEY);
  const modifiedHTML = htmlFile.replace(/SIGNED_UNIQUE_REQ_ID/g, signedContent);
  res.send(modifiedHTML);
});

//-------------------------------------------------------------
// SEARCH ENDPOINTS
//-------------------------------------------------------------
app.post('/search', verifyAuthHeader, async (req, res) => {
  try {
    const requestBody = req.body;
    const { context } = requestBody;

    if (!context) {
      return res.status(400).json({ message: 'Context is required in the request payload' });
    }

    const bapUri = context.bap_uri;
    if (!bapUri) {
      return res.status(400).json({ message: 'BAP URI is required in the context' });
    }

    console.log('Received search request from buyer app:', {
      context_id: context.context_id,
      bap_id: context.bap_id,
      bap_uri:context.bap_uri
    });

    // Save incoming request
    const searchQueryName =
      requestBody?.message?.intent?.item?.descriptor?.name || 'search request';
    const searchRequestData = {
      query: searchQueryName,
      filters: requestBody?.message?.intent || {},
      results: [],
      source: 'buyer-app'
    };

    const savedSearchData = await SearchData.create(searchRequestData);

    // Construct ON_SEARCH response
    const responsePayload = {
      context: {
        ...context,
        bpp_id: BPP_CONFIG.id,
        bpp_uri: BPP_CONFIG.uri,
        timestamp: new Date().toISOString(),
        action: 'on_search'
      },
      message: {
        catalog: {
          bpp_providers: [
            {
              id: 'provider-1',
              locations: [],
              items: [
                {
                  id: 'item-1',
                  descriptor: {
                    name: 'Product 1',
                    description: 'Description of Product 1',
                    images: ['https://example.com/image1.jpg']
                  },
                  price: { currency: 'INR', value: '4999' },
                  quantity: { available: { count: 100 } }
                },
                {
                  id: 'item-2',
                  descriptor: {
                    name: 'Product 2',
                    description: 'Description of Product 2',
                    images: ['https://example.com/image2.jpg']
                  },
                  price: { currency: 'INR', value: '9999' },
                  quantity: { available: { count: 50 } }
                }
              ]
            }
          ]
        }
      }
    };

    savedSearchData.results = responsePayload.message.catalog.bpp_providers[0].items;
    await savedSearchData.save();

    try {
      await sendResponseToBAP(bapUri, responsePayload);
      res.status(202).json({
        message: 'Search request processed. Response sent to BAP.',
        context_id: context.context_id
      });
    } catch (error) {
      res.status(202).json({
        message: 'Search processed, but error sending response to BAP.',
        context_id: context.context_id,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error processing search request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/search', async (req, res) => {
  try {
    const { query, source } = req.query;
    const limit = parseInt(req.query.limit || '10', 10);
    const page = parseInt(req.query.page || '1', 10);
    const queryOptions = {};

    if (query) queryOptions.query = { $regex: query, $options: 'i' };
    if (source) queryOptions.source = source;

    const skip = (page - 1) * limit;

    const searchResults = await SearchData
      .find(queryOptions)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SearchData.countDocuments(queryOptions);

    res.json({
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: searchResults
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

//-------------------------------------------------------------
// HEALTH & DEFAULT ENDPOINTS
//-------------------------------------------------------------
app.get('/', (req, res) => res.send('Hello World!'));
app.get('/health', (req, res) => res.send('Health OK!!'));

//-------------------------------------------------------------
// MONGODB CONNECTION & SERVER START
//-------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sellerApp';

mongoose.connect(MONGODB_URI)
.then(() => {
  console.log('Connected to MongoDB');
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }
})
.catch(err => console.error('MongoDB connection error:', err));

module.exports = { app };
