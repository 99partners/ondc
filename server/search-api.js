const http = require('http');
const { createBppSearchResponse, respondToSearchRequest } = require('./bpp-search-api.js');
const url = require('url');

// Mock implementation of createAuthorizationHeader since the ONDC Crypto SDK is not available
function createAuthorizationHeader(context, privateKey) {
  console.log('Creating mock authorization header in search-api.js');
  // Return a dummy authorization header for testing
  return 'mock-authorization-header';
}

// Create server
const server = http.createServer(async (req, res) => {
  // Parse URL to get path
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Check if request is for /search endpoint
  if (path === '/search' && req.method === 'POST') {
    let requestBody = '';
    
    // Collect request body data
    req.on('data', (chunk) => {
      requestBody += chunk;
    });
    
    req.on('end', async () => {
      try {
        // Parse the request body
        const parsedBody = JSON.parse(requestBody);
        
        // Get the host header to determine which domain the request came from
        const host = req.headers.host;
        
        // Log the request details
        console.log(`Received search request on ${host}/search`);
        console.log('Request body:', parsedBody);
        
        // Generate appropriate response based on the host domain
        let responseData;
        if (host.includes('localhost:3000')) {
          // Handle localhost:3000/search
          responseData = await respondToSearchRequest(parsedBody);
        } else if (host.includes('staging.99digicom.com')) {
          // Handle staging.99digicom.com/search
          // Create a response that references the original request
          const { transaction_id } = parsedBody.context;
          const timestamp = new Date().toISOString();
          
          const stagingResponse = {
            "context": {
              "domain": parsedBody.context.domain,
              "action": "on_search",
              "country": parsedBody.context.country,
              "city": parsedBody.context.city,
              "core_version": parsedBody.context.core_version,
              "bpp_id": "staging.99digicom.com",
              "bpp_uri": "https://staging.99digicom.com",
              "transaction_id": transaction_id,
              "message_id": generateUniqueId(),
              "timestamp": timestamp,
              "bap_id": parsedBody.context.bap_id,
              "bap_uri": parsedBody.context.bap_uri
            },
            "message": {
              "catalog": {
                "bpp/descriptor": {
                  "name": "Sample Store",
                  "symbol": "https://sellerNP.com/images/logo.png",
                  "short_desc": "Grocery Store"
                },
                "bpp/providers": [
                  {
                    "id": "P1",
                    "descriptor": {
                      "name": "Sample Store"
                    },
                    "items": [
                      // Items will be filtered based on search intent
                    ]
                  }
                ]
              }
            }
          };
          
          // Generate authorization header for staging response
          const authHeader = await createAuthorizationHeader({
            body: JSON.stringify(stagingResponse),
            privateKey: "T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==",
            subscriberId: "staging.99digicom.com",
            subscriberUniqueKeyId: "staging-99digicom-key-001",
          });
          
          responseData = {
            responseBody: stagingResponse,
            authHeader: authHeader
          };
        } else {
          // Default response for other domains
          responseData = await createBppSearchResponse();
        }
        
        // Set response headers
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Authorization': responseData.authHeader
        });
        
        // Send the response
        res.end(JSON.stringify(responseData.responseBody));
        
      } catch (error) {
        console.error('Error processing search request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else {
    // Handle other routes or methods
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Helper function to generate unique IDs
function generateUniqueId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}



// Start the server on port 3003
// Using 3003 since port 3002 appears to be in use
const PORT = 3003;
server.listen(PORT, () => {
  console.log(`Search server running on port ${PORT}`);
  console.log(`Handling requests for:`);
  console.log(`- http://localhost:${PORT}/search`);
  console.log(`- https://staging.99digicom.com/search (when accessed with proper domain mapping)`);
});