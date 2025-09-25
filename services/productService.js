const config = require('../config');

/**
 * Mock product database - Replace with actual database integration
 */
const mockProducts = [
  {
    id: "prod_001",
    name: "Smartphone XYZ",
    description: "Latest smartphone with advanced features",
    short_desc: "Latest smartphone",
    price: 25000,
    category_id: "electronics",
    images: ["https://example.com/phone1.jpg"],
    tags: ["smartphone", "electronics", "mobile"],
    in_stock: true,
    rating: 4.5
  },
  {
    id: "prod_002",
    name: "Wireless Headphones",
    description: "High-quality wireless headphones with noise cancellation",
    short_desc: "Wireless headphones",
    price: 5000,
    category_id: "electronics",
    images: ["https://example.com/headphones1.jpg"],
    tags: ["headphones", "wireless", "audio"],
    in_stock: true,
    rating: 4.2
  },
  {
    id: "prod_003",
    name: "Cotton T-Shirt",
    description: "Comfortable cotton t-shirt for everyday wear",
    short_desc: "Cotton t-shirt",
    price: 800,
    category_id: "clothing",
    images: ["https://example.com/tshirt1.jpg"],
    tags: ["clothing", "cotton", "casual"],
    in_stock: true,
    rating: 4.0
  },
  {
    id: "prod_004",
    name: "Laptop Pro",
    description: "High-performance laptop for professionals",
    short_desc: "Professional laptop",
    price: 75000,
    category_id: "electronics",
    images: ["https://example.com/laptop1.jpg"],
    tags: ["laptop", "computer", "professional"],
    in_stock: true,
    rating: 4.7
  },
  {
    id: "prod_005",
    name: "Denim Jeans",
    description: "Classic denim jeans for men and women",
    short_desc: "Classic denim jeans",
    price: 2000,
    category_id: "clothing",
    images: ["https://example.com/jeans1.jpg"],
    tags: ["clothing", "denim", "casual"],
    in_stock: true,
    rating: 4.3
  }
];

/**
 * Search products based on criteria
 */
const searchProducts = async (searchCriteria) => {
  try {
    let filteredProducts = [...mockProducts];
    
    // Filter by query (name or description contains search term)
    if (searchCriteria.query) {
      const query = searchCriteria.query.toLowerCase();
      filteredProducts = filteredProducts.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Filter by category
    if (searchCriteria.category) {
      filteredProducts = filteredProducts.filter(product => 
        product.category_id === searchCriteria.category
      );
    }
    
    // Filter by price range
    if (searchCriteria.priceRange.min !== null) {
      filteredProducts = filteredProducts.filter(product => 
        product.price >= searchCriteria.priceRange.min
      );
    }
    
    if (searchCriteria.priceRange.max !== null) {
      filteredProducts = filteredProducts.filter(product => 
        product.price <= searchCriteria.priceRange.max
      );
    }
    
    // Filter only in-stock products
    filteredProducts = filteredProducts.filter(product => product.in_stock);
    
    // Sort by rating (highest first)
    filteredProducts.sort((a, b) => b.rating - a.rating);
    
    // Limit results
    const maxResults = config.api.maxSearchResults;
    filteredProducts = filteredProducts.slice(0, maxResults);
    
    return filteredProducts;
    
  } catch (error) {
    console.error('Error searching products:', error);
    throw new Error('Failed to search products');
  }
};

/**
 * Get product by ID
 */
const getProductById = async (productId) => {
  try {
    const product = mockProducts.find(p => p.id === productId);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  } catch (error) {
    console.error('Error getting product by ID:', error);
    throw error;
  }
};

/**
 * Get all categories
 */
const getCategories = async () => {
  try {
    const categories = [
      {
        id: "electronics",
        name: "Electronics",
        description: "Electronic products and accessories"
      },
      {
        id: "clothing",
        name: "Clothing",
        description: "Fashion and apparel"
      }
    ];
    
    return categories;
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
};

/**
 * Get products by category
 */
const getProductsByCategory = async (categoryId) => {
  try {
    const products = mockProducts.filter(product => 
      product.category_id === categoryId && product.in_stock
    );
    
    return products;
  } catch (error) {
    console.error('Error getting products by category:', error);
    throw error;
  }
};

module.exports = {
  searchProducts,
  getProductById,
  getCategories,
  getProductsByCategory
};
