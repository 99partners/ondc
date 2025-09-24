// Script to check which environment configuration is being used
const { config } = require('./config');

console.log('Current Environment Configuration:');
console.log(`Environment: ${config.environment}`);
console.log(`Hostname: ${config.hostname}`);
console.log(`Port: ${config.port}${process.env.PORT ? ' (overridden by PORT environment variable)' : ''}`);
console.log(`Log Level: ${config.logLevel}`);
console.log(`Buyer Public Key: ${config.buyerPublicKey === 'T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==' ? 'Default mock key' : 'Custom key (overridden by BUYER_PUBLIC_KEY environment variable)'}`);

console.log('\nEnvironment Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set (using default: development)'}`);
console.log(`PORT: ${process.env.PORT || 'Not set (using default)'}`);
console.log(`BUYER_PUBLIC_KEY: ${process.env.BUYER_PUBLIC_KEY ? 'Set (overriding default)' : 'Not set (using default)'}`);

console.log('\nConfiguration is ready for use.');