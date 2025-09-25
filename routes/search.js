const express = require('express');
const { 
  generateContext, 
  generateAckResponse, 
  generateErrorResponse, 
  validateRequest, 
  generateCatalog, 
  parseSearchIntent 
} = require('../utils/ondcUtils');
const productService = require('../services/productService');

const router = express.Router();

/**
 * ONDC Search API Endpoint
 * Handles product search requests from buyer applications
 */
router.post('/search', async (req, res) => {
  try {
    console.log('Search request received:', JSON.stringify(req.body, null, 2));
    
    // Validate request structure
    validateRequest(req);
    
    const { context, message } = req.body;
    
    // Parse search intent
    const searchCriteria = parseSearchIntent(message);
    console.log('Search criteria:', searchCriteria);
    
    // Search products based on criteria
    const products = await productService.searchProducts(searchCriteria);
    console.log(`Found ${products.length} products matching search criteria`);
    
    // Generate response context
    const responseContext = generateContext('on_search', context.bap_id);
    
    // Generate catalog with search results
    const catalog = generateCatalog(products, responseContext);
    
    // Prepare on_search response
    const onSearchResponse = {
      context: responseContext,
      message: {
        catalog: catalog
      }
    };
    
    console.log('Sending on_search response with', products.length, 'products');
    
    res.json(onSearchResponse);
    
  } catch (error) {
    console.error('Error in search endpoint:', error);
    
    // Generate error response
    const errorContext = generateContext('on_search', req.body?.context?.bap_id);
    const errorResponse = generateErrorResponse(
      errorContext, 
      'SEARCH_ERROR', 
      error.message || 'Search request failed'
    );
    
    res.status(400).json(errorResponse);
  }
});

/**
 * ONDC On Search Callback Endpoint
 * This endpoint would be called by the buyer app after receiving search results
 */
router.post('/on_search', async (req, res) => {
  try {
    console.log('On search callback received:', JSON.stringify(req.body, null, 2));
    
    // Validate request structure
    validateRequest(req);
    
    // Generate acknowledgment response
    const responseContext = generateContext('ack', req.body.context.bap_id);
    const ackResponse = generateAckResponse(responseContext, true);
    
    res.json(ackResponse);
    
  } catch (error) {
    console.error('Error in on_search callback:', error);
    
    // Generate error response
    const errorContext = generateContext('ack', req.body?.context?.bap_id);
    const errorResponse = generateErrorResponse(
      errorContext, 
      'CALLBACK_ERROR', 
      error.message || 'Callback processing failed'
    );
    
    res.status(400).json(errorResponse);
  }
});

/**
 * Get search statistics (for monitoring)
 */
router.get('/stats', async (req, res) => {
  try {
    const categories = await productService.getCategories();
    const totalProducts = await productService.searchProducts({});
    
    const stats = {
      total_products: totalProducts.length,
      categories: categories.length,
      categories_list: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        product_count: totalProducts.filter(p => p.category_id === cat.id).length
      })),
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error getting search stats:', error);
    res.status(500).json({
      error: 'Failed to get search statistics',
      message: error.message
    });
  }
});

/**
 * Test search endpoint (for development/testing)
 */
router.post('/test-search', async (req, res) => {
  try {
    const { query, category, minPrice, maxPrice } = req.body;
    
    const searchCriteria = {
      query: query || '',
      category: category || '',
      location: '',
      priceRange: {
        min: minPrice || null,
        max: maxPrice || null
      }
    };
    
    const products = await productService.searchProducts(searchCriteria);
    
    res.json({
      success: true,
      searchCriteria,
      results: products,
      count: products.length
    });
    
  } catch (error) {
    console.error('Error in test search:', error);
    res.status(500).json({
      error: 'Test search failed',
      message: error.message
    });
  }
});

module.exports = router;
