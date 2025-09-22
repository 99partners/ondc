// const nacl = require("tweetnacl");
// const crypto = require("crypto");

// function generateKeyPairs() {
//   const signingKeyPair = nacl.sign.keyPair();
//   const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519', {
//     modulusLength: 2048,
//     publicKeyEncoding: {
//       type: 'spki',
//       format: 'pem',
//     },
//     privateKeyEncoding: {
//       type: 'pkcs8',
//       format: 'pem',
//     },
//   });

//   return {
//     Signing_private_key: Buffer.from(signingKeyPair.secretKey).toString(
//       "base64"
//     ),
//     Signing_public_key: Buffer.from(signingKeyPair.publicKey).toString(
//       "base64"
//     ),
//     Encryption_Privatekey: privateKey.toString('utf-8')
//       .replace(/-----BEGIN PRIVATE KEY-----/, '')
//       .replace(/-----END PRIVATE KEY-----/, '')
//       .replace(/\s/g, ''),
//     Encryption_Publickey: publicKey.toString('utf-8')
//       .replace(/-----BEGIN PUBLIC KEY-----/, '')
//       .replace(/-----END PUBLIC KEY-----/, '')
//       .replace(/\s/g, ''),
//   };
// }

// const keyPairs = generateKeyPairs();
// console.log(keyPairs);

const express = require('express'); // Express framework for handling HTTP requests
const bodyParser = require('body-parser'); // Middleware for parsing request bodies
const crypto = require('crypto'); // Node.js crypto module for encryption and decryption
const _sodium = require('libsodium-wrappers');
const { createAuthorizationHeader } = require('ondc-crypto-sdk-nodejs');
const rateLimit = require('express-rate-limit');

// Load environment variables
require('dotenv').config();

// Create Express application
const app = express();
app.use(bodyParser.json()); // Middleware to parse JSON request bodies

// Set NODE_ENV if not set
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Use environment variables or fall back to default values
const port = process.env.PORT || 3000;
const ENCRYPTION_PRIVATE_KEY = 
  process.env.ENCRYPTION_PRIVATE_KEY || 'MC4CAQAwBQYDK2VuBCIEIHA+jwRt3qb7iISfxBgvJh5rrLjfEoI7i873grc7BBRq';
const ONDC_PUBLIC_KEY = 
  process.env.ONDC_PUBLIC_KEY || 'MCowBQYDK2VuAyEAa9Wbpvd9SsrpOZFcynyt/TO3x0Yrqyys4NUGIvyxX2Q=';
const REQUEST_ID = process.env.REQUEST_ID || '99digicom-req-20250904-001';
const SIGNING_PRIVATE_KEY = 
  process.env.SIGNING_PRIVATE_KEY || 'T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==';

// ONDC search API private key - should be in environment variables for production
const SEARCH_PRIVATE_KEY = process.env.SEARCH_PRIVATE_KEY || "T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==";


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

// Add CORS support - configure stricter in production
app.use((req, res, next) => {
  // In production, replace '*' with your actual domain
  const allowedOrigin = isProduction ? process.env.ALLOWED_ORIGIN || '*' : '*';
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Rate limiter configuration
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later'
  }
});

// Logging middleware
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

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

/**
 * Generates a unique ID for transactions and messages
 */
function generateUniqueId() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `id-${timestamp}-${randomString}`;
}

/**
 * Validates ONDC search request body
 */
function validateSearchRequestBody(body) {
  if (!body) {
    throw new Error('Request body is required');
  }
  
  if (!body.context) {
    throw new Error('Context is required in the request body');
  }
  
  const requiredContextFields = ['domain', 'action', 'country', 'city', 'core_version', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp', 'ttl'];
  for (const field of requiredContextFields) {
    if (!body.context[field]) {
      throw new Error(`Required context field '${field}' is missing`);
    }
  }
  
  // Additional validation for search specific fields
  if (body.context.action !== 'search') {
    throw new Error(`Action must be 'search', got '${body.context.action}'`);
  }
  
  return true;
}

/**
 * Creates an ONDC Search API request
 */
async function createSearchApiRequest(searchRequestBody) {
  try {
    // Validate the request body
    validateSearchRequestBody(searchRequestBody);
    
    // Get subscriber details from environment or use defaults
    const subscriberId = process.env.ONDC_SUBSCRIBER_ID || "staging.99digicom.com";
    const subscriberUniqueKeyId = process.env.ONDC_SUBSCRIBER_KEY_ID || "staging-99digicom-key-001";
    
    // Generate authorization header for the search request
    const authHeader = await createAuthorizationHeader({
      body: JSON.stringify(searchRequestBody),
      privateKey: SEARCH_PRIVATE_KEY,
      subscriberId: subscriberId,
      subscriberUniqueKeyId: subscriberUniqueKeyId,
    });
    
    // Log request details (in production, consider more secure logging)
    if (!isProduction) {
      console.log("Generated Authorization Header:", authHeader);
      console.log("Search Request Body:", JSON.stringify(searchRequestBody, null, 2));
    }
    
    return {
      requestBody: searchRequestBody,
      authHeader: authHeader
    };
  } catch (error) {
    console.error("Error creating search API request:", error);
    throw error;
  }
}

/**
 * Creates an F&B domain search request
 */
function createFnbSearchRequest() {
  const transactionId = generateUniqueId();
  const messageId = generateUniqueId();
  const timestamp = new Date().toISOString();
  
  return {
    "context": {
      "domain": "ONDC:RET11", // F&B domain
      "action": "search",
      "country": "IND",
      "city": "std:080", // Bangalore city code
      "core_version": "1.2.0",
      "bap_id": "staging.99digicom.com", // Buyer/BAP ID
      "bap_uri": "https://staging.99digicom.com", // Buyer/BAP endpoint
      "bpp_id": "staging.ondc.org", // BPP seller ID
      "transaction_id": transactionId,
      "message_id": messageId,
      "timestamp": timestamp,
      "ttl": "PT30M"
    },
    "message": {
      "intent": {
        "fulfillment": {
          "type": "Delivery",
          "end": {
            "location": {
              "gps": "12.9715987,77.5945627"
            }
          }
        },
        "payment": {
          "type": "PRE-FULFILLMENT",
          "settlement_details": {
            "additional_details": {
              "finders_fee": {
                "percent": "5"
              }
            }
          }
        }
      }
    }
  };
}

// Default route
app.get('/', (req, res) => res.send('Hello World!'));

// Health check route
app.get('/health', (req, res) => res.send('Health OK!!'));

// Search API endpoint to handle incoming search requests
app.post('/search', searchLimiter, async (req, res) => {
  try {
    // Log the incoming request details (reduced logging in production)
    if (!isProduction) {
      console.log('\n==============================');
      console.log('NEW BUYER SEARCH REQUEST RECEIVED');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Request IP:', req.socket.remoteAddress);
      console.log('==============================\n');
    }
    
    // Log request details in production (without sensitive data)
    if (isProduction) {
      console.log(`[${new Date().toISOString()}] SEARCH REQUEST: ${req.socket.remoteAddress} - Transaction ID: ${req.body?.context?.transaction_id || 'unknown'}`);
    }

    // Process the search request
    const searchResult = await createSearchApiRequest(req.body);
    
    // Send response
    res.status(200).json({
      status: 'success',
      message: 'Search request processed',
      authorizationHeader: searchResult.authHeader
    });
  } catch (error) {
    // Differentiate between validation errors and server errors
    const isValidationError = error.message.includes('Required') || error.message.includes('missing');
    const statusCode = isValidationError ? 400 : 500;
    const errorType = isValidationError ? 'validation_error' : 'server_error';
    
    console.error('Error processing search request:', error);
    res.status(statusCode).json({
      status: 'error',
      type: errorType,
      message: isValidationError ? error.message : 'Failed to process search request',
      ...(!isProduction && { error: error.message }), // Only include detailed error in non-production
      requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    });
  }
});

// Endpoint to generate sample search requests
app.post('/generate-search', async (req, res) => {
  try {
    // Create a default search request or use provided parameters
    const searchRequest = Object.keys(req.body).length > 0 ? req.body : createFnbSearchRequest();
    const result = await createSearchApiRequest(searchRequest);
    
    res.status(200).json({
      status: 'success',
      searchRequest: result.requestBody,
      authorizationHeader: result.authHeader
    });
  } catch (error) {
    console.error('Error generating search request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate search request',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    status: 'error',
    type: 'unhandled_error',
    message: isProduction ? 'An unexpected error occurred' : err.message,
    requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    type: 'not_found',
    message: `Endpoint ${req.url} not found`
  });
});

// Start the server
app.listen(port, () => {
  console.log(`\n===================================`);
  console.log(`ONDC API Server (${NODE_ENV.toUpperCase()})`);
  console.log(`===================================`);
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Listening for search requests at: http://localhost:${port}/search`);
  console.log(`Use /generate-search endpoint to create search requests`);
  console.log(`===================================`);
  
  // Additional production warnings
  if (isProduction) {
    console.warn('\n⚠️  PRODUCTION MODE WARNINGS:');
    console.warn('1. Ensure all sensitive keys are stored in environment variables');
    console.warn('2. Configure ALLOWED_ORIGIN to restrict CORS access');
    console.warn('3. Consider adding HTTPS support for production');
    console.warn('4. Review rate limiting settings to match your expected traffic\n');
  }
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