const axios = require('axios');

// Base URL for the ONDC seller search service
const BASE_URL = 'http://localhost:3000';

// Sample search request payload with the exact context structure requested
const searchRequestPayload = {
  "context": {
    "domain":"ONDC:RET10",
    "action":"search",
    "country":"IND",
    "city":"std:080",
    "core_version":"1.2.0",
    "bap_id":"buyerNP.com",
    "bap_uri":"https://buyerNP.com/ondc",
    "transaction_id":"T1",
    "message_id":"M1",
    "timestamp":"2023-06-03T08:00:00.000Z",
    "ttl":"PT30S"
  },
  "message": {
    "intent": {
      "payment": {
        "@ondc/org/buyer_app_finder_fee_type":"percent",
        "@ondc/org/buyer_app_finder_fee_amount":"3"
      },
      "tags": [
        {
          "code":"catalog_full",
          "list": [
            {
              "code":"payload_type",
              "value":"link"
            }
          ]
        },
        {
          "code":"bap_terms",
          "list": [
            {
              "code":"static_terms",
              "value":""
            },
            {
              "code":"static_terms_new",
              "value":"https://github.com/ONDC-Official/NP-Static-Terms/buyerNP_BNP/1.0/tc.pdf"
            },
            {
              "code":"effective_date",
              "value":"2023-10-01T00:00:00.000Z"
            }
          ]
        }
      ]
    }
  }
};

// Function to send search request
async function sendSearchRequest(payload) {
  try {
    console.log('Sending search request with context structure to:', `${BASE_URL}/search`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(`${BASE_URL}/search`, payload, {
      headers: {
        'Content-Type': 'application/json'
        // Add authorization header here if needed
        // 'Authorization': 'Signature keyId="...",algorithm="...",headers="...",signature="..."'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response;
  } catch (error) {
    console.error('Error sending search request:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Run the test
async function runTest() {
  console.log('Running ONDC search request test with custom context structure');
  
  try {
    // Send the search request
    const response = await sendSearchRequest(searchRequestPayload);
    
    // Check if the response is successful
    if (response.status === 200 && response.data?.message?.ack?.status === 'ACK') {
      console.log('\n✅ Test passed: Search request was successfully processed with ACK response');
    } else {
      console.log('\n❌ Test failed: Expected ACK response but received:', response.data?.message?.ack?.status);
    }
  } catch (error) {
    console.log('\n❌ Test failed: Error occurred during request');
  }
}

// Execute the test
runTest();