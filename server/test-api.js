const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test data for /search API
const searchPayload = {
  context: {
    domain: "ONDC:RET10",
    country: "IND",
    city: "std:0278",
    action: "search",
    core_version: "1.2.0",
    bap_id: "ref-app-buyer-staging-v2.ondc.org",
    bap_uri: "https://ref-app-buyer-staging-v2.ondc.org",
    bpp_id: "staging.99digicom.com",
    bpp_uri: "https://staging.99digicom.com",
    transaction_id: "txn_" + Date.now(),
    message_id: "msg_" + Date.now(),
    timestamp: new Date().toISOString(),
    ttl: "PT30S",
    key: "test-key",
    encryption: "test-encryption",
    signature: "test-signature"
  },
  message: {
    intent: {
      item: {
        descriptor: {
          name: "Laptop"
        }
      },
      category: {
        id: "Electronics",
        descriptor: {
          name: "Electronics"
        }
      }
    }
  }
};

async function testSearchAPI() {
  try {
    console.log('Testing /search API...');
    console.log('Payload:', JSON.stringify(searchPayload, null, 2));
    
    const response = await axios.post(`${BASE_URL}/search`, searchPayload);
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error testing /search API:', error.response?.data || error.message);
    throw error;
  }
}

async function testOnSearchAPI() {
  try {
    console.log('\nTesting /on_search API...');
    
    const onSearchPayload = {
      context: {
        domain: "ONDC:RET10",
        country: "IND",
        city: "std:0278",
        action: "on_search",
        core_version: "1.2.0",
        bap_id: "ref-app-buyer-staging-v2.ondc.org",
        bap_uri: "https://ref-app-buyer-staging-v2.ondc.org",
        bpp_id: "staging.99digicom.com",
        bpp_uri: "https://staging.99digicom.com",
        transaction_id: searchPayload.context.transaction_id,
        message_id: "msg_on_search_" + Date.now(),
        timestamp: new Date().toISOString(),
        ttl: "PT30S",
        key: "test-key",
        encryption: "test-encryption",
        signature: "test-signature"
      },
      message: {
        catalog: {
          bpp_descriptor: {
            name: "Demo Seller",
            short_desc: "Mock BPP for ONDC retail search"
          },
          bpp_categories: [
            {
              id: "Electronics",
              descriptor: { name: "Electronics" }
            }
          ],
          bpp_providers: [
            {
              id: "provider-1",
              descriptor: { name: "Demo Store" },
              locations: [],
              items: [
                {
                  id: "item-1",
                  category_id: "Electronics",
                  descriptor: {
                    name: "Laptop",
                    short_desc: "Sample laptop"
                  },
                  price: { currency: "INR", value: "49999" },
                  quantity: { available: { count: 10 } }
                }
              ]
            }
          ]
        }
      }
    };
    
    console.log('Payload:', JSON.stringify(onSearchPayload, null, 2));
    
    const response = await axios.post(`${BASE_URL}/on_search`, onSearchPayload);
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error testing /on_search API:', error.response?.data || error.message);
    throw error;
  }
}

async function testTransactionTrail() {
  try {
    console.log('\nTesting transaction trail...');
    
    const response = await axios.get(`${BASE_URL}/debug/transactions`);
    console.log('Transaction Trail:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error testing transaction trail:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting ONDC API Tests...\n');
    
    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('Health Status:', healthResponse.data);
    
    // Test search API
    await testSearchAPI();
    
    // Test on_search API
    await testOnSearchAPI();
    
    // Test transaction trail
    await testTransactionTrail();
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testSearchAPI,
  testOnSearchAPI,
  testTransactionTrail,
  runTests
};
