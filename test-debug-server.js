const axios = require('./node_modules/axios/index.d.cts');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const HEALTH_ENDPOINT = '/health';
const SEARCH_ENDPOINT = '/search';

// Helper function to make HTTP requests
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      headers,
      validateStatus: false // Don't throw errors for non-2xx status codes
    });
    return {
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      status: 500,
      data: { error: error.message }
    };
  }
}

// Simple logger
function logTestResult(testName, status, expected, actual, passed) {
  console.log(`\n=== ${testName} ===`);
  console.log(`Status: ${passed ? 'PASS' : 'FAIL'}`);
  console.log(`Expected: ${expected}`);
  console.log(`Actual: ${JSON.stringify(actual, null, 2)}`);
  return passed;
}

// Test suite
async function runTests() {
  let passedTests = 0;
  const totalTests = 6;
  
  console.log('Starting debug server tests...\n');
  
  // Test 1: Health check endpoint
  const healthResult = await makeRequest('GET', HEALTH_ENDPOINT);
  const test1Passed = healthResult.status === 200 && healthResult.data.status === 'UP';
  logTestResult(
    'Health Check Endpoint',
    healthResult.status,
    'Status: 200, Response: { status: "UP" }',
    healthResult.data,
    test1Passed
  );
  passedTests += test1Passed ? 1 : 0;
  
  // Test 2: Search with valid payload and mock authorization
  const validPayload = {
    context: {
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      action: 'search',
      core_version: '1.2.0',
      bap_id: 'buyer-app.com',
      bap_uri: 'https://buyer-app.com/ondc',
      bpp_id: 'seller-app.com',
      bpp_uri: 'https://seller-app.com/ondc',
      transaction_id: 'txn-123',
      message_id: 'msg-456',
      timestamp: new Date().toISOString(),
      key_id: '2022-07-18:key1',
      ttl: 'PT1M'
    },
    message: {
      intent: {
        item: {
          descriptor: {
            name: 'Test Product'
          }
        },
        fulfillment: {
          end: {
            location: {
              gps: '12.9716,77.5946'
            }
          }
        }
      }
    }
  };
  
  const test2Result = await makeRequest('POST', SEARCH_ENDPOINT, validPayload, {
    'Content-Type': 'application/json',
    'Authorization': 'Signature keyId="2022-07-18:key1",algorithm="ed25519",created="1658142000",expires="1658142300",headers="(created) (expires) (request-target) host digest",signature="abc123"'
  });
  const test2Passed = test2Result.status === 200 && test2Result.data.message?.ack?.status === 'ACK';
  logTestResult(
    'Search with valid payload and mock authorization',
    test2Result.status,
    'Status: 200, Response: { message: { ack: { status: "ACK" } } }',
    test2Result.data,
    test2Passed
  );
  passedTests += test2Passed ? 1 : 0;
  
  // Test 3: Search with missing context
  const missingContextPayload = {
    message: {
      intent: {
        item: {
          descriptor: {
            name: 'Test Product'
          }
        }
      }
    }
  };
  
  const test3Result = await makeRequest('POST', SEARCH_ENDPOINT, missingContextPayload);
  const test3Passed = 
    test3Result.status === 400 && 
    test3Result.data.message?.ack?.status === 'NACK' &&
    test3Result.data.message?.ack?.error?.code === '3001';
  logTestResult(
    'Search with missing context',
    test3Result.status,
    'Status: 400, Response: { message: { ack: { status: "NACK", error: { code: "3001" } } } }',
    test3Result.data,
    test3Passed
  );
  passedTests += test3Passed ? 1 : 0;
  
  // Test 4: Search with missing bap_uri in context
  const missingBapUriPayload = {
    context: {
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      action: 'search',
      core_version: '1.2.0',
      bap_id: 'buyer-app.com',
      // bap_uri is missing
      bpp_id: 'seller-app.com',
      bpp_uri: 'https://seller-app.com/ondc',
      transaction_id: 'txn-123',
      message_id: 'msg-456',
      timestamp: new Date().toISOString(),
      key_id: '2022-07-18:key1',
      ttl: 'PT1M'
    },
    message: {
      intent: {
        item: {
          descriptor: {
            name: 'Test Product'
          }
        }
      }
    }
  };
  
  const test4Result = await makeRequest('POST', SEARCH_ENDPOINT, missingBapUriPayload);
  const test4Passed = 
    test4Result.status === 400 && 
    test4Result.data.message?.ack?.status === 'NACK' &&
    test4Result.data.message?.ack?.error?.code === '3002';
  logTestResult(
    'Search with missing bap_uri in context',
    test4Result.status,
    'Status: 400, Response: { message: { ack: { status: "NACK", error: { code: "3002" } } } }',
    test4Result.data,
    test4Passed
  );
  passedTests += test4Passed ? 1 : 0;
  
  // Test 5: Search with missing message
  const missingMessagePayload = {
    context: {
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      action: 'search',
      core_version: '1.2.0',
      bap_id: 'buyer-app.com',
      bap_uri: 'https://buyer-app.com/ondc',
      bpp_id: 'seller-app.com',
      bpp_uri: 'https://seller-app.com/ondc',
      transaction_id: 'txn-123',
      message_id: 'msg-456',
      timestamp: new Date().toISOString(),
      key_id: '2022-07-18:key1',
      ttl: 'PT1M'
    }
    // message is missing
  };
  
  const test5Result = await makeRequest('POST', SEARCH_ENDPOINT, missingMessagePayload);
  const test5Passed = 
    test5Result.status === 400 && 
    test5Result.data.message?.ack?.status === 'NACK' &&
    test5Result.data.message?.ack?.error?.code === '3003';
  logTestResult(
    'Search with missing message',
    test5Result.status,
    'Status: 400, Response: { message: { ack: { status: "NACK", error: { code: "3003" } } } }',
    test5Result.data,
    test5Passed
  );
  passedTests += test5Passed ? 1 : 0;
  
  // Test 6: Search with empty payload
  const test6Result = await makeRequest('POST', SEARCH_ENDPOINT, {});
  const test6Passed = 
    test6Result.status === 400 && 
    test6Result.data.message?.ack?.status === 'NACK' &&
    test6Result.data.message?.ack?.error?.code === '3001';
  logTestResult(
    'Search with empty payload',
    test6Result.status,
    'Status: 400, Response: { message: { ack: { status: "NACK", error: { code: "3001" } } } }',
    test6Result.data,
    test6Passed
  );
  passedTests += test6Passed ? 1 : 0;
  
  // Summary
  console.log(`\n\n=== Test Summary ===`);
  console.log(`${passedTests} of ${totalTests} tests passed.`);
  console.log(`Overall result: ${passedTests === totalTests ? 'PASSED' : 'FAILED'}`);
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});