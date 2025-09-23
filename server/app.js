const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const SearchData = require('./models/searchData');

// Configuration for BPP (Buyer-Provider Platform)
const BPP_CONFIG = {
  id: 'staging.99digicom.com', // Unique BPP ID
  uri: 'https://staging.99digicom.com', // BPP URI
};

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Utility function to send response to BAP URI
const sendResponseToBAP = async (bapUri, payload) => {
  try {
    const response = await axios.post(bapUri, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Response sent to BAP successfully:', response.status);
    return response;
  } catch (error) {
    console.error('Error sending response to BAP:', error.message);
    throw error;
  }
};

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/sellerApp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Search API Endpoint - For Buyer Apps
app.post('/search', async (req, res) => {
  try {
    const requestBody = req.body;
    
    // Extract context from the payload
    const { context } = requestBody;
    
    if (!context) {
      return res.status(400).json({ message: 'Context is required in the request payload' });
    }
    
    // Extract BAP URI from context
    const bapUri = context.bap_uri;
    
    if (!bapUri) {
      return res.status(400).json({ message: 'BAP URI is required in the context' });
    }
    
    // Log the incoming request
    console.log('Received search request from buyer app:', {
      context_id: context.context_id,
      bap_id: context.bap_id,
      bap_uri: bap_uri
    });
    
    // Save the incoming search request to database
    const searchRequestData = {
      query: context.message?.intent?.item?.descriptor?.name || 'search request',
      filters: requestBody?.message?.intent || {},
      results: [], // Will be populated with actual results
      source: 'buyer-app'
    };
    
    const savedSearchData = await SearchData.create(searchRequestData);
    console.log('Search request saved to database');
    
    // Construct the response payload
    const responsePayload = {
      context: {
        ...context, // Include the same context from the request
        bpp_id: BPP_CONFIG.id,
        bpp_uri: BPP_CONFIG.uri,
        timestamp: new Date().toISOString(), // Current timestamp
        action: 'on_search' // Set action to on_search
      },
      message: {
        // Include relevant message data
        catalog: {
          bpp_providers: [
            {
              id: 'provider-1',
              locations: [],
              items: [
                // Example items - these would come from your product database
                {
                  id: 'item-1',
                  descriptor: {
                    name: 'Product 1',
                    description: 'Description of Product 1',
                    images: ['https://example.com/image1.jpg']
                  },
                  price: {
                    currency: 'INR',
                    value: '4999'
                  },
                  quantity: {
                    available: {
                      count: 100
                    }
                  }
                },
                {
                  id: 'item-2',
                  descriptor: {
                    name: 'Product 2',
                    description: 'Description of Product 2',
                    images: ['https://example.com/image2.jpg']
                  },
                  price: {
                    currency: 'INR',
                    value: '9999'
                  },
                  quantity: {
                    available: {
                      count: 50
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    };
    
    // Update the saved search data with results
    savedSearchData.results = responsePayload.message.catalog.bpp_providers[0].items;
    await savedSearchData.save();
    
    // Send the response payload to the BAP URI
    try {
      await sendResponseToBAP(bapUri, responsePayload);
      res.status(202).json({
        message: 'Search request processed. Response sent to BAP.',
        context_id: context.context_id
      });
    } catch (error) {
      res.status(202).json({
        message: 'Search request processed, but error sending response to BAP.',
        context_id: context.context_id,
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error processing search request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// API to retrieve search data (for third-party requests)
app.get('/search', async (req, res) => {
  try {
    const { query, source, limit = 10, page = 1 } = req.query;
    
    const queryOptions = {};
    
    if (query) {
      queryOptions.query = { $regex: query, $options: 'i' };
    }
    
    if (source) {
      queryOptions.source = source;
    }
    
    const skip = (page - 1) * limit;
    
    const searchResults = await SearchData
      .find(queryOptions)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await SearchData.countDocuments(queryOptions);
    
    res.json({
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: searchResults
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});