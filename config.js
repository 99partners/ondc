// Configuration file for different environments

// Helper function to safely get environment variables with defaults
function getEnv(key, defaultValue) {
  const value = process.env[key];
  return value !== undefined ? value : defaultValue;
}

// Default configuration for localhost
const defaultConfig = {
  port: parseInt(getEnv('PORT', '3000'), 10),
  hostname: 'localhost',
  environment: 'development',
  logLevel: 'debug',
  // Mock public key for demonstration - in production, fetch from ONDC registry
  buyerPublicKey: getEnv('BUYER_PUBLIC_KEY', 'T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg=='),
  // Other default configuration values can be added here
};

// Configuration for staging environment
const stagingConfig = {
  port: parseInt(getEnv('PORT', '3000'), 10),
  hostname: 'staging.99digicom.com',
  environment: 'staging',
  logLevel: 'info',
  // In a real staging environment, you would use actual keys from a secure location
  buyerPublicKey: getEnv('BUYER_PUBLIC_KEY', 'T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg=='),
  // Other staging configuration values can be added here
};

// Determine which configuration to use based on the NODE_ENV environment variable
const env = process.env.NODE_ENV || 'development';

let config;
if (env === 'staging') {
  config = { ...defaultConfig, ...stagingConfig };
} else {
  config = defaultConfig;
}

// Freeze the configuration to prevent modifications
module.exports = Object.freeze(config);
// exports.config = Object.freeze(config);