require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  domain: process.env.DOMAIN || 'staging.99digicom.com',
  
  // ONDC Protocol Configuration
  ondc: {
    version: process.env.ONDC_VERSION || '2.0.1',
    domain: process.env.ONDC_DOMAIN || 'ONDC:RET10',
    country: process.env.ONDC_COUNTRY || 'IND',
    city: process.env.ONDC_CITY || 'std:080',
    sellerId: process.env.ONDC_SELLER_ID || '99digicom-seller',
    sellerName: process.env.ONDC_SELLER_NAME || '99DigiCom Seller'
  },
  
  // API Configuration
  api: {
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
    maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS) || 50
  },
  
  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'ondc_seller',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || ''
  },
  
  // External Services
  services: {
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || ''
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      s3Bucket: process.env.AWS_S3_BUCKET || ''
    }
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  }
};

module.exports = config;
