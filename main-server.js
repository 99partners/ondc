// Import necessary modules
const express = require('express');

// Create Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Middleware for logging requests
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request payload:', JSON.stringify(req.body, null, 2));
  }
  next();
});

/**
 * Search endpoint
 * Returns ACK when valid payload is received, NACK with error otherwise
 */
app.post('/search', (req, res) => {
  try {
    // Check if request body exists
    if (!req.body) {
      console.log('Error: Empty request payload');
      return res.status(400).json({
        message: {
          ack: {
            status: 'NACK',
            error: {
              type: 'CORE_ERROR',
              code: '3000',
              message: 'Empty request payload'
            }
          }
        }
      });
    }
    
    // Check if context is present
    if (!req.body.context) {
      console.log('Error: Missing context in payload');
      return res.status(400).json({
        message: {
          ack: {
            status: 'NACK',
            error: {
              type: 'CORE_ERROR',
              code: '3001',
              message: 'Context is required in the request payload'
            }
          }
        }
      });
    }
    
    // Check if BAP URI is present in context
    if (!req.body.context.bap_uri) {
      console.log('Error: Missing BAP URI in context');
      return res.status(400).json({
        message: {
          ack: {
            status: 'NACK',
            error: {
              type: 'CORE_ERROR',
              code: '3002',
              message: 'BAP URI is required in the context'
            }
          }
        }
      });
    }
    
    // Check if message is present
    if (!req.body.message) {
      console.log('Error: Missing message in payload');
      return res.status(400).json({
        message: {
          ack: {
            status: 'NACK',
            error: {
              type: 'CORE_ERROR',
              code: '3003',
              message: 'Message is required in the request payload'
            }
          }
        }
      });
    }
    
    // Valid payload received - return ACK
    console.log('Success: Valid payload received');
    
    // Log transaction details for tracking
    const transactionId = req.body.context.transaction_id || 'unknown';
    const messageId = req.body.context.message_id || 'unknown';
    const bapId = req.body.context.bap_id || 'unknown';
    
    console.log(`Search request details:`);
    console.log(`- Transaction ID: ${transactionId}`);
    console.log(`- Message ID: ${messageId}`);
    console.log(`- BAP ID: ${bapId}`);
    console.log(`- BAP URI: ${req.body.context.bap_uri}`);
    
    // Return ACK response
    return res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });
    
  } catch (error) {
    console.error('Error processing search request:', error);
    
    // Return NACK response for internal errors
    return res.status(500).json({
      message: {
        ack: {
          status: 'NACK',
          error: {
            type: 'SYSTEM_ERROR',
            code: '5001',
            message: 'Internal server error'
          }
        }
      }
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'ONDC Seller Search Service is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'ONDC Seller Server',
    endpoints: {
      health: '/health',
      search: '/search'
    },
    documentation: 'For search requests, POST to /search with valid context and message in the payload'
  });
});

/**
 * 404 Not Found handler
 */
app.use((req, res) => {
  res.status(404).json({
    message: {
      ack: {
        status: 'NACK',
        error: {
          type: 'NOT_FOUND',
          code: '4004',
          message: `Endpoint not found: ${req.path}`
        }
      }
    }
  });
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: {
      ack: {
        status: 'NACK',
        error: {
          type: 'SYSTEM_ERROR',
          code: '5000',
          message: 'An unexpected error occurred'
        }
      }
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`ONDC Seller Search Service is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Search endpoint available at http://localhost:${PORT}/search`);
  console.log('Server will respond with ACK when valid payload is received, or NACK with error details otherwise');
});

module.exports = app;