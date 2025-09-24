const axios = require('./node_modules/axios/index.d.cts');

// Base URL for the ONDC seller search service
const BASE_URL = 'http://localhost:3000';

// Test cases
const testCases = [
  {
    name: 'Valid request with all required fields',
    payload: {
      context: {
        bap_uri: 'https://example.com/bap',
        bpp_uri: 'https://example.com/bpp',
        transaction_id: '12345',
        message_id: '67890',
        timestamp: new Date().toISOString(),
        domain: 'ONDC:RET1',
        bap_id: 'bap.example.com',
        bpp_id: 'bpp.example.com',
        country: 'IND',
        city: 'std:080',
        action: 'search',
        core_version: '1.1.0'
      },
      message: {
        intent: {
          item: {
            descriptor: {
              name: 'Organic Apples'
            }
          },
          fulfillment: {
            type: 'Delivery',
            end: {
              location: {
                gps: '12.9716,77.5946'
              }
            }
          }
        }
      }
    },
    headers: {},
    expectedStatus: 200,
    expectedAckStatus: 'ACK'
  },
  {
    name: 'Invalid request - Missing context',
    payload: {
      message: {
        intent: {
          item: {
            descriptor: {
              name: 'Organic Apples'
            }
          }
        }
      }
    },
    headers: {},
    expectedStatus: 400,
    expectedAckStatus: 'NACK'
  },
  {
    name: 'Invalid request - Missing BAP URI in context',
    payload: {
      context: {
        // bap_uri is missing
        bpp_uri: 'https://example.com/bpp',
        transaction_id: '12345',
        message_id: '67890',
        timestamp: new Date().toISOString()
      },
      message: {
        intent: {
          item: {
            descriptor: {
              name: 'Organic Apples'
            }
          }
        }
      }
    },
    headers: {},
    expectedStatus: 400,
    expectedAckStatus: 'NACK'
  },
  {
    name: 'Invalid request - Missing message',
    payload: {
      context: {
        bap_uri: 'https://example.com/bap',
        bpp_uri: 'https://example.com/bpp',
        transaction_id: '12345',
        message_id: '67890',
        timestamp: new Date().toISOString()
      }
      // message is missing
    },
    headers: {},
    expectedStatus: 400,
    expectedAckStatus: 'NACK'
  },
  {
    name: 'Invalid request - Empty payload',
    payload: {},
    headers: {},
    expectedStatus: 400,
    expectedAckStatus: 'NACK'
  },
  {
    name: 'Request with invalid authorization header',
    payload: {
      context: {
        bap_uri: 'https://example.com/bap',
        bpp_uri: 'https://example.com/bpp',
        transaction_id: '12345',
        message_id: '67890',
        timestamp: new Date().toISOString(),
        domain: 'ONDC:RET1',
        bap_id: 'bap.example.com',
        bpp_id: 'bpp.example.com',
        country: 'IND',
        city: 'std:080',
        action: 'search',
        core_version: '1.1.0'
      },
      message: {
        intent: {
          item: {
            descriptor: {
              name: 'Organic Apples'
            }
          },
          fulfillment: {
            type: 'Delivery',
            end: {
              location: {
                gps: '12.9716,77.5946'
              }
            }
          }
        }
      }
    },
    headers: {
      authorization: 'InvalidSignatureKeyId="",algorithm="",headers="",signature=""'
    },
    expectedStatus: 401,
    expectedAckStatus: 'NACK'
  }
];

// Run all test cases
async function runTests() {
  console.log('Running ONDC Seller Search Service tests...\n');
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const testCase of testCases) {
    console.log(`Running test: ${testCase.name}`);
    
    try {
      // Send the request to the search endpoint
      const response = await axios.post(`${BASE_URL}/search`, testCase.payload, {
        headers: testCase.headers,
        validateStatus: false // Don't throw error for non-2xx status codes
      });
      
      // Check if the status code matches the expected status
      const statusCodeMatch = response.status === testCase.expectedStatus;
      
      // Check if the ACK status matches the expected status
      let ackStatusMatch = false;
      if (response.data && response.data.message && response.data.message.ack) {
        ackStatusMatch = response.data.message.ack.status === testCase.expectedAckStatus;
      }
      
      // Determine if the test passed or failed
      const passed = statusCodeMatch && ackStatusMatch;
      
      if (passed) {
        passedCount++;
        console.log(`✅ Test passed: Status ${response.status}, ACK: ${response.data?.message?.ack?.status || 'N/A'}`);
      } else {
        failedCount++;
        console.log(`❌ Test failed: Expected status ${testCase.expectedStatus} and ACK ${testCase.expectedAckStatus}, got status ${response.status} and ACK ${response.data?.message?.ack?.status || 'N/A'}`);
        console.log('Response data:', response.data);
      }
      
    } catch (error) {
      failedCount++;
      console.log(`❌ Test failed with error: ${error.message}`);
    }
    
    console.log('------------------------\n');
  }
  
  // Print summary
  console.log('Test Summary:');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
});