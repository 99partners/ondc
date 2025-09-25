const { bpp } = require('../config');
const crypto = require('crypto');

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

  const derived = deriveCatalogForDomain(intent, incomingContext);

  const catalog = derived.catalog;

  return {
    context: responseContext,
    message: { catalog }
  };
}

function deriveCatalogForDomain(intent, context) {
  const domain = (context?.domain || '').toUpperCase();
  const cityCode = context?.city || 'std:000';
  const intentCategoryId = intent?.category?.id;
  const intentItemName = intent?.item?.descriptor?.name;

  // Base descriptor
  const bpp_descriptor = {
    name: 'Demo Seller',
    short_desc: 'Mock BPP for ONDC retail search'
  };

  // Domain-specific category handling
  let categories = [];
  if (domain.includes('RET10')) {
    // Grocery: allow sub-category filtering
    const subCat = intentCategoryId || 'Foodgrains';
    categories = [
      { id: 'Foodgrains', descriptor: { name: 'Foodgrains' } },
      { id: 'Beverages', descriptor: { name: 'Beverages' } },
      { id: 'Snacks', descriptor: { name: 'Snacks' } }
    ];
    categories = categories.filter(c => !intentCategoryId || c.id === subCat);
  } else if (domain.includes('RET11')) {
    // F&B: city-only refresh, no sub-category filtering
    categories = [ { id: 'F&B', descriptor: { name: 'F&B' } } ];
  } else {
    // Default retail
    categories = [ { id: 'cat-1', descriptor: { name: 'General' } } ];
  }

  const items = [
    {
      id: 'item-1',
      category_id: categories[0].id,
      descriptor: {
        name: intentItemName || (domain.includes('RET10') ? 'Wheat Flour' : 'Laptop'),
        short_desc: domain.includes('RET10') ? 'Basic grocery item' : 'Sample product'
      },
      price: { currency: 'INR', value: domain.includes('RET10') ? '199' : '49999' },
      quantity: { available: { count: 10 } }
    }
  ];

  // Example differential buyer finder fee per sub-category (mock)
  const buyer_finder_fee = domain.includes('RET10')
    ? { Foodgrains: '1.0%', Beverages: '1.5%', Snacks: '2.0%' }
    : { Default: '1.0%' };

  const catalog = {
    bpp_descriptor,
    bpp_categories: categories,
    bpp_providers: [
      {
        id: 'provider-1',
        descriptor: { name: `Demo Store (${cityCode})` },
        locations: [],
        items
      }
    ],
    bpp_terms: {
      buyer_finder_fee
    }
  };
  return { catalog };
}

// In-memory catalog store for link-mode responses
const catalogStore = new Map();
function putCatalog(transactionId, data, ttlSeconds = 300) {
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + ttlSeconds * 1000;
  catalogStore.set(transactionId, { data, token, expiresAt });
  return { token, expiresAt };
}
function getCatalog(transactionId) {
  const entry = catalogStore.get(transactionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    catalogStore.delete(transactionId);
    return null;
  }
  return entry;
}

module.exports = {
  validateSearchContext,
  buildOnSearchResponse,
  deriveCatalogForDomain,
  putCatalog,
  getCatalog
};


