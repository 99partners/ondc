const config = require('../config');

const products = [
  {
    id: 'fashion_001',
    name: 'Cotton T-Shirt',
    short_desc: '100% cotton crew neck',
    description: 'Soft cotton T-shirt, regular fit',
    mrp: 999,
    price: 799,
    tax_rate: 5,
    hsn: '610910',
    category_id: 'fashion:apparel',
    images: ['https://via.placeholder.co/300x300?text=T-Shirt'],
    tags: ['tshirt', 'cotton', 'apparel'],
    size: ['S','M','L','XL'],
    color: ['Black','White','Blue'],
    brand: '99Digi Basics',
    gender: 'unisex',
    material: 'Cotton',
    returnable: true,
    return_window: 'P7D',
    cancellable: true,
    cancel_window: 'PT2H',
    size_chart_url: 'https://staging.99digicom.com/sizecharts/tshirt.png',
    in_stock: true,
    rating: 4.4
  },
  {
    id: 'fashion_002',
    name: 'Denim Jeans',
    short_desc: 'Straight fit denim',
    description: 'Classic straight fit denim jeans',
    mrp: 2499,
    price: 1999,
    tax_rate: 12,
    hsn: '620342',
    category_id: 'fashion:apparel',
    images: ['https://via.placeholder.co/300x300?text=Jeans'],
    tags: ['denim', 'jeans', 'apparel'],
    size: ['30','32','34','36'],
    color: ['Blue','Dark Blue'],
    brand: '99Digi Denim',
    gender: 'male',
    material: 'Cotton-Blend',
    returnable: true,
    return_window: 'P7D',
    cancellable: true,
    cancel_window: 'PT2H',
    size_chart_url: 'https://staging.99digicom.com/sizecharts/jeans.png',
    in_stock: true,
    rating: 4.2
  }
];

async function searchFashion(criteria) {
  let results = [...products];
  if (criteria.query) {
    const q = criteria.query.toLowerCase();
    results = results.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  if (criteria.category) {
    results = results.filter(p => p.category_id === criteria.category);
  }
  if (criteria.priceRange) {
    const { min = null, max = null } = criteria.priceRange;
    if (min !== null) results = results.filter(p => p.price >= min);
    if (max !== null) results = results.filter(p => p.price <= max);
  }
  results = results.filter(p => p.in_stock);
  results.sort((a,b) => b.rating - a.rating);
  return results.slice(0, config.api.maxSearchResults);
}

module.exports = { searchFashion };


