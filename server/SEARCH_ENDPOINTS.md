# Search Endpoints Guide

This server now has **2 separate search endpoints** to handle different types of requests.

## 1. Standard Search Endpoint

**File:** `routes/search.js`
**Endpoint:** `POST /search`

### Purpose
Handles standard ONDC search requests with full validation.

### Validation Rules
- **Required fields:** domain, country, city, action, core_version, bap_id, bap_uri, transaction_id, message_id, timestamp, ttl
- **Strict validation** - All required fields must be present

### When to use
- Production ONDC requests
- Standard buyer apps
- Full ONDC protocol compliance

### Example Request
```json
{
  "context": {
    "domain": "nic2004:52110",
    "country": "IND",
    "city": "std:080",
    "action": "search",
    "core_version": "1.2.0",
    "bap_id": "buyer-app.com",
    "bap_uri": "https://buyer-app.com",
    "transaction_id": "txn_123",
    "message_id": "msg_123",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "ttl": "PT30S"
  },
  "message": {
    "intent": {
      "item": {
        "descriptor": { "name": "Product" }
      }
    }
  }
}
```

### Debug
- View stored requests: `GET http://localhost:3000/search/debug`

---

## 2. Pramaan Mock Search Endpoint

**File:** `routes/search-pramaan.js`
**Endpoint:** `POST /search/pramaan`

### Purpose
Handles Pramaan beta mock platform requests with flexible validation.

### Validation Rules
- **Required fields:** domain, action, core_version, bap_id, bap_uri, transaction_id, message_id, timestamp
- **Optional fields (with warnings):** country, city, ttl
- **Flexible validation** - Missing optional fields are warned but not rejected

### When to use
- Pramaan.ondc.org/beta/preprod/mock/buyer requests
- Testing/development
- Mock buyer platforms that don't send all fields

### Example Request (Minimal)
```json
{
  "context": {
    "domain": "nic2004:52110",
    "action": "search",
    "core_version": "1.2.0",
    "bap_id": "pramaan.ondc.org/beta/preprod/mock/buyer",
    "bap_uri": "pramaan.ondc.org/beta/preprod/mock/Buyer",
    "transaction_id": "txn_123",
    "message_id": "msg_123",
    "timestamp": "2024-01-15T10:00:00.000Z"
  },
  "message": {
    "intent": {
      "item": {
        "descriptor": { "name": "Product" }
      }
    }
  }
}
```

### Debug
- View stored requests: `GET http://localhost:3000/search/pramaan/debug`

---

## Comparison

| Feature | Standard Search | Pramaan Mock Search |
|---------|----------------|---------------------|
| Endpoint | `/search` | `/search/pramaan` |
| country | Required | Optional (warned) |
| city | Required | Optional (warned) |
| ttl | Required | Optional (warned) |
| Validation | Strict | Flexible |
| Use Case | Production | Testing/Mock |

---

## Testing

### Test Standard Search
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d @test-standard-search.json
```

### Test Pramaan Search
```bash
curl -X POST http://localhost:3000/search/pramaan \
  -H "Content-Type: application/json" \
  -d @test-pramaan-search.json
```

---

## Storage

Both endpoints store data in the same MongoDB collections:
- **SearchData** - Stores search requests and intents
- **TransactionTrail** - Stores audit trail of all API calls

