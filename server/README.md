# ONDC Seller BPP (Buyer Platform Provider)

This is a complete implementation of the ONDC (Open Network for Digital Commerce) protocol for a Seller BPP (Buyer Platform Provider) following the official ONDC API contract and transaction trail requirements.

## Features

### ONDC Protocol Compliance
- **Context + Message Structure**: All APIs follow the ONDC standard with proper context and message structure
- **Asynchronous API Flow**: Request → ACK/NACK → Callback → ACK/NACK pattern
- **Transaction Trail**: Complete tracking of all API interactions with transaction_id + message_id correlation
- **Error Handling**: ONDC standard error codes and proper NACK responses
- **Stale Request Detection**: Timestamp validation to prevent processing of stale requests

### API Endpoints

#### Core ONDC APIs
- `POST /search` - Receive search requests from buyer apps
- `POST /on_search` - Send search responses to buyer apps
- `POST /select` - Receive item selection from buyer apps
- `POST /init` - Receive order initialization from buyer apps
- `POST /confirm` - Receive order confirmation from buyer apps

#### Debug Endpoints
- `GET /health` - Health check endpoint
- `GET /debug/transactions` - View all transaction trails
- `GET /debug/transactions/:transactionId` - View specific transaction trail

### Database Models

#### TransactionTrail
Tracks all API interactions with the following fields:
- `transaction_id` - Unique transaction identifier
- `message_id` - Unique message identifier
- `action` - API action (search, on_search, select, init, confirm)
- `direction` - incoming/outgoing
- `status` - ACK/NACK
- `context` - Full ONDC context object
- `message` - Full ONDC message object
- `error` - Error details if NACK
- `timestamp` - Request timestamp
- `bap_id`, `bap_uri` - Buyer app details
- `bpp_id`, `bpp_uri` - BPP details
- `domain`, `country`, `city` - Location details
- `core_version` - ONDC core version
- `ttl`, `key`, `encryption`, `signature` - Security fields

#### SearchData
Stores search requests with:
- `transaction_id` - Transaction identifier
- `message_id` - Message identifier
- `context` - Full context object
- `message` - Full message object
- `intent` - Search intent details

### ONDC Error Codes

The implementation includes comprehensive ONDC standard error codes:
- `10001-10050` - Context and signature validation errors
- `20002` - Stale request error (buyer NP)
- `30022` - Stale request error (seller NP)

### Transaction Trail Features

1. **Unique Transaction ID**: Maintained for pre-order stage (search, select, init, confirm)
2. **Message Correlation**: Each request/response pair identified by transaction_id + message_id
3. **Timestamp Validation**: Prevents processing of stale requests
4. **Complete Audit Trail**: All API interactions stored with full context and message data
5. **Error Tracking**: All NACK responses logged with specific error codes

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/ondc_seller

# BPP Configuration
BPP_ID=staging.99digicom.com
BPP_URI=https://staging.99digicom.com

# Server
PORT=3000
NODE_ENV=development

# CORS (optional)
CORS_ORIGINS=https://buyer-app.com,https://another-app.com
```

## Usage

### Start the server
```bash
npm start
# or for development
npm run dev
```

### Test the APIs
```bash
node test-api.js
```

## API Examples

### Search Request
```json
POST /search
{
  "context": {
    "domain": "nic2004:52110",
    "country": "IND",
    "city": "std:080",
    "action": "search",
    "core_version": "1.2.0",
    "bap_id": "buyer-app.com",
    "bap_uri": "https://buyer-app.com",
    "bpp_id": "staging.99digicom.com",
    "bpp_uri": "https://staging.99digicom.com",
    "transaction_id": "txn_1234567890",
    "message_id": "msg_1234567890",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "ttl": "PT30S",
    "key": "test-key",
    "encryption": "test-encryption",
    "signature": "test-signature"
  },
  "message": {
    "intent": {
      "item": {
        "descriptor": {
          "name": "Laptop"
        }
      },
      "category": {
        "id": "Electronics",
        "descriptor": {
          "name": "Electronics"
        }
      }
    }
  }
}
```

### Search Response (ACK)
```json
{
  "message": {
    "ack": {
      "status": "ACK"
    }
  }
}
```

### Search Response (NACK)
```json
{
  "message": {
    "ack": {
      "status": "NACK"
    }
  },
  "error": {
    "type": "CONTEXT-ERROR",
    "code": "10001",
    "message": "Context validation failed: domain is required"
  }
}
```

## Transaction Trail Example

```json
{
  "transaction_id": "txn_1234567890",
  "message_id": "msg_1234567890",
  "action": "search",
  "direction": "incoming",
  "status": "ACK",
  "context": { /* full context object */ },
  "message": { /* full message object */ },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "bap_id": "buyer-app.com",
  "bap_uri": "https://buyer-app.com",
  "bpp_id": "staging.99digicom.com",
  "bpp_uri": "https://staging.99digicom.com",
  "domain": "nic2004:52110",
  "country": "IND",
  "city": "std:080",
  "core_version": "1.2.0",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

## Development

### Project Structure
```
server/
├── index.js              # Main server file with all ONDC APIs
├── test-api.js           # API testing script
├── package.json          # Dependencies and scripts
├── README.md             # This documentation
└── fallback_store/       # Fallback storage directory
```

### Key Features Implemented

1. **ONDC Contract Compliance**: All APIs follow the exact ONDC specification
2. **Transaction Trail**: Complete audit trail of all API interactions
3. **Error Handling**: Comprehensive ONDC error codes and validation
4. **Database Storage**: MongoDB integration with proper indexing
5. **Async Processing**: Proper ACK/NACK response pattern
6. **Security**: Timestamp validation and stale request detection
7. **Debugging**: Debug endpoints for transaction trail inspection

## License

This project is licensed under the MIT License.