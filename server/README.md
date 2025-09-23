# Seller App Search API

This project provides a simple API for storing and retrieving search data for a seller application. It allows incoming API data to be stored in a database and third-party services to request search data.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or accessible remotely)

## Setup Instructions

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Make sure MongoDB is running locally on port 27017 (or update the connection string in app.js)

5. Start the server:

```bash
# Production mode
npm start

# Development mode (with auto-restart on file changes)
npm run dev
```

The server will run on http://localhost:3000 by default.

## API Endpoints

### 1. Search API (POST /search)

This endpoint handles search requests from buyer apps (BAP - Buyer-App Platform) and sends responses to the BAP URI.

**Request Handling Process:**
1. Receives a POST request from buyer apps with a payload containing context
2. Extracts the context from the payload
3. Uses the context to construct the response payload
4. Saves the search request and results to the database
5. Sends the response payload to the BAP URI found in the context

**Request Body Format:**

```json
{
  "context": {
    "context_id": "unique-context-id",
    "bap_id": "bap-buyer-app",
    "bap_uri": "http://buyer-app.example.com",
    "timestamp": "2023-07-15T10:30:00Z",
    "action": "search",
    "message_id": "unique-message-id",
    "transaction_id": "unique-transaction-id",
    "domain": "nic2004:52110",
    "country": "IND",
    "city": "std:080",
    "core_version": "1.1.0",
    "bap_endpoint": "http://buyer-app.example.com/on_search"
  },
  "message": {
    "intent": {
      "item": {
        "descriptor": {
          "name": "laptop"
        }
      },
      "fulfillment": {
        "start": {
          "location": {
            "gps": "12.9716,77.5946"
          }
        }
      }
    }
  }
}
```

**Required Fields in Context:**
- `context_id`: Unique identifier for the context
- `bap_id`: Buyer App Platform ID
- `bap_uri`: Buyer App Platform URI (where the response will be sent)
- `timestamp`: ISO timestamp of the request
- `action`: The action being performed ("search")

**Response to Buyer App:**

The API sends a response to the BAP URI provided in the context with the following format:

```json
{
  "context": {
    // Same context from request with updated fields
    "context_id": "same-as-request",
    "bpp_id": "bpp-seller-app",
    "bpp_uri": "http://localhost:3000",
    "timestamp": "2023-07-15T10:30:10Z", // Current timestamp
    "action": "on_search", // Set to on_search
    // Other context fields from the original request
  },
  "message": {
    "catalog": {
      "bpp_providers": [
        {
          "id": "provider-1",
          "locations": [],
          "items": [
            // Products matching the search criteria
            {
              "id": "item-1",
              "descriptor": {
                "name": "Product 1",
                "description": "Description of Product 1",
                "images": ["https://example.com/image1.jpg"]
              },
              "price": {
                "currency": "INR",
                "value": "4999"
              },
              "quantity": {
                "available": {
                  "count": 100
                }
              }
            },
            // More items...
          ]
        }
      ]
    }
  }
}
```

**Immediate Response to the POST Request:**

```json
{
  "message": "Search request processed. Response sent to BAP.",
  "context_id": "same-as-request"
}
```

### 2. Retrieve Search Data (GET /search)

This endpoint allows retrieving search data that has been stored in the database.

**Query Parameters:**
- `query` (optional): Filter results by search query (case-insensitive)
- `source` (optional): Filter results by source ("buyer-app")
- `limit` (optional, default: 10): Number of results per page
- `page` (optional, default: 1): Page number

**Example Request:**

```
GET /search?query=laptop&source=buyer-app&limit=5&page=1
```

**Response:**

```json
{
  "total": 25,
  "pages": 5,
  "currentPage": 1,
  "data": [
    // Array of search data objects
  ]
}
```

## Project Structure

```
seller_App/
├── models/
│   └── searchData.js  # Mongoose schema for search data
├── app.js             # Main application file with server setup and API endpoints
├── package.json       # Project dependencies and scripts
└── README.md          # Project documentation
```

## Dependencies

- **Express.js**: Web framework for building the API
- **Mongoose**: MongoDB object modeling for Node.js
- **CORS**: Middleware for enabling Cross-Origin Resource Sharing
- **Axios**: HTTP client for sending requests to BAP URI

## Error Handling

The API includes basic error handling for common scenarios:
- Missing required fields in requests
- Database connection errors
- Server errors

Error responses will include a message and details about the error.