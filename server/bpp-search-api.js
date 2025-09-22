const http = require('http');
const { createAuthorizationHeader } = require('ondc-crypto-sdk-nodejs');
const PORT = process.env.PORT || 3000;

// Create server
const server = http.createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Parse request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const parsedBody = body ? JSON.parse(body) : {};
      
      if (req.url === '/search' && req.method === 'POST') {
        // Log the incoming request details
        console.log('\n==============================');
        console.log('NEW BUYER SEARCH REQUEST RECEIVED');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Request IP:', req.socket.remoteAddress);
        console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Request Body:', JSON.stringify(parsedBody, null, 2));
        console.log('==============================\n');

        // Process the search request
        const searchResult = await createSearchApiRequest(parsedBody);
        
        // Send response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          message: 'Search request processed',
          authorizationHeader: searchResult.authHeader
        }));
      }
      else if (req.url === '/generate-search' && req.method === 'POST') {
        // Create a default search request or use provided parameters
        const searchRequest = Object.keys(parsedBody).length > 0 ? parsedBody : createFnbSearchRequest();
        const result = await createSearchApiRequest(searchRequest);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          searchRequest: result.requestBody,
          authorizationHeader: result.authHeader
        }));
      }
      else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          message: 'Endpoint not found'
        }));
      }
    } catch (error) {
      console.error('Error processing request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'error',
        message: 'Failed to process request',
        error: error.message
      }));
    }
  });
});

// This is where you would load your private key
// For example: const privateKey = fs.readFileSync('path/to/private-key.pem', 'utf8');
const privateKey = "T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg=="; // Replace with your actual private key

/**
 * Creates an ONDC Search API request for buyers (BAP)
 * This implementation supports:
 * - Full catalog refresh
 * - Distributed search across multiple BPP sellers
 * - Static terms publication
 * - Search filtering based on location, category, price, etc.
 */
async function createSearchApiRequest(searchRequestBody) {
  try {
    // Generate authorization header for the search request
    const authHeader = await createAuthorizationHeader({
      body: JSON.stringify(searchRequestBody),
      privateKey: privateKey,
      subscriberId: "staging.99digicom.com", // Buyer/BAP Subscriber ID from ONDC registration
      subscriberUniqueKeyId: "staging-99digicom-key-001", // Buyer/BAP Unique Key Id from ONDC registration
    });
    
    console.log("Generated Authorization Header:", authHeader);
    console.log("Search Request Body:", JSON.stringify(searchRequestBody, null, 2));
    
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
 * Generates a unique ID for transactions and messages
 */
function generateUniqueId() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `id-${timestamp}-${randomString}`;
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

// Start the server
server.listen(PORT, () => {
  console.log(`\n===================================`);
  console.log(`ONDC Buyer (BAP) Search API Server`);
  console.log(`===================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Listening for buyer search requests at: http://localhost:${PORT}/search`);
  console.log(`Use /generate-search endpoint to create search requests`);
  console.log(`===================================\n`);
});

// Export the server for potential testing or external control
module.exports = {
  server
};

// Execute a sample search request when the server starts
// Uncomment this if you want to test immediately
// setTimeout(async () => {
//   console.log("\nGenerating sample F&B search request...");
//   const fnbSearchRequest = createFnbSearchRequest();
//   await createSearchApiRequest(fnbSearchRequest);
// }, 2000);

// Export functions for external usage
module.exports = {
  createSearchApiRequest,
  generateUniqueId,
  createFnbSearchRequest
};