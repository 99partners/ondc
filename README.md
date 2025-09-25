# ONDC Seller Search API

A Node.js implementation of the ONDC (Open Network for Digital Commerce) Seller Search API for staging.99digicom.com.

## Overview

This API implements the ONDC protocol's search functionality, allowing buyer applications to search for products and services offered by the seller.

## Features

- ✅ ONDC Protocol v2.0.1 compliant
- ✅ Product search with filtering
- ✅ Category-based search
- ✅ Price range filtering
- ✅ Health check endpoints
- ✅ Error handling and validation
- ✅ CORS enabled for cross-origin requests
- ✅ Security headers with Helmet
- ✅ Request logging

## API Endpoints

### Core ONDC Endpoints

- `POST /protocol/v1/search` - Main search endpoint for buyer apps
- `POST /protocol/v1/on_search` - Callback endpoint for search acknowledgments

### Utility Endpoints

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information
- `GET /protocol/v1/stats` - Search statistics
- `POST /protocol/v1/test-search` - Test search endpoint (development)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ondc-seller-search-api
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp config.js.example config.js
# Edit config.js with your settings
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Configuration

The application uses `config.js` for configuration. Key settings include:

- **Domain**: staging.99digicom.com
- **ONDC Version**: 2.0.1
- **Seller ID**: 99digicom-seller
- **Port**: 3000 (configurable)

## ONDC Search Request Format

```json
{
  "context": {
    "domain": "ONDC:RET10",
    "country": "IND",
    "city": "std:080",
    "action": "search",
    "core_version": "2.0.1",
    "bap_id": "buyer-app-id",
    "bap_uri": "https://buyer-app.com",
    "bpp_id": "99digicom-seller",
    "bpp_uri": "https://staging.99digicom.com",
    "transaction_id": "unique-transaction-id",
    "message_id": "unique-message-id",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "ttl": "PT30S"
  },
  "message": {
    "intent": {
      "item": {
        "descriptor": {
          "name": "smartphone"
        }
      },
      "category": {
        "id": "electronics"
      },
      "fulfillment": {
        "start": {
          "location": {
            "address": {
              "city": "Bangalore"
            }
          }
        }
      }
    }
  }
}
```

## ONDC Search Response Format

```json
{
  "context": {
    "domain": "ONDC:RET10",
    "country": "IND",
    "city": "std:080",
    "action": "on_search",
    "core_version": "2.0.1",
    "bap_id": "buyer-app-id",
    "bap_uri": "https://buyer-app.com",
    "bpp_id": "99digicom-seller",
    "bpp_uri": "https://staging.99digicom.com",
    "transaction_id": "unique-transaction-id",
    "message_id": "unique-message-id",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "ttl": "PT30S"
  },
  "message": {
    "catalog": {
      "bpp/descriptor": {
        "name": "99DigiCom Seller",
        "code": "99digicom-seller"
      },
      "bpp/categories": [...],
      "bpp/providers": [
        {
          "id": "99digicom-seller",
          "items": [...],
          "fulfillments": [...],
          "locations": [...]
        }
      ]
    }
  }
}
```

## Testing

### Test Search Endpoint

```bash
curl -X POST https://staging.99digicom.com/protocol/v1/test-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "smartphone",
    "category": "electronics",
    "minPrice": 10000,
    "maxPrice": 50000
  }'
```

### Health Check

```bash
curl https://staging.99digicom.com/health
```

## Product Data

The API currently uses mock product data. To integrate with a real database:

1. Update `services/productService.js`
2. Replace mock data with database queries
3. Configure database connection in `config.js`

## Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start app.js --name ondc-seller-api
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Monitoring

- Health check endpoint: `/health`
- Detailed health: `/health/detailed`
- Search statistics: `/protocol/v1/stats`

## Security

- Helmet.js for security headers
- CORS configuration
- Request validation
- Error handling without sensitive data exposure

## Support

For issues and questions:
- Check the logs for error details
- Verify ONDC protocol compliance
- Test with the test-search endpoint first

## License

MIT License - see LICENSE file for details.
