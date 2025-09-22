const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');
const searchRouter = require('./search-api');

const port = process.env.PORT || 3001; // Port on which the server will listen
const ENCRYPTION_PRIVATE_KEY =
  'MC4CAQAwBQYDK2VuBCIEIHA+jwRt3qb7iISfxBgvJh5rrLjfEoI7i873grc7BBRq';
const ONDC_PUBLIC_KEY =
  'MCowBQYDK2VuAyEAa9Wbpvd9SsrpOZFcynyt/TO3x0Yrqyys4NUGIvyxX2Q=';
const REQUEST_ID = '99digicom-req-20250904-001';
const SIGNING_PRIVATE_KEY =
  'T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==';


const htmlFile = `
<!--Contents of ondc-site-verification.html. -->
<!--Please replace SIGNED_UNIQUE_REQ_ID with an actual value-->
<html>
  <head>
    <meta
      name="ondc-site-verification"
      content="9Ns1kgNszpwQIkU2WLFB31KkX8kI/uJLhzflihI7L/NVuicyAsAaE3HcBOMuCeo5PyRvDJ62AjWoZS0jr6b2Bg=="
    />
  </head>
  <body>
    ONDC Site Verification Page
  </body>
</html>
`;

// Pre-defined public and private keys
const privateKey = crypto.createPrivateKey({
  key: Buffer.from(ENCRYPTION_PRIVATE_KEY, 'base64'), // Decode private key from base64
  format: 'der', // Specify the key format as DER
  type: 'pkcs8', // Specify the key type as PKCS#8
});
const publicKey = crypto.createPublicKey({
  key: Buffer.from(ONDC_PUBLIC_KEY, 'base64'), // Decode public key from base64
  format: 'der', // Specify the key format as DER
  type: 'spki', // Specify the key type as SubjectPublicKeyInfo (SPKI)
});

// Calculate the shared secret key using Diffie-Hellman
const sharedKey = crypto.diffieHellman({
  privateKey: privateKey,
  publicKey: publicKey,
});

// Create an Express application
const app = express();
app.use(bodyParser.json());

// Integrate search API router
app.use('/', searchRouter);

app.get('/on_subscribe', (req, res) => {
  res.status(200).send("✅ ONDC on_subscribe endpoint is up! Use POST for verification.");
});

// Route for handling subscription requests
app.post('/on_subscribe', function (req, res) {
  const { challenge } = req.body; // Extract the 'challenge' property from the request body
  const answer = decryptAES256ECB(sharedKey, challenge); // Decrypt the challenge using AES-256-ECB
  const resp = { answer: answer };
  res.status(200).json(resp); // Send a JSON response with the answer
});

// Route for serving a verification file
app.get('/ondc-site-verification.html', async (req, res) => {
  const signedContent = await signMessage(REQUEST_ID, SIGNING_PRIVATE_KEY);
  // Replace the placeholder with the actual value
  const modifiedHTML = htmlFile.replace(/SIGNED_UNIQUE_REQ_ID/g, signedContent);
  // Send the modified HTML as the response
  res.send(modifiedHTML);
});

// Default route
app.get('/', (req, res) => res.send('Hello World!'));

// Health check route
app.get('/health', (req, res) => res.send('Health OK!!'));

// Add error handling
app.on('error', (err) => {
  console.error('Server error:', err);
});

// Start server with error handling
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Decrypt using AES-256-ECB
function decryptAES256ECB(key, encrypted) {
  const iv = Buffer.alloc(0); // ECB doesn't use IV
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function signMessage(signingString, privateKey) {
  await _sodium.ready;
  const sodium = _sodium;
  const signedMessage = sodium.crypto_sign_detached(
    signingString,
    sodium.from_base64(privateKey, _sodium.base64_variants.ORIGINAL)
  );
  const signature = sodium.to_base64(
    signedMessage,
    _sodium.base64_variants.ORIGINAL
  );
  return signature;
}