const express = require('express');
const app = express();
const PORT = 3001; // Different port to avoid conflicts

// Middleware to parse JSON requests
app.use(express.json());

// Simple middleware to log all requests
app.use((req, res, next) => {
  console.log('------------------------------');
  console.log(`Received ${req.method} request to ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('------------------------------');
  next();
});

// Very simple search endpoint for debugging
app.post('/search', (req, res) => {
  try {
    // Log the request details
    console.log('Processing debug search request');
    
    // Check if context is present
    if (!req.body.context) {
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
    
    // Return a simple ACK response
    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });
    
  } catch (error) {
    console.error('Error in debug search endpoint:', error);
    res.status(500).json({
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Debug Server is running' });
});

// Start the debug server
app.listen(PORT, () => {
  console.log(`Debug Server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Debug search endpoint available at http://localhost:${PORT}/search`);
});