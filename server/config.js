module.exports = {
  bpp: {
    id: process.env.BPP_ID || 'staging.99digicom.com',
    uri: process.env.BPP_URI || 'https://staging.99digicom.com'
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10)
  }
};


