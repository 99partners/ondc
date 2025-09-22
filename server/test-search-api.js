// Test script to send a sample search request to the local server
const http = require('http');

// Sample search request body
const searchRequestBody = {
  "context": {
    "domain": "ONDC:RET10",
    "action": "search",
    "country": "IND",
    "city": "std:080",
    "core_version": "1.2.0",
    "bap_id": "staging.99digicom.com",
    "bap_uri": "https://staging.99digicom.com",
    "transaction_id": "id-1234567890-abcdef",
    "message_id": "id-1234567890-ghijkl",
    "timestamp": new Date().toISOString(),
    "ttl": "PT30S"
  },
  "message": {
    "intent": {
      "item": {
        "descriptor": {
          "name": "Wheat Flour"
        }
      }
    }
  }
};

// Configure the HTTP request options
const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/search',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(searchRequestBody))
  }
};

console.log('Sending test search request to http://localhost:3002/search...');

// Send the request
const req = http.request(options, (res) => {
  let responseBody = '';
  
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  
  res.on('end', () => {
    console.log('Response status code:', res.statusCode);
    console.log('Response headers:', res.headers);
    console.log('Response body:', JSON.parse(responseBody));
    
    // Also try the generate-search endpoint
    console.log('\n\nNow testing the /generate-search endpoint...');
    testGenerateSearchEndpoint();
  });
});

// Handle request errors
req.on('error', (e) => {
  console.error('Request error:', e.message);
  console.log('Make sure the search-api.js server is running before executing this test');
});

// Write the request body and end the request
req.write(JSON.stringify(searchRequestBody));
req.end();

// Function to test the generate-search endpoint
function testGenerateSearchEndpoint() {
  const generateOptions = {
    hostname: 'localhost',
    port: 3002,
    path: '/generate-search',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const generateReq = http.request(generateOptions, (res) => {
    let responseBody = '';
    
    res.on('data', (chunk) => {
      responseBody += chunk;
    });
    
    res.on('end', () => {
      console.log('Generate search response status code:', res.statusCode);
      try {
        const result = JSON.parse(responseBody);
        console.log('Generated search request available in response');
        console.log('Authorization header generated successfully');
      } catch (e) {
        console.error('Error parsing generate-search response:', e);
        console.log('Raw response:', responseBody);
      }
    });
  });
  
  generateReq.on('error', (e) => {
    console.error('Generate search request error:', e.message);
  });
  
  generateReq.end();
}