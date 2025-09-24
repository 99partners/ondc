# ONDC Seller Search Service

This service implements the ONDC (Open Network for Digital Commerce) seller search functionality.

## Features
- Request validation for ONDC search requests
- Authorization header verification
- Support for multiple environments (development and staging)

## Getting Started

### Prerequisites
- Node.js (v14 or higher recommended)
- npm

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies

```bash
npm install
```

### Running the Service

#### Localhost (Development Environment)
To run the service in the development environment (localhost):

```bash
npm start
```

This will start the service on port 3000 with localhost as the hostname.

#### Staging Environment
To run the service in the staging environment (staging.99digicom.com):

```bash
npm run start:staging
```

This will start the service with the staging configuration, using staging.99digicom.com as the hostname.

## Environment Configuration

The service uses environment-specific configuration defined in `config.js`:

### Development (localhost)
- Port: 3000 (can be overridden with PORT environment variable)
- Hostname: localhost
- Environment: development
- Log Level: debug
- Buyer Public Key: Default mock key (can be overridden with BUYER_PUBLIC_KEY environment variable)

### Staging (staging.99digicom.com)
- Port: (uses PORT environment variable or defaults to 3000)
- Hostname: staging.99digicom.com
- Environment: staging
- Log Level: info
- Buyer Public Key: Default mock key (can be overridden with BUYER_PUBLIC_KEY environment variable)

### Environment Variables
You can override certain configuration values using environment variables:
- `NODE_ENV`: Set to 'development' or 'staging' to switch environments
- `PORT`: Override the port number
- `BUYER_PUBLIC_KEY`: Override the buyer public key

## API Endpoints

### Health Check
```
GET /health
```
Returns the current status of the service.

### Search
```
POST /search
```
Accepts ONDC search requests with proper validation and authorization.

### Testing the Service

To test the ONDC Seller Search Service, you can use the provided test scripts:

1. **General Tests**: The `test-search.js` script sends various test cases to the service and validates the responses.

```bash
npm run test
```

2. **Custom Context Structure Test**: The `test-search-with-context.js` script demonstrates how to send requests with the specific context structure provided for the buyer application.

```bash
node test-search-with-context.js
```

This script uses the exact context and message structure specified, including:
- Domain: ONDC:RET10
- Action: search
- Country: IND
- City: std:080
- Core version: 1.2.0
- Buyer information: buyerNP.com
- Transaction details
- Payment information
- Tags including catalog_full and bap_terms

## Notes
- In a production environment, you would want to fetch public keys from the ONDC registry instead of using hardcoded values.
- Always keep your configuration secure, especially in production environments.