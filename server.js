// const express = require('express');
// const { isSignatureValid } = require('ondc-crypto-sdk-nodejs');
// const { config } = require('./config');

// const app = express();

// // Middleware to parse JSON requests
// app.use(express.json());

// // Public key from configuration (in real-world use registry or seller config)
// const buyerPublicKey = config.buyerPublicKey;

// // Helper function to extract and parse the authorization header
// function parseAuthorizationHeader(authHeader) {
//   if (!authHeader) {
//     return null;
//   }
  
//   // Authorization header format: 'Signature keyId="",algorithm="",headers="",signature=""'
//   const parts = authHeader.split(',');
//   const parsed = {};
  
//   parts.forEach(part => {
//     const [key, value] = part.split('=').map(item => item.trim());
//     if (key && value) {
//       // Remove quotes from value
//       parsed[key.toLowerCase()] = value.replace(/"/g, '');
//     }
//   });
  
//   return parsed;
// }

// // Helper function to verify the authorization header
// async function verifyAuthorizationHeader(authHeader, requestBody) {
//   try {
//     // Parse the authorization header
//     const parsedHeader = parseAuthorizationHeader(authHeader);
    
//     if (!parsedHeader) {
//       return { valid: false, reason: 'Invalid authorization header format' };
//     }
    
//     // Extract required fields from the parsed header
//     const { keyid, algorithm, headers, signature } = parsedHeader;
    
//     if (!keyid || !algorithm || !headers || !signature) {
//       return { valid: false, reason: 'Missing required fields in authorization header' };
//     }
    
//     // Verify the signature using the ONDC Crypto SDK
//     const isValid = await isSignatureValid(
//       requestBody,           // The request body as string
//       signature,             // The signature from the header
//       buyerPublicKey,        // Public key of the sender
//       algorithm,             // The signing algorithm used
//       headers                // The headers included in the signature
//     );
    
//     if (!isValid) {
//       return { valid: false, reason: 'Invalid signature' };
//     }
    
//     return { valid: true };
//   } catch (error) {
//     console.error('Error verifying authorization header:', error);
//     return { valid: false, reason: 'Error verifying authorization header: ' + error.message };
//   }
// }

// // Helper function to validate the request payload
// function validateRequestPayload(payload) {
//   // Check if payload is present
//   if (!payload) {
//     return { valid: false, reason: 'Empty payload' };
//   }
  
//   // Check if context is present
//   if (!payload.context) {
//     return { valid: false, reason: 'Context is required in the request payload' };
//   }
  
//   // Check if BAP URI is present in context
//   if (!payload.context.bap_uri) {
//     return { valid: false, reason: 'BAP URI is required in the context' };
//   }
  
//   // Check if message is present
//   if (!payload.message) {
//     return { valid: false, reason: 'Message is required in the request payload' };
//   }
  
//   return { valid: true };
// }

// // Search endpoint implementation
// app.post('/search', async (req, res) => {
//   try {
//     // Extract the authorization header
//     const authHeader = req.headers.authorization;
    
//     // Convert the request body to a string for signature verification
//     const requestBodyStr = JSON.stringify(req.body);
    
//     // Validate the request payload
//     const payloadValidation = validateRequestPayload(req.body);
    
//     if (!payloadValidation.valid) {
//       // If payload is invalid, return NACK with error details
//       return res.status(400).json({
//         message: {
//           ack: {
//             status: 'NACK',
//             error: {
//               type: 'CORE_ERROR',
//               code: '3001',
//               message: payloadValidation.reason
//             }
//           }
//         }
//       });
//     }
    
//     // If authorization header is present, verify it
//     if (authHeader) {
//       const authVerification = await verifyAuthorizationHeader(authHeader, requestBodyStr);
      
//       if (!authVerification.valid) {
//         // If authorization header is invalid, return NACK with error details
//         return res.status(401).json({
//           message: {
//             ack: {
//               status: 'NACK',
//               error: {
//                 type: 'SECURITY_ERROR',
//                 code: '4001',
//                 message: authVerification.reason
//               }
//             }
//           }
//         });
//       }
//     }
    
//     // If everything is valid, return ACK
//     res.status(200).json({
//       message: {
//         ack: {
//           status: 'ACK'
//         }
//       }
//     });
    
//     // In a real implementation, you would process the search request here
//     // This could involve querying your product catalog, filtering results, etc.
//     // For now, we'll just log that the search request was received
//     console.log('Received search request:', req.body);
    
//   } catch (error) {
//     console.error('Error processing search request:', error);
    
//     // Return NACK for any internal errors
//     res.status(500).json({
//       message: {
//         ack: {
//           status: 'NACK',
//           error: {
//             type: 'SYSTEM_ERROR',
//             code: '5001',
//             message: 'Internal server error'
//           }
//         }
//       }
//     });
//   }
// });

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({ status: 'UP', message: 'ONDC Seller Search Service is running' });
// });

// // Start the server
// app.listen(config.port, () => {
//   console.log(`ONDC Seller Search Service (${config.environment}) is running on port ${config.port}`);
//   console.log(`Health check available at http://${config.hostname}:${config.port}/health`);
//   console.log(`Search endpoint available at http://${config.hostname}:${config.port}/search`);
//   console.log(`Log level: ${config.logLevel}`);
// });


const express = require('express');
const { isSignatureValid } = require('ondc-crypto-sdk-nodejs');
const { config } = require('./config');

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Public key from configuration
const buyerPublicKey = config.buyerPublicKey;

// ---------------- Helper functions ----------------

// Parse the Authorization header
function parseAuthorizationHeader(authHeader) {
  if (!authHeader) return null;

  // Example format: 'Signature keyId="",algorithm="",headers="",signature=""'
  const parts = authHeader.split(',');
  const parsed = {};

  parts.forEach(part => {
    const [key, value] = part.split('=').map(item => item.trim());
    if (key && value) {
      parsed[key.toLowerCase()] = value.replace(/"/g, '');
    }
  });

  return parsed;
}

// Verify the authorization header
async function verifyAuthorizationHeader(authHeader, requestBody) {
  try {
    const parsedHeader = parseAuthorizationHeader(authHeader);

    if (!parsedHeader) {
      return { valid: false, reason: 'Invalid authorization header format' };
    }

    const { keyid, algorithm, headers, signature } = parsedHeader;

    if (!keyid || !algorithm || !headers || !signature) {
      return { valid: false, reason: 'Missing required fields in authorization header' };
    }

    const isValid = await isSignatureValid(
      requestBody,      // The request body as string
      signature,        // Signature from the header
      buyerPublicKey,   // Public key of the sender
      algorithm,        // Algorithm used
      headers           // Headers included in the signature
    );

    if (!isValid) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error verifying authorization header:', error);
    return { valid: false, reason: 'Error verifying authorization header: ' + error.message };
  }
}

// Validate the request payload
function validateRequestPayload(payload) {
  if (!payload) {
    return { valid: false, reason: 'Empty payload' };
  }

  if (!payload.context) {
    return { valid: false, reason: 'Context is required in the request payload' };
  }

  if (!payload.context.bap_uri) {
    return { valid: false, reason: 'BAP URI is required in the context' };
  }

  if (!payload.message) {
    return { valid: false, reason: 'Message is required in the request payload' };
  }

  return { valid: true };
}

// ---------------- Routes ----------------

// Search endpoint
app.post('/search', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const requestBodyStr = JSON.stringify(req.body);

    const payloadValidation = validateRequestPayload(req.body);

    if (!payloadValidation.valid) {
      return res.status(400).json({
        message: {
          ack: {
            status: 'NACK',
            error: {
              type: 'CORE_ERROR',
              code: '3001',
              message: payloadValidation.reason
            }
          }
        }
      });
    }

    if (authHeader) {
      const authVerification = await verifyAuthorizationHeader(authHeader, requestBodyStr);

      if (!authVerification.valid) {
        return res.status(401).json({
          message: {
            ack: {
              status: 'NACK',
              error: {
                type: 'SECURITY_ERROR',
                code: '4001',
                message: authVerification.reason
              }
            }
          }
        });
      }
    }

    // Everything is valid -> ACK
    res.status(200).json({
      message: {
        ack: {
          status: 'ACK'
        }
      }
    });

    console.log('Received search request:', req.body);
  } catch (error) {
    console.error('Error processing search request:', error);

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
  res.status(200).json({ status: 'UP', message: 'ONDC Seller Search Service is running' });
});

// ---------------- Catch-all route (404) ----------------
app.use((req, res) => {
  res.status(404).json({
    message: {
      ack: {
        status: 'NACK',
        error: {
          type: 'CORE_ERROR',
          code: '404',
          message: 'Endpoint not found'
        }
      }
    }
  });
});

// ---------------- Start server ----------------
app.listen(config.port, () => {
  console.log(`ONDC Seller Search Service (${config.environment}) is running on port ${config.port}`);
  console.log(`Health check available at http://${config.hostname}:${config.port}/health`);
  console.log(`Search endpoint available at http://${config.hostname}:${config.port}/search`);
  console.log(`Log level: ${config.logLevel}`);
});



// const express = require('express');
// const { isSignatureValid } = require('ondc-crypto-sdk-nodejs');
// const { config } = require('./config');

// const app = express();

// // Middleware to parse JSON requests
// app.use(express.json());

// // Public key from configuration
// const buyerPublicKey = config.buyerPublicKey;

// // Helper function to extract and parse the authorization header
// function parseAuthorizationHeader(authHeader) {
//   if (!authHeader) {
//     return null;
//   }
  
//   const parts = authHeader.split(',');
//   const parsed = {};
  
//   parts.forEach(part => {
//     const [key, value] = part.split('=').map(item => item.trim());
//     if (key && value) {
//       parsed[key.toLowerCase()] = value.replace(/"/g, '');
//     }
//   });
  
//   return parsed;
// }

// // Helper function to verify the authorization header
// async function verifyAuthorizationHeader(authHeader, requestBody) {
//   try {
//     const parsedHeader = parseAuthorizationHeader(authHeader);
    
//     if (!parsedHeader) {
//       return { valid: false, reason: 'Invalid authorization header format' };
//     }
    
//     const { keyid, algorithm, headers, signature } = parsedHeader;
    
//     if (!keyid || !algorithm || !headers || !signature) {
//       return { valid: false, reason: 'Missing required fields in authorization header' };
//     }
    
//     const isValid = await isSignatureValid(
//       requestBody,
//       signature,
//       buyerPublicKey,
//       algorithm,
//       headers
//     );
    
//     if (!isValid) {
//       return { valid: false, reason: 'Invalid signature' };
//     }
    
//     return { valid: true };
//   } catch (error) {
//     console.error('Error verifying authorization header:', error);
//     return { valid: false, reason: 'Error verifying authorization header: ' + error.message };
//   }
// }

// // Helper function to validate the request payload
// function validateRequestPayload(payload) {
//   if (!payload) {
//     return { valid: false, reason: 'Empty payload' };
//   }
  
//   if (!payload.context) {
//     return { valid: false, reason: 'Context is required in the request payload' };
//   }
  
//   if (!payload.context.bap_uri) {
//     return { valid: false, reason: 'BAP URI is required in the context' };
//   }
  
//   if (!payload.message) {
//     return { valid: false, reason: 'Message is required in the request payload' };
//   }
  
//   return { valid: true };
// }

// // Root endpoint
// app.get('/', (req, res) => {
//   res.status(200).json({
//     message: 'ONDC Seller Server is running',
//     service: 'ONDC Search Service',
//     version: '1.0.0',
//     endpoints: {
//       root: 'GET /',
//       health: 'GET /health',
//       search: 'POST /search'
//     },
//     status: 'operational',
//     timestamp: new Date().toISOString()
//   });
// });

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({ 
//     status: 'UP', 
//     message: 'ONDC Seller Search Service is running',
//     timestamp: new Date().toISOString()
//   });
// });

// // Search endpoint implementation
// app.post('/search', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
//     const requestBodyStr = JSON.stringify(req.body);
    
//     const payloadValidation = validateRequestPayload(req.body);
    
//     if (!payloadValidation.valid) {
//       return res.status(400).json({
//         message: {
//           ack: {
//             status: 'NACK',
//             error: {
//               type: 'CORE_ERROR',
//               code: '3001',
//               message: payloadValidation.reason
//             }
//           }
//         }
//       });
//     }
    
//     if (authHeader) {
//       const authVerification = await verifyAuthorizationHeader(authHeader, requestBodyStr);
      
//       if (!authVerification.valid) {
//         return res.status(401).json({
//           message: {
//             ack: {
//               status: 'NACK',
//               error: {
//                 type: 'SECURITY_ERROR',
//                 code: '4001',
//                 message: authVerification.reason
//               }
//             }
//           }
//         });
//       }
//     }
    
//     res.status(200).json({
//       message: {
//         ack: {
//           status: 'ACK'
//         }
//       }
//     });
    
//     console.log('Received search request from buyer app:', {
//       context_id: req.body.context?.transaction_id,
//       bap_id: req.body.context?.bap_id,
//       bap_uri: req.body.context?.bap_uri,
//       timestamp: new Date().toISOString()
//     });
    
//   } catch (error) {
//     console.error('Error processing search request:', error);
    
//     res.status(500).json({
//       message: {
//         ack: {
//           status: 'NACK',
//           error: {
//             type: 'SYSTEM_ERROR',
//             code: '5001',
//             message: 'Internal server error'
//           }
//         }
//       }
//     });
//   }
// });

// // 404 Handler - SIMPLIFIED (No wildcard pattern)
// app.use((req, res) => {
//   res.status(404).json({
//     error: 'Endpoint not found',
//     message: `The requested endpoint ${req.originalUrl} does not exist`,
//     available_endpoints: ['GET /', 'GET /health', 'POST /search']
//   });
// });

// // Start the server
// const PORT = config.port || 3000;
// const HOSTNAME = config.hostname || 'localhost';

// app.listen(PORT, HOSTNAME, () => {
//   console.log(`ONDC Seller Search Service (${config.environment}) is running on port ${PORT}`);
//   console.log(`Server URL: http://${HOSTNAME}:${PORT}`);
//   console.log(`Health check available at http://${HOSTNAME}:${PORT}/health`);
//   console.log(`Search endpoint available at http://${HOSTNAME}:${PORT}/search`);
//   console.log(`Log level: ${config.logLevel}`);
// });

// module.exports = app;