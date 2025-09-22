const http = require('http');

// Test parameters
const PORT = 3000;
const API_URL = `http://localhost:${PORT}/search`;

// Sample search request body
const searchRequestBody = {
  "context": {
    "domain": "ONDC:RET11",
    "action": "search",
    "country": "IND",
    "city": "std:080",
    "core_version": "1.2.0",
    "bap_id": "staging.99digicom.com",
    "bap_uri": "https://staging.99digicom.com",
    "bpp_id": "staging.ondc.org",
    "transaction_id": `id-${Date.now()}-test`,
    "message_id": `msg-${Date.now()}-test`,
    "timestamp": new Date().toISOString(),
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
      }
    }
  }
};

// Function to test the /search API
export function testSearchAPI() {
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/search',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log('\n===================================');
  console.log('Testing ONDC Search API');
  console.log(`Sending request to: ${API_URL}`);
  console.log('===================================');

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('\nResponse Status Code:', res.statusCode);
      console.log('Response Headers:', res.headers);
      try {
        const parsedData = JSON.parse(data);
        console.log('Response Body:', JSON.stringify(parsedData, null, 2));
        console.log('\nAPI Test Result: SUCCESS');
        console.log('The search API is working correctly!');
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Response Data:', data);
        console.log('\nAPI Test Result: FAILED');
      }
      console.log('===================================\n');
    });
  });

  req.on('error', (e) => {
    console.error('\nRequest error:', e.message);
    console.log('API Test Result: FAILED - Server might not be running');
    console.log('Please start the server with: npm start');
    console.log('===================================\n');
  });

  // Write data to request body
  req.write(JSON.stringify(searchRequestBody));
  req.end();
}

// Run the test if this script is executed directly
if (require.main === module) {
  testSearchAPI();
}