const { bpp } = require('../config');

function validateSearchContext(context) {
  if (!context || typeof context !== 'object') {
    return 'Missing context';
  }
  if (context.action !== 'search') {
    return 'context.action must be "search"';
  }
  if (!context.bap_id) {
    return 'Missing context.bap_id';
  }
  if (!context.bap_uri) {
    return 'Missing context.bap_uri';
  }
  return null;
}

// Placeholder: verify ED25519 signature per ONDC spec (not implemented)
// function verifySignature(headers, body) {
//   // TODO: Implement ED25519 verification using signing string and public key
//   return true;
// }

function buildOnSearchResponse(incomingContext, intent) {
  const responseContext = {
    ...incomingContext,
    action: 'on_search',
    bpp_id: bpp.id,
    bpp_uri: bpp.uri
  };

  // Example mock catalog
  const catalog = {
    bpp_descriptor: {
      name: 'Demo Seller',
      short_desc: 'Mock BPP for ONDC retail search'
    },
    bpp_categories: [
      {
        id: 'cat-1',
        descriptor: { name: 'Electronics' }
      }
    ],
    bpp_providers: [
      {
        id: 'provider-1',
        descriptor: { name: 'Demo Seller Store' },
        locations: [],
        items: [
          {
            id: 'item-1',
            category_id: 'cat-1',
            descriptor: {
              name: intent?.item?.descriptor?.name || 'Laptop',
              short_desc: 'Sample product'
            },
            price: { currency: 'INR', value: '49999' },
            quantity: { available: { count: 10 } }
          }
        ]
      }
    ]
  };

  return {
    context: responseContext,
    message: { catalog }
  };
}

module.exports = {
  validateSearchContext,
  buildOnSearchResponse
};


