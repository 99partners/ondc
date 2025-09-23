const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const SearchData = require('./models/searchData');


const port = process.env.PORT || 3001; // Port on which the server will listen
const ENCRYPTION_PRIVATE_KEY =
  'MC4CAQAwBQYDK2VuBCIEIHA+jwRt3qb7iISfxBgvJh5rrLjfEoI7i873grc7BBRq';
const ONDC_PUBLIC_KEY =
  'MCowBQYDK2VuAyEAa9Wbpvd9SsrpOZFcynyt/TO3x0Yrqyys4NUGIvyxX2Q=';
const REQUEST_ID = '99digicom-req-20250904-001';
const SIGNING_PRIVATE_KEY =
  'T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==';


const htmlFile = `
<!--Contents of ondc-site-verification.html. -->
<!--Please replace SIGNED_UNIQUE_REQ_ID with an actual value-->
<html>
  <head>
    <meta
      name="ondc-site-verification"
      content="9Ns1kgNszpwQIkU2WLFB31KkX8kI/uJLhzflihI7L/NVuicyAsAaE3HcBOMuCeo5PyRvDJ62AjWoZS0jr6b2Bg=="
    />
  </head>
  <body>
    ONDC Site Verification Page
  </body>
</html>
`;

// Pre-defined public and private keys
const privateKey = crypto.createPrivateKey({
  key: Buffer.from(ENCRYPTION_PRIVATE_KEY, 'base64'), // Decode private key from base64
  format: 'der', // Specify the key format as DER
  type: 'pkcs8', // Specify the key type as PKCS#8
});
const publicKey = crypto.createPublicKey({
  key: Buffer.from(ONDC_PUBLIC_KEY, 'base64'), // Decode public key from base64
  format: 'der', // Specify the key format as DER
  type: 'spki', // Specify the key type as SubjectPublicKeyInfo (SPKI)
});

// Calculate the shared secret key using Diffie-Hellman
const sharedKey = crypto.diffieHellman({
  privateKey: privateKey,
  publicKey: publicKey,
});

// Create an Express application
const app = express();
app.use(bodyParser.json());

// Integrate search API router
app.use('/', searchRouter);

app.get('/on_subscribe', (req, res) => {
  res.status(200).send("✅ ONDC on_subscribe endpoint is up! Use POST for verification.");
});

// Route for handling subscription requests
app.post('/on_subscribe', function (req, res) {
  const { challenge } = req.body; // Extract the 'challenge' property from the request body
  const answer = decryptAES256ECB(sharedKey, challenge); // Decrypt the challenge using AES-256-ECB
  const resp = { answer: answer };
  res.status(200).json(resp); // Send a JSON response with the answer
});

// Route for serving a verification file
app.get('/ondc-site-verification.html', async (req, res) => {
  const signedContent = await signMessage(REQUEST_ID, SIGNING_PRIVATE_KEY);
  // Replace the placeholder with the actual value
  const modifiedHTML = htmlFile.replace(/SIGNED_UNIQUE_REQ_ID/g, signedContent);
  // Send the modified HTML as the response
  res.send(modifiedHTML);
});

// Default route
app.get('/', (req, res) => res.send('Hello World!'));

// Health check route
app.get('/health', (req, res) => res.send('Health OK!!'));

// Add error handling
app.on('error', (err) => {
  console.error('Server error:', err);
});

// Start server with error handling
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Decrypt using AES-256-ECB
function decryptAES256ECB(key, encrypted) {
  const iv = Buffer.alloc(0); // ECB doesn't use IV
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
  const signature = sodium.to_base64(
    signedMessage,
    _sodium.base64_variants.ORIGINAL
  );
  return signature;
}

// Configuration for BPP (Buyer-Provider Platform)
const BPP_CONFIG = {
  id: 'staging.99digicom.com', // Unique BPP ID
  uri: 'https://staging.99digicom.com', // BPP URI
};

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Utility function to send response to BAP URI
const sendResponseToBAP = async (bapUri, payload) => {
  try {
    const response = await axios.post(bapUri, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Response sent to BAP successfully:', response.status);
    return response;
  } catch (error) {
    console.error('Error sending response to BAP:', error.message);
    throw error;
  }
};

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/sellerApp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Search API Endpoint - For Buyer Apps
app.post('/search', async (req, res) => {
  try {
    const requestBody = req.body;
    
    // Extract context from the payload
    const { context } = requestBody;
    
    if (!context) {
      return res.status(400).json({ message: 'Context is required in the request payload' });
    }
    
    // Extract BAP URI from context
    const bapUri = context.bap_uri;
    
    if (!bapUri) {
      return res.status(400).json({ message: 'BAP URI is required in the context' });
    }
    
    // Log the incoming request
    console.log('Received search request from buyer app:', {
      context_id: context.context_id,
      bap_id: context.bap_id,
      bap_uri: bap_uri
    });
    
    // Save the incoming search request to database
    const searchRequestData = {
      query: context.message?.intent?.item?.descriptor?.name || 'search request',
      filters: requestBody?.message?.intent || {},
      results: [], // Will be populated with actual results
      source: 'buyer-app'
    };
    
    const savedSearchData = await SearchData.create(searchRequestData);
    console.log('Search request saved to database');
    
    // Construct the response payload
    const responsePayload = {
      context: {
        ...context, // Include the same context from the request
        bpp_id: BPP_CONFIG.id,
        bpp_uri: BPP_CONFIG.uri,
        timestamp: new Date().toISOString(), // Current timestamp
        action: 'on_search' // Set action to on_search
      },
      message: {
        // Include relevant message data
        catalog: {
          bpp_providers: [
            {
              id: 'provider-1',
              locations: [],
              items: [
                // Example items - these would come from your product database
                {
                  id: 'item-1',
                  descriptor: {
                    name: 'Product 1',
                    description: 'Description of Product 1',
                    images: ['https://example.com/image1.jpg']
                  },
                  price: {
                    currency: 'INR',
                    value: '4999'
                  },
                  quantity: {
                    available: {
                      count: 100
                    }
                  }
                },
                {
                  id: 'item-2',
                  descriptor: {
                    name: 'Product 2',
                    description: 'Description of Product 2',
                    images: ['https://example.com/image2.jpg']
                  },
                  price: {
                    currency: 'INR',
                    value: '9999'
                  },
                  quantity: {
                    available: {
                      count: 50
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    };
    
    // Update the saved search data with results
    savedSearchData.results = responsePayload.message.catalog.bpp_providers[0].items;
    await savedSearchData.save();
    
    // Send the response payload to the BAP URI
    try {
      await sendResponseToBAP(bapUri, responsePayload);
      res.status(202).json({
        message: 'Search request processed. Response sent to BAP.',
        context_id: context.context_id
      });
    } catch (error) {
      res.status(202).json({
        message: 'Search request processed, but error sending response to BAP.',
        context_id: context.context_id,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error processing search request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to retrieve search data (for third-party requests)
app.get('/search', async (req, res) => {
  try {
    const { query, source, limit = 10, page = 1 } = req.query;
    
    const queryOptions = {};
    
    if (query) {
      queryOptions.query = { $regex: query, $options: 'i' };
    }
    
    if (source) {
      queryOptions.source = source;
    }
    
    const skip = (page - 1) * limit;
    
    const searchResults = await SearchData
      .find(queryOptions)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});