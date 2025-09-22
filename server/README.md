# ONDC Search API Server

This is a Node.js server implementation for the ONDC (Open Network for Digital Commerce) Search API, designed to handle search requests in compliance with ONDC specifications.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Running the Server](#running-the-server)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Security Considerations](#security-considerations)

## Features
- ONDC-compliant Search API implementation
- Request validation according to ONDC specifications
- Authorization header generation using ONDC crypto SDK
- Rate limiting to protect against abuse
- Environment-specific configurations
- CORS support with production security measures
- Detailed error handling and logging

## Prerequisites
- Node.js 14.x or higher
- npm 6.x or higher
- ONDC credentials (subscriber ID, private keys, etc.)

## Installation

1. Clone the repository and navigate to the server directory:
   ```bash
   cd /path/to/ondc/server
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Create a `.env` file by copying the example file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual ONDC credentials and configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Security Configuration
   ALLOWED_ORIGIN='*' # Restrict to specific domains in production
   
   # ONDC Credentials
   ENCRYPTION_PRIVATE_KEY=your_encryption_private_key_here
   ONDC_PUBLIC_KEY=your_ondc_public_key_here
   SIGNING_PRIVATE_KEY=your_signing_private_key_here
   SEARCH_PRIVATE_KEY=your_search_api_private_key_here
   
   # ONDC Identification
   ONDC_SUBSCRIBER_ID=your_ondc_subscriber_id_here
   ONDC_SUBSCRIBER_KEY_ID=your_ondc_subscriber_key_id_here
   ```

> **Important**: Never commit the `.env` file to version control.

## API Endpoints

### POST /search
Handles incoming search requests and generates the necessary authorization headers.

**Request Body**: ONDC-compliant search request JSON
**Response**: JSON object with status and authorization header

Example request body structure:
```json
{
  "context": {
    "domain": "ONDC:RET11",
    "action": "search",
    "country": "IND",
    "city": "std:080",
    "core_version": "1.2.0",
    "bap_id": "your_bap_id",
    "bap_uri": "https://your-bap-endpoint.com",
    "bpp_id": "target_bpp_id",
    "transaction_id": "unique_transaction_id",
    "message_id": "unique_message_id",
    "timestamp": "2023-08-25T10:00:00Z",
    "ttl": "PT30M"
  },
  "message": {
    "intent": {
      "fulfillment": {
        "type": "Delivery",
        "end": {
          "location": {
            "gps": "12.9715987,77.5945627"
          }
        }
      }
    }
  }
}
```

### POST /generate-search
Generates a sample ONDC search request with the appropriate authorization header.

**Request Body**: (Optional) Custom parameters for the search request
**Response**: JSON object with the generated search request and authorization header

### GET /health
Simple health check endpoint to verify the server is running.

**Response**: `Health OK!!`

### GET /ondc-site-verification.html
Serves the ONDC site verification page required for ONDC registration.

## Running the Server

### Development Mode
```bash
npm run dev
```

This starts the server in development mode with detailed logging and less strict security measures.

### Production Mode
```bash
npm start
```

This starts the server in production mode with reduced logging, stricter security measures, and rate limiting.

## Testing

A test script is provided to verify the /search API endpoint works correctly:

1. Ensure the server is running
2. Execute the test script:
   ```bash
   node test-search-api.js
   ```

## Production Deployment

When deploying to production, follow these best practices:

1. Set `NODE_ENV=production` in your environment variables
2. Configure proper values for all ONDC credentials in the `.env` file
3. Restrict CORS access by setting `ALLOWED_ORIGIN` to specific domains
4. Ensure the server runs behind a reverse proxy like Nginx for additional security
5. Implement HTTPS for secure communication
6. Regularly update dependencies
7. Monitor server performance and logs

## Security Considerations

- Never expose your private keys in code or version control
- Use environment variables for all sensitive information
- In production, restrict CORS access to trusted domains
- Implement rate limiting to protect against abuse
- Consider using a secure key management system for storing credentials
- Regularly audit and update your security configurations

## License
ISC