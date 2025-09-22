// Test script to execute the exact payload BPP search response function

// Import the function we want to test
const { createExactPayloadBppSearchResponse } = require('./bpp-search-api');

console.log('Testing exact payload BPP search response...');

// Execute the function to verify it works correctly
createExactPayloadBppSearchResponse()
  .then((result) => {
    console.log('\nTest completed successfully!');
    console.log('Authorization Header:', result.authHeader);
    console.log('Response Body generated with the exact payload provided');
  })
  .catch((error) => {
    console.error('Test failed:', error);
  });