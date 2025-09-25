const request = require('supertest');
const app = require('../app');

describe('ONDC Search API', () => {
  
  describe('POST /protocol/v1/search', () => {
    it('should handle valid search request', async () => {
      const searchRequest = {
        context: {
          domain: "ONDC:RET10",
          country: "IND",
          city: "std:080",
          action: "search",
          core_version: "2.0.1",
          bap_id: "ref-app-buyer-staging-v2.ondc.org",
          bap_uri: "https://ref-app-buyer-staging-v2.ondc.org/protocol/v1",
          bpp_id: "99digicom-seller",
          bpp_uri: "https://staging.99digicom.com",
          transaction_id: "test-transaction-123",
          message_id: "test-message-123",
          timestamp: new Date().toISOString(),
          ttl: "PT30S"
        },
        message: {
          intent: {
            item: {
              descriptor: {
                name: "smartphone"
              }
            },
            category: {
              id: "electronics"
            }
          }
        }
      };

      const response = await request(app)
        .post('/protocol/v1/search')
        .send(searchRequest)
        .expect(200);

      expect(response.body).toHaveProperty('context');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toHaveProperty('catalog');
      expect(response.body.context.action).toBe('on_search');
    });

    it('should handle search request without category', async () => {
      const searchRequest = {
        context: {
          domain: "ONDC:RET10",
          country: "IND",
          city: "std:080",
          action: "search",
          core_version: "2.0.1",
          bap_id: "ref-app-buyer-staging-v2.ondc.org",
          bap_uri: "https://ref-app-buyer-staging-v2.ondc.org/protocol/v1",
          bpp_id: "99digicom-seller",
          bpp_uri: "https://staging.99digicom.com",
          transaction_id: "test-transaction-124",
          message_id: "test-message-124",
          timestamp: new Date().toISOString(),
          ttl: "PT30S"
        },
        message: {
          intent: {
            item: {
              descriptor: {
                name: "laptop"
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/protocol/v1/search')
        .send(searchRequest)
        .expect(200);

      expect(response.body.message.catalog).toBeDefined();
    });

    it('should return error for invalid request', async () => {
      const invalidRequest = {
        context: {
          domain: "ONDC:RET10"
        }
      };

      const response = await request(app)
        .post('/protocol/v1/search')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /protocol/v1/test-search', () => {
    it('should handle test search request', async () => {
      const testRequest = {
        query: "smartphone",
        category: "electronics",
        minPrice: 10000,
        maxPrice: 50000
      };

      const response = await request(app)
        .post('/protocol/v1/test-search')
        .send(testRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('count');
    });

    it('should handle empty search', async () => {
      const response = await request(app)
        .post('/protocol/v1/test-search')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeInstanceOf(Array);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /protocol/v1/stats', () => {
    it('should return search statistics', async () => {
      const response = await request(app)
        .get('/protocol/v1/stats')
        .expect(200);

      expect(response.body).toHaveProperty('total_products');
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('categories_list');
      expect(response.body.categories_list).toBeInstanceOf(Array);
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'ONDC Seller Search API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('seller');
      expect(response.body).toHaveProperty('domain');
    });
  });
});
