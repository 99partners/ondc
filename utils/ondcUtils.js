const crypto = require('crypto');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate ONDC context for API responses
 */
const generateContext = (action, bppId = null) => {
  const config = require('../config');
  
  return {
    domain: config.ondc.domain,
    country: config.ondc.country,
    city: config.ondc.city,
    action: action,
    core_version: config.ondc.version,
    bap_id: bppId || config.ondc.sellerId,
    bap_uri: `https://${config.domain}`,
    bpp_id: config.ondc.sellerId,
    bpp_uri: `https://${config.domain}`,
    transaction_id: uuidv4(),
    message_id: uuidv4(),
    timestamp: moment().toISOString(),
    ttl: "PT30S"
  };
};

/**
 * Generate ONDC acknowledgment response
 */
const generateAckResponse = (context, ack = true) => {
  return {
    context: context,
    message: {
      ack: {
        status: ack ? "ACK" : "NACK"
      }
    }
  };
};

/**
 * Generate ONDC error response
 */
const generateErrorResponse = (context, errorCode, errorMessage) => {
  return {
    context: context,
    error: {
      type: "CONTEXT_ERROR",
      code: errorCode,
      message: errorMessage
    }
  };
};

/**
 * Validate ONDC request structure
 */
const validateRequest = (req) => {
  const requiredFields = ['context', 'message'];
  
  for (const field of requiredFields) {
    if (!req.body[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  const context = req.body.context;
  const requiredContextFields = ['domain', 'action', 'core_version', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
  
  for (const field of requiredContextFields) {
    if (!context[field]) {
      throw new Error(`Missing required context field: ${field}`);
    }
  }
  
  return true;
};

/**
 * Generate product catalog structure
 */
const generateCatalog = (products, context) => {
  const config = require('../config');
  
  return {
    "bpp/descriptor": {
      name: config.ondc.sellerName,
      code: config.ondc.sellerId,
      short_desc: "Digital commerce seller",
      long_desc: "99DigiCom - Digital commerce solutions provider",
      images: [`https://${config.domain}/logo.png`]
    },
    "bpp/categories": [
      {
        id: "electronics",
        parent_category_id: null,
        name: "Electronics",
        description: "Electronic products and accessories"
      },
      {
        id: "clothing",
        parent_category_id: null,
        name: "Clothing",
        description: "Fashion and apparel"
      }
    ],
    "bpp/providers": [
      {
        id: config.ondc.sellerId,
        descriptor: {
          name: config.ondc.sellerName,
          short_desc: "Digital commerce seller",
          long_desc: "99DigiCom - Digital commerce solutions provider"
        },
        categories: ["electronics", "clothing"],
        items: products.map(product => ({
          id: product.id,
          parent_item_id: null,
          descriptor: {
            name: product.name,
            short_desc: product.short_desc || product.description,
            long_desc: product.description,
            images: product.images || [`https://${config.domain}/placeholder.png`]
          },
          price: {
            currency: "INR",
            value: product.price.toString()
          },
          category_id: product.category_id || "electronics",
          fulfillment_id: "standard_delivery",
          location_id: "bangalore",
          time: {
            label: "Delivery Time",
            duration: "P1D"
          },
          rateable: true,
          tags: product.tags || []
        })),
        fulfillments: [
          {
            id: "standard_delivery",
            type: "Delivery",
            tracking: false,
            start: {
              location: {
                gps: "12.9716,77.5946",
                address: {
                  name: "99DigiCom Warehouse",
                  building: "Tech Park",
                  locality: "Electronic City",
                  city: "Bangalore",
                  state: "Karnataka",
                  country: "India",
                  area_code: "560100"
                }
              }
            },
            end: {
              location: {
                gps: "12.9716,77.5946",
                address: {
                  name: "Customer Location",
                  building: "",
                  locality: "",
                  city: "Bangalore",
                  state: "Karnataka",
                  country: "India",
                  area_code: "560100"
                }
              }
            }
          }
        ],
        locations: [
          {
            id: "bangalore",
            gps: "12.9716,77.5946",
            address: {
              name: "99DigiCom Warehouse",
              building: "Tech Park",
              locality: "Electronic City",
              city: "Bangalore",
              state: "Karnataka",
              country: "India",
              area_code: "560100"
            }
          }
        ]
      }
    ]
  };
};

/**
 * Parse search intent from request
 */
const parseSearchIntent = (message) => {
  if (!message.intent) {
    throw new Error('Missing intent in search request');
  }
  
  const intent = message.intent;
  const searchCriteria = {
    query: intent.item?.descriptor?.name || '',
    category: intent.category?.id || '',
    location: intent.fulfillment?.start?.location?.address?.city || '',
    priceRange: {
      min: intent.item?.price?.minimum?.value ? parseFloat(intent.item.price.minimum.value) : null,
      max: intent.item?.price?.maximum?.value ? parseFloat(intent.item.price.maximum.value) : null
    }
  };
  
  return searchCriteria;
};

module.exports = {
  generateContext,
  generateAckResponse,
  generateErrorResponse,
  validateRequest,
  generateCatalog,
  parseSearchIntent
};
