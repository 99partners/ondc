require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  domain: process.env.DOMAIN || 'staging.99digicom.com',
  ondc: {
    version: process.env.ONDC_VERSION || '1.2.0',
    domain: process.env.ONDC_DOMAIN || 'ONDC:RET12',
    country: process.env.ONDC_COUNTRY || 'IND',
    city: process.env.ONDC_CITY || 'std:080',
    sellerId: process.env.ONDC_SELLER_ID || '99digicom-seller',
    sellerName: process.env.ONDC_SELLER_NAME || '99DigiCom Fashion'
  },
  api: {
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
    maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS) || 50
  }
};

module.exports = config;


