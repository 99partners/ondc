# ONDC Seller Search Service

This project implements an ONDC (Open Network for Digital Commerce) Seller Search Service that handles search requests from buyers according to ONDC specifications.

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node Package Manager)

### Installation

1. Clone the repository
2. Install dependencies

```bash
npm install
```

## Project Structure

- `main-server.js` - Main server implementation with Express
- `utils/schema-validator.js` - Schema validation utilities
- `schemas/search-schema.js` - JSON schema definition for search requests
- `test-schema-validation.js` - Schema validation test cases
- `test-main-server.js` - Server integration tests
- `test-search-with-context.js` - Context-specific search tests
- `test-search.js` - Basic search tests

## Schema Validation

The server includes comprehensive JSON schema validation for ONDC search request messages. This validation ensures that all incoming requests adhere to the required structure and format.

### Validation Coverage
- Message structure validation (presence of context and message fields)
- Intent validation (required fields and data types)
- Tags validation (with specific requirements based on tag codes)
- Timestamp format validation (RFC 3339)
- Payload type validation for specific tags

### Schema Definition
The schema is defined in `schemas/search-schema.js` and includes detailed validation rules for:
- `intent` - The search intent structure
- `payment` - Payment details structure
- `tags` - List of tags with conditional validation based on `code` values

### Validation Logic
The validation utility functions are implemented in `utils/schema-validator.js` and include:
- `isValidRFC3339` - Validates timestamp format
- `validateTagItem` - Validates individual tag items
- `validateTag` - Validates a list of tags
- `validateSearchIntent` - Validates the search message intent
- `validateSearchMessage` - Validates the entire search message

## Server Implementation

The ONDC seller search service is implemented in `main-server.js`, which provides a lightweight Express server that handles search requests according to ONDC specifications.

### Key Features
- Health check endpoint at `/health`
- Search endpoint at `/search` that immediately returns an ACK when a valid payload is received
- Comprehensive error handling with appropriate NACK responses
- Detailed request logging

### Search Endpoint Behavior
The `/search` endpoint follows these rules:
- Returns an ACK response with status 200 when a valid payload is received
- Returns a NACK response with appropriate error code and message when validation fails for:
  - Empty request payload
  - Missing context
  - Missing BAP URI in context
  - Missing message
- Returns appropriate error responses for server errors

## Testing the Service

### Schema Validation Tests
To run schema validation tests:

```bash
npm run test-schema
```

This will execute `test-schema-validation.js` which includes test cases for:
- Valid search message
- Missing intent
- Invalid tag code
- Invalid timestamp format
- Invalid payload type

### Server Integration Tests
To run tests against the main server implementation:

```bash
npm run test-main-server
```

This will execute `test-main-server.js` which includes tests for:
- Health check endpoint
- Valid search payload with authorization
- Missing context validation
- Missing message validation

### Context-specific Tests
To run tests with specific context configurations:

```bash
npm run test-context
```

## Starting the Server

To start the server in development mode:

```bash
npm start
```

To start the server in staging mode:

```bash
npm run start:staging
```

The server will run on port 3000 by default and will log incoming requests and validation results. It will immediately respond with ACK when a valid payload is received, or NACK with error details otherwise.

## API Endpoints

### Health Check
- **URL**: `/health`
- **Method**: `GET`
- **Description**: Checks if the server is running
- **Response**: `{ "status": "UP" }` with status code 200

### Search
- **URL**: `/search`
- **Method**: `POST`
- **Description**: Accepts ONDC search requests with proper validation
- **Request Format**: JSON payload with `context` and `message` fields
- **Response**: ACK/NACK message based on validation results
- **Valid Response**: `{ "message": { "ack": { "status": "ACK" } } }` with status code 200
- **Error Response**: `{ "message": { "ack": { "status": "NACK", "error": { ... } } } }` with appropriate status code