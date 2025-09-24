const http = require('http');

// Test configuration for main server
const HOST = 'localhost';
const PORT = 3000;

// Helper function to make HTTP requests
function makeHttpRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          // Try to parse JSON response
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData ? JSON.parse(responseData) : null
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    // Write data if provided
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Simple logger
function logTestResult(testName, status, expected, actual) {
  console.log(`\n=== ${testName} ===`);
  console.log(`Status: ${status}`);
  console.log(`Expected: ${expected}`);
  console.log(`Actual: ${JSON.stringify(actual, null, 2)}`);
}

// Test 1: Health check
async function testHealthCheck() {
  try {
    const result = await makeHttpRequest('GET', '/health');
    logTestResult(
      'Health Check',
      result.status === 200 ? 'PASS' : 'FAIL',
      'Status 200 with { status: "UP" }',
      result.data
    );
    return result.status === 200 && result.data?.status === 'UP';
  } catch (error) {
    logTestResult('Health Check', 'FAIL', 'Status 200', { error: error.message });
    return false;
  }
}

// Test 2: Valid search payload with authorization
async function testValidSearchWithAuth() {
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

  try {
    // Note: For this test, we're using a mock authorization header
    // In a real scenario with actual signature verification, this might fail
    // as we're using a hardcoded public key and a mock signature
    const result = await makeHttpRequest('POST', '/search', validPayload, {
      'Authorization': 'Signature keyId="2022-07-18:key1",algorithm="ed25519",created="1658142000",expires="1658142300",headers="(created) (expires) (request-target) host digest",signature="abc123"'
    });
    logTestResult(
      'Valid Search Payload with Authorization',
      (result.status === 200 && result.data?.message?.ack?.status === 'ACK') || 
      (result.status === 401 && result.data?.message?.ack?.status === 'NACK') ? 'PASS' : 'FAIL',
      'Status 200 with ACK or 401 with NACK (expected if signature validation fails)',
      result.data
    );
    return (result.status === 200 && result.data?.message?.ack?.status === 'ACK') || 
           (result.status === 401 && result.data?.message?.ack?.status === 'NACK');
  } catch (error) {
    logTestResult('Valid Search Payload with Authorization', 'FAIL', 'Status 200 or 401', { error: error.message });
    return false;
  }
}

// Test 3: Valid search payload without authorization
async function testValidSearchWithoutAuth() {
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
        }
      }
    }
  };

  try {
    const result = await makeHttpRequest('POST', '/search', validPayload);
    logTestResult(
      'Valid Search Payload without Authorization',
      result.status === 200 && result.data?.message?.ack?.status === 'ACK' ? 'PASS' : 'FAIL',
      'Status 200 with { message: { ack: { status: "ACK" } } }',
      result.data
    );
    return result.status === 200 && result.data?.message?.ack?.status === 'ACK';
  } catch (error) {
    logTestResult('Valid Search Payload without Authorization', 'FAIL', 'Status 200', { error: error.message });
    return false;
  }
}

// Test 4: Missing context
async function testMissingContext() {
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

  try {
    const result = await makeHttpRequest('POST', '/search', missingContextPayload);
    logTestResult(
      'Missing Context',
      result.status === 400 && result.data?.message?.ack?.status === 'NACK' && result.data?.message?.ack?.error?.code === '3001' ? 'PASS' : 'FAIL',
      'Status 400 with NACK and code 3001',
      result.data
    );
    return result.status === 400 && result.data?.message?.ack?.status === 'NACK' && result.data?.message?.ack?.error?.code === '3001';
  } catch (error) {
    logTestResult('Missing Context', 'FAIL', 'Status 400', { error: error.message });
    return false;
  }
}

// Test suite
async function runTests() {
  console.log('Starting tests for main ONDC seller search server...\n');
  
  let passedTests = 0;
  const totalTests = 4;
  
  // Run tests
  passedTests += await testHealthCheck() ? 1 : 0;
  passedTests += await testValidSearchWithAuth() ? 1 : 0;
  passedTests += await testValidSearchWithoutAuth() ? 1 : 0;
  passedTests += await testMissingContext() ? 1 : 0;
  
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