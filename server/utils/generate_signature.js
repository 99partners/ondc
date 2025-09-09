const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

// Replace with your signing private key
const signingPrivateKeyBase64 = "T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg==";

// Replace with your request_id
const requestId = "99digicom-req-20250904-001";

// Decode private key from base64
const privateKey = util.decodeBase64(signingPrivateKeyBase64);

// Sign the requestId using Ed25519
const signature = nacl.sign.detached(util.decodeUTF8(requestId), privateKey);

// Convert signature to Base64
const signedUniqueReqId = util.encodeBase64(signature);

console.log("SIGNED_UNIQUE_REQ_ID:", signedUniqueReqId);
