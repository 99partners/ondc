const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_URL = 'http://localhost:3000';

// Mock BAP server URL (in a real scenario, this would be an actual BAP endpoint)
const MOCK_BAP_URI = 'http://localhost:4000/on_search';

// Generate a unique context ID
const generateContextId = () => uuidv4();

// Create a mock search request payload
const createSearchRequest = () => {
  const contextId = generateContextId();
  const messageId = generateContextId();
  const transactionId = generateContextId();
  
  return {
    context: {
      context_id: contextId,
      bap_id: 'bap-buyer-app-test',
      bap_uri: MOCK_BAP_URI,
      timestamp: new Date().toISOString(),
      action: 'search',
      message_id: messageId,
      transaction_id: transactionId,
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      core_version: '1.1.0',
      bap_endpoint: MOCK_BAP_URI
    },
    message: {
      intent: {
        item: {
          descriptor: {
            name: 'laptop'
          }
        },
        fulfillment: {
          start: {
            location: {
              gps: '12.9716,77.5946'
            }
          }
        }
      }
    }
  };
};

// Run the test
const runTest = async () => {
  console.log('Running search API test...');
  
  try {
    // Create a search request
    const searchRequest = createSearchRequest();
    console.log('Created search request with context_id:', searchRequest.context.context_id);
    
    // Send the request to the search API endpoint
    const response = await axios.post(`${API_URL}/search`, searchRequest);
    
    // Log the response
    console.log('API response status:', response.status);
    console.log('API response data:', response.data);
    
    // Verify the response
    if (response.status === 202) {
      console.log('Test passed: Search request was processed successfully');
    } else {
      console.log('Test failed: Unexpected response status');
    }
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
};

// For testing without a real BAP server
// In a real scenario, you would have a BAP server running at MOCK_BAP_URI
const createMockBAPServer = () => {
  const express = require('express');
  const mockBAPApp = express();
  const MOCK_BAP_PORT = 4000;
  
  mockBAPApp.use(express.json());
  
  // Mock endpoint to receive on_search responses
  mockBAPApp.post('/on_search', (req, res) => {
    console.log('Mock BAP server received on_search response:');
    console.log('Context ID:', req.body.context.context_id);
    console.log('Action:', req.body.context.action); // Should be 'on_search'
    console.log('Number of items returned:', req.body.message?.catalog?.bpp_providers[0]?.items?.length || 0);
    
    res.status(200).json({ message: 'Received on_search response' });
  });
  
  mockBAPApp.listen(MOCK_BAP_PORT, () => {
    console.log(`Mock BAP server running on http://localhost:${MOCK_BAP_PORT}`);
  });
};

// If this script is run directly, start the mock BAP server and run the test
if (require.main === module) {
  // Uncomment the next line to start a mock BAP server
  // createMockBAPServer();
  
  // Wait a few seconds for the mock server to start (if enabled)
  setTimeout(() => {
    runTest();
  }, 1000);
}

module.exports = {
  createSearchRequest,
  runTest
};