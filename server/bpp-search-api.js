const { createAuthorizationHeader } = require("ondc-crypto-sdk-nodejs");

// This is where you would load your private key
// For example: const privateKey = fs.readFileSync('path/to/private-key.pem', 'utf8');
const privateKey = "T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg=="; // Replace with your actual BPP seller private key

/**
 * Creates an ONDC BPP Seller response to a Search API request
 * This implementation supports:
 * - Responding to catalog search requests
 * - Providing seller information
 * - Including product catalog details
 * - BPP seller static terms publication
 */
async function createBppSearchResponse() {
  try {
    // Generate unique IDs for the transaction
    const transactionId = generateUniqueId();
    const messageId = generateUniqueId();
    const timestamp = new Date().toISOString();
    
    // Create a search response body according to the ONDC Search API specification for BPP
    const searchResponseBody = {
      "context": {
        "domain": "ONDC:RET10", // Grocery domain
        "action": "on_search",
        "country": "IND",
        "city": "*", // Bangalore city code
        "core_version": "1.2.0",
        "bpp_id": "staging.99digicom.com", // Seller/BPP ID
        "bpp_uri": "https://staging.99digicom.com", // Seller/BPP endpoint
        "transaction_id": transactionId, // Should match the transaction_id from buyer's search request
        "message_id": messageId,
        "timestamp": timestamp
      },
      "message": {
        "catalog": {
          "bpp/descriptor": {
            "name": "Sample Store",
            "symbol": "https://sellerNP.com/images/logo.png",
            "short_desc": "Grocery Store",
            "long_desc": "Sample grocery store with a wide range of products",
            "images": ["https://sellerNP.com/images/storefront.png"]
          },
          "bpp/providers": [
            {
              "id": "P1",
              "descriptor": {
                "name": "Sample Store",
                "symbol": "https://sellerNP.com/images/logo.png",
                "short_desc": "Grocery Store",
                "long_desc": "Sample grocery store with a wide range of products",
                "images": ["https://sellerNP.com/images/storefront.png"]
              },
              "ttl": "PT30M", // Time-to-live of 30 minutes for this catalog
              "locations": [
                {
                  "id": "L1",
                  "gps": "12.9715987,77.5945627", // Coordinates for Bangalore
                  "address": {
                    "street": "MG Road",
                    "city": "Bangalore",
                    "area_code": "560001",
                    "state": "Karnataka"
                  },
                  "circle": {
                    "gps": "12.9715987,77.5945627",
                    "radius": {
                      "unit": "km",
                      "value": "10"
                    }
                  },
                  "time": {
                    "days": "1,2,3,4,5,6,7",
                    "schedule": {
                      "holidays": ["2023-08-15"],
                      "frequency": "PT4H",
                      "times": ["1100", "1900"]
                    }
                  }
                }
              ],
              "items": [
                {
                  "id": "I1",
                  "descriptor": {
                    "name": "Whole Wheat Flour",
                    "symbol": "https://sellerNP.com/images/wheat-flour.png",
                    "short_desc": "Organic whole wheat flour",
                    "long_desc": "Organic stone-ground whole wheat flour, 1kg pack",
                    "images": ["https://sellerNP.com/images/wheat-flour-1.png", "https://sellerNP.com/images/wheat-flour-2.png"]
                  },
                  "price": {
                    "currency": "INR",
                    "value": "110.00",
                    "maximum_value": "110.00"
                  },
                  "category_id": "Foodgrains",
                  "fulfillment_id": "F1",
                  "location_id": "L1",
                  "matched": true,
                  "@ondc/org/returnable": true,
                  "@ondc/org/cancellable": true,
                  "@ondc/org/return_window": "P7D", // 7-day return window
                  "@ondc/org/seller_pickup_return": true,
                  "@ondc/org/time_to_ship": "PT2D", // 2 days to ship
                  "@ondc/org/available_on_cod": false,
                  "@ondc/org/contact_details_consumer_care": "support@sellerNP.com, +919876543210",
                  "tags": [
                    {
                      "code": "origin",
                      "list": [
                        {
                          "code": "country",
                          "value": "IND"
                        }
                      ]
                    }
                  ]
                },
                {
                  "id": "I2",
                  "descriptor": {
                    "name": "Basmati Rice",
                    "symbol": "https://sellerNP.com/images/basmati-rice.png",
                    "short_desc": "Premium basmati rice",
                    "long_desc": "Premium aged basmati rice, 5kg pack",
                    "images": ["https://sellerNP.com/images/basmati-rice-1.png"]
                  },
                  "price": {
                    "currency": "INR",
                    "value": "450.00",
                    "maximum_value": "450.00"
                  },
                  "category_id": "Foodgrains",
                  "fulfillment_id": "F1",
                  "location_id": "L1",
                  "matched": true,
                  "@ondc/org/returnable": true,
                  "@ondc/org/cancellable": true,
                  "@ondc/org/return_window": "P7D",
                  "@ondc/org/seller_pickup_return": true,
                  "@ondc/org/time_to_ship": "PT2D",
                  "@ondc/org/available_on_cod": false,
                  "@ondc/org/contact_details_consumer_care": "support@sellerNP.com, +919876543210"
                }
              ],
              "fulfillments": [
                {
                  "id": "F1",
                  "type": "Delivery",
                  "tracking": true,
                  "contact": {
                    "phone": "+919876543210",
                    "email": "support@sellerNP.com"
                  }
                }
              ],
              "tags": [
                {
                  "code": "bpp_terms",
                  "list": [
                    {
                      "code": "static_terms",
                      "value": "https://sellerNP.com/ondc/terms/seller_terms.html"
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    };

    // Generate authorization header for the search response
    const authHeader = await createAuthorizationHeader({
      body: JSON.stringify(searchResponseBody),
      privateKey: privateKey,
      subscriberId: "staging.99digicom.com", // BPP Seller Subscriber ID from ONDC registration
      subscriberUniqueKeyId: "staging-99digicom-key-001", // BPP Seller Unique Key Id from ONDC registration
    });
    
    console.log("Generated Authorization Header for BPP Search Response:", authHeader);
    console.log("BPP Search Response Body:", JSON.stringify(searchResponseBody, null, 2));
    
    // Example of how to send the search response to the buyer NP
    console.log("\nExample usage with fetch API to respond to buyer:");
    console.log(`fetch('https://buyerNP.com/ondc/on_search', {`);
    console.log(`  method: 'POST',`);
    console.log(`  headers: {`);
    console.log(`    'Content-Type': 'application/json',`);
    console.log(`    'Authorization': '${authHeader}'`);
    console.log(`  },`);
    console.log(`  body: JSON.stringify(${JSON.stringify(searchResponseBody)})`); 
    console.log(`})`);
    
    return {
      responseBody: searchResponseBody,
      authHeader: authHeader
    };
  } catch (error) {
    console.error("Error creating BPP search response:", error);
    throw error;
  }
}

/**
 * Helper function to generate unique IDs for transactions and messages
 */
function generateUniqueId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Alternative implementation for responding to a specific search request
 * @param {Object} originalSearchRequest - The original search request received from the buyer
 */
async function respondToSearchRequest(originalSearchRequest) {
  try {
    // Extract transaction ID and other context from original request
    const { transaction_id, message_id } = originalSearchRequest.context;
    const timestamp = new Date().toISOString();
    
    // Create a search response that references the original request
    const searchResponseBody = {
      "context": {
        "domain": originalSearchRequest.context.domain,
        "action": "on_search",
        "country": originalSearchRequest.context.country,
        "city": originalSearchRequest.context.city,
        "core_version": originalSearchRequest.context.core_version,
        "bpp_id": "staging.99digicom.com", // Your BPP ID
        "bpp_uri": "https://staging.99digicom.com",
        "transaction_id": transaction_id, // Use the same transaction_id as in the request
        "message_id": generateUniqueId(), // Generate a new message_id for the response
        "timestamp": timestamp,
        // Reference to the original request
        "bap_id": originalSearchRequest.context.bap_id,
        "bap_uri": originalSearchRequest.context.bap_uri
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
                // Filter items based on the search intent
                // For example, if the search was for "Foodgrains" category
                // only return items in that category
              ]
            }
          ]
        }
      }
    };

    // Generate authorization header for the search response
    const authHeader = await createAuthorizationHeader({
      body: JSON.stringify(searchResponseBody),
      privateKey: privateKey,
      subscriberId: "staging.99digicom.com",
      subscriberUniqueKeyId: "staging-99digicom-key-001",
    });
    
    console.log("Response to specific search request:");
    console.log("Authorization Header:", authHeader);
    
    return {
      responseBody: searchResponseBody,
      authHeader: authHeader
    };
  } catch (error) {
    console.error("Error responding to search request:", error);
    throw error;
  }
}

/**
 * Creates a BPP Search API response with the exact payload provided
 */
async function createExactPayloadBppSearchResponse() {
  try {
    // Use the exact payload provided
    const searchResponseBody = {
      "context": {
        "domain": "ONDC:RET10",
        "action": "on_search",
        "country": "IND",
        "city": "*",
        "core_version": "1.2.0",
        "bpp_id": "staging.99digicom.com",
        "bpp_uri": " `https://staging.99digicom.com` ",
        "transaction_id": "id-1758275614620-zmcg7ju",
        "message_id": "id-1758275614620-0yc6fw5",
        "timestamp": "2025-09-18T04:00:48.000Z"
      },
      "message": {
        "catalog": {
          "bpp/descriptor": {
            "name": "Sample Store",
            "symbol": " `https://sellerNP.com/images/logo.png` ",
            "short_desc": "Grocery Store",
            "long_desc": "Sample grocery store with a wide range of products",
            "images": [" `https://sellerNP.com/images/storefront.png` "]
          },
          "bpp/providers": [
            {
              "id": "P1",
              "descriptor": {
                "name": "Sample Store",
                "symbol": " `https://sellerNP.com/images/logo.png` ",
                "short_desc": "Grocery Store",
                "long_desc": "Sample grocery store with a wide range of products",
                "images": [" `https://sellerNP.com/images/storefront.png` "]
              },
              "ttl": "PT30M",
              "locations": [
                {
                  "id": "L1",
                  "gps": "12.9715987,77.5945627",
                  "address": {
                    "street": "MG Road",
                    "city": "Bangalore",
                    "area_code": "560001",
                    "state": "Karnataka"
                  }
                }
              ],
              "items": [
                {
                  "id": "I1",
                  "descriptor": {
                    "name": "Whole Wheat Flour",
                    "symbol": " `https://sellerNP.com/images/wheat-flour.png` ",
                    "short_desc": "Organic whole wheat flour",
                    "long_desc": "Organic stone-ground whole wheat flour, 1kg pack",
                    "images": [
                      " `https://sellerNP.com/images/wheat-flour-1.png` ",
                      " `https://sellerNP.com/images/wheat-flour-2.png` "
                    ]
                  },
                  "price": {
                    "currency": "INR",
                    "value": "110.00",
                    "maximum_value": "110.00"
                  },
                  "category_id": "Foodgrains",
                  "fulfillment_id": "F1",
                  "location_id": "L1"
                }
              ]
            }
          ]
        }
      }
    };

    // Generate authorization header for the search response
    const authHeader = await createAuthorizationHeader({
      body: JSON.stringify(searchResponseBody),
      privateKey: privateKey,
      subscriberId: "staging.99digicom.com", // BPP Seller Subscriber ID from ONDC registration
      subscriberUniqueKeyId: "staging-99digicom-key-001", // BPP Seller Unique Key Id from ONDC registration
    });
    
    console.log("\nGenerated Authorization Header for Exact Payload BPP Search Response:", authHeader);
    console.log("Exact Payload BPP Search Response Body:", JSON.stringify(searchResponseBody, null, 2));
    
    return {
      responseBody: searchResponseBody,
      authHeader: authHeader
    };
  } catch (error) {
    console.error("Error creating exact payload BPP search response:", error);
    throw error;
  }
}

// Export functions for external usage
module.exports = {
  createBppSearchResponse,
  respondToSearchRequest,
  createExactPayloadBppSearchResponse
};

// Execute the main BPP search function
createBppSearchResponse().then(() => {
  // Optionally execute the exact payload example after the main search
  // createExactPayloadBppSearchResponse();
});