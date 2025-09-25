# ONDC Seller BPP (Express.js)

Simple BPP service for ONDC Retail domain with a POST /search endpoint.

## Configuration

See `server/config.js` (env overrides supported):
- BPP_ID (default: staging.99digicom.com)
- BPP_URI (default: https://staging.99digicom.com)
- PORT (default: 3000)
- MONGODB_URI / NODE_ENV

## Run

```bash
npm install
node server/index.js
```

### Local (development)

```bash
cp server/.env.example server/.env   # adjust if needed
NODE_ENV=development node server/index.js
```

### Live (production)

```bash
export NODE_ENV=production
export MONGODB_URI="<your_atlas_uri>"
export CORS_ORIGINS="https://staging.99digicom.com"
node server/index.js
```

## Example cURL

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "domain": "nic2004:52110",
      "country": "IND",
      "city": "std:080",
      "action": "search",
      "core_version": "1.2.0",
      "bap_id": "buyer.app.example",
      "bap_uri": "https://buyer.example.com/on_search",
      "transaction_id": "tx-12345",
      "message_id": "msg-12345",
      "timestamp": "2025-09-25T10:00:00Z"
    },
    "message": { "intent": { "item": { "descriptor": { "name": "laptop" } } } }
  }'
```

## Integration checklist

- Expose POST /search on your public domain (e.g., staging.99digicom.com)
- Validate context: action=search, bap_id, bap_uri
- (Placeholder) Verify ED25519 signatures
- Map intent to catalog and respond with on_search
- Persist incoming payloads for audit (enabled)
- Monitor `/health` and `/debug/db-status`


