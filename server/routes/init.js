const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { validateContext, ensureSafeContext, createErrorResponse, createAckResponse } = require('../utils/contextValidator');

// BPP Configuration - These should be moved to a config file in a production environment
const BPP_ID = 'staging.99digicom.com';
const BPP_URI = 'https://staging.99digicom.com';

// Import models - These should be moved to separate model files in a production environment
const TransactionTrailSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  action: { type: String, required: true },
  direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
  status: { type: String, enum: ['ACK', 'NACK'], required: true },
  context: { type: Object, required: true },
  message: { type: Object },
  error: { type: Object },
  timestamp: { type: Date, required: true },
  bap_id: { type: String, index: true },
  bap_uri: { type: String },
  bpp_id: { type: String, index: true },
  bpp_uri: { type: String },
  domain: { type: String },
  country: { type: String },
  city: { type: String },
  core_version: { type: String },
  created_at: { type: Date, default: Date.now }
});

const InitDataSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true, index: true },
  message_id: { type: String, required: true, index: true },
  context: { type: Object, required: true },
  message: { type: Object, required: true },
  order: { type: Object },
  created_at: { type: Date, default: Date.now }
});

// Check if models are already registered to avoid OverwriteModelError
const TransactionTrail = mongoose.models.TransactionTrail || mongoose.model('TransactionTrail', TransactionTrailSchema);
const InitData = mongoose.models.InitData || mongoose.model('InitData', InitDataSchema);

// Utility functions are imported from ../utils/contextValidator

// Store transaction trail
async function storeTransactionTrail(data) {
  try {
    const trail = new TransactionTrail(data);
    await trail.save();
    console.log(`✅ Transaction trail stored: ${data.transaction_id}/${data.message_id} - ${data.action} - ${data.status}`);
  } catch (error) {
    console.error('❌ Failed to store transaction trail:', error);
  }
}

// Function to calculate quote details from order
function calculateQuote(order) {
  if (!order || !order.items) {
    return null;
  }

  // Calculate totals and item details
  let totalValue = 0;
  const breakup = order.items.map(item => {
    const price = item.price ? parseFloat(item.price.value) : 0;
    const quantity = item.quantity?.count || 1;
    const itemTotal = price * quantity;
    totalValue += itemTotal;
    
    return {
      "@ondc/org/item_id": item.id,
      "@ondc/org/item_quantity": {
        count: quantity
      },
      "@ondc/org/title_type": "ITEM",
      price: {
        currency: item.price?.currency || "INR",
        value: itemTotal.toString()
      },
      "@ondc/org/item_details": item
    };
  });

  return {
    price: {
      currency: "INR",
      value: totalValue.toString(),
      breakup: breakup
    },
    "@ondc/org/quote_ttl": "2025-12-31T23:59:59.000Z"
  };
}

// Function to send on_init callback to BAP
async function sendOnInitCallback(context, order) {
  try {
    // Generate new message_id for on_init
    const onInitMessageId = uuidv4();
    
    // Create on_init context
    const onInitContext = {
      domain: context.domain,
      country: context.country,
      city: context.city,
      action: "on_init",
      core_version: context.core_version,
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI,
      transaction_id: context.transaction_id,
      message_id: onInitMessageId,
      timestamp: new Date().toISOString(),
      ttl: "PT30S"
    };

    // Calculate quote
    const quote = calculateQuote(order);
    
    // Create on_init message
    const onInitMessage = {
      order: {
        provider: order.provider,
        items: order.items,
        billing: order.billing,
        fulfillments: order.fulfillments,
        payment: order.payment || {
          "@ondc/org/buyer_app_finder_fee_type": "percent",
          "@ondc/org/buyer_app_finder_fee_amount": "1"
        },
        quote: quote
      },
      tags: [
        {
          code: "initiation",
          list: [
            {
              code: "type",
              value: "buyer-initialized"
            }
          ]
        }
      ]
    };

    // Construct full on_init payload
    const onInitPayload = {
      context: onInitContext,
      message: onInitMessage
    };

    console.log('📤 Sending on_init callback to:', context.bap_uri);
    console.log('🔑 Message ID:', onInitMessageId);
    
    // Send POST request to BAP's callback URL
    const response = await axios.post(context.bap_uri, onInitPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ on_init callback sent successfully. Response status:', response.status);
    
    // Store transaction trail for outgoing on_init
    await storeTransactionTrail({
      transaction_id: context.transaction_id,
      message_id: onInitMessageId,
      action: 'on_init',
      direction: 'outgoing',
      status: 'ACK',
      context: onInitContext,
      message: onInitMessage,
      timestamp: new Date(),
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      bpp_id: BPP_ID,
      bpp_uri: BPP_URI,
      domain: context.domain,
      country: context.country,
      city: context.city,
      core_version: context.core_version
    });

    return { success: true, messageId: onInitMessageId };
  } catch (error) {
    console.error('❌ Failed to send on_init callback:', error.message);
    console.error('Error details:', error.response?.data || error.message);
    
    // Store transaction trail for failed on_init
    try {
      await storeTransactionTrail({
        transaction_id: context.transaction_id,
        message_id: onInitMessageId || 'unknown',
        action: 'on_init',
        direction: 'outgoing',
        status: 'NACK',
        context: onInitContext || {},
        message: onInitMessage || {},
        error: {
          type: 'NETWORK-ERROR',
          code: '50001',
          message: error.message
        },
        timestamp: new Date(),
        bap_id: context.bap_id,
        bap_uri: context.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI,
        domain: context.domain,
        country: context.country,
        city: context.city,
        core_version: context.core_version
      });
    } catch (trailError) {
      console.error('❌ Failed to store on_init trail:', trailError.message);
    }

    return { success: false, error: error.message };
  }
}

// /init API - Buyer app sends init request
router.post('/', async (req, res) => {
  try {
    // Safely extract payload with defaults if req.body is undefined
    const payload = req.body || {};
    
    // Store all incoming requests regardless of validation
    try {
      const initData = new InitData({
        requestBody: payload,
        timestamp: new Date()
      });
      await initData.save();
    } catch (storeError) {
      console.error('❌ Failed to store incoming init request:', storeError.message);
    }
    
    // Create a safe context object with default values for missing properties
    const safeContext = ensureSafeContext(payload?.context);
    const { message = payload.message || {} } = payload;
    
    // Basic validation
    if (!payload || !payload.context || !payload.message) {
      const errorResponse = createErrorResponse('10001', 'Invalid request structure');
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: 'init',
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI,
        domain: safeContext.domain,
        country: safeContext.country,
        city: safeContext.city,
        core_version: safeContext.core_version
      });
      return res.status(400).json(errorResponse);
    }
    
    // Validate context
    const contextErrors = validateContext(payload.context);
    if (contextErrors.length > 0) {
      const errorResponse = createErrorResponse('10001', `Context validation failed: ${contextErrors.join(', ')}`);
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: safeContext.action,
        direction: 'incoming',
        status: 'NACK',
        context: safeContext,
        error: errorResponse.error,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: safeContext.bpp_id || BPP_ID,
        bpp_uri: safeContext.bpp_uri || BPP_URI,
        domain: safeContext.domain,
        country: safeContext.country,
        city: safeContext.city,
        core_version: safeContext.core_version
      });
      return res.status(400).json(errorResponse);
    }

    // Store init data in MongoDB Atlas with retry mechanism
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const initData = new InitData({
          transaction_id: safeContext.transaction_id,
          message_id: safeContext.message_id,
          context: safeContext,
          message,
          order: message.order
        });
        await initData.save();
        console.log('✅ Init data saved to MongoDB Atlas database');
        console.log('📊 Saved init request for transaction:', safeContext.transaction_id);
        break; // Exit the loop if successful
      } catch (dbError) {
        retries++;
        console.error(`❌ Failed to save init data to MongoDB Atlas (Attempt ${retries}/${maxRetries}):`, dbError.message);
        
        if (retries >= maxRetries) {
          console.error('❌ Max retries reached. Could not save init data.');
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Store transaction trail in MongoDB Atlas - MANDATORY for audit
    try {
      await storeTransactionTrail({
        transaction_id: safeContext.transaction_id,
        message_id: safeContext.message_id,
        action: safeContext.action,
        direction: 'incoming',
        status: 'ACK',
        context: safeContext,
        message,
        timestamp: new Date(),
        bap_id: safeContext.bap_id,
        bap_uri: safeContext.bap_uri,
        bpp_id: safeContext.bpp_id || BPP_ID,
        bpp_uri: safeContext.bpp_uri || BPP_URI,
        domain: safeContext.domain,
        country: safeContext.country,
        city: safeContext.city,
        core_version: safeContext.core_version
      });
    } catch (trailError) {
      console.error('❌ Failed to store transaction trail:', trailError.message);
    }

    // Send ACK response with echoed context (align with search/select)
    const ackWithContext = { ...createAckResponse(), context: safeContext };
    console.log('✅ Sending ACK response for init request');
    res.status(202).json(ackWithContext);
    
    // Send on_init callback to BAP asynchronously (don't wait for it)
    if (message.order) {
      sendOnInitCallback(safeContext, message.order).then(result => {
        if (result.success) {
          console.log('✅ on_init callback completed successfully');
        } else {
          console.log('❌ on_init callback failed:', result.error);
        }
      }).catch(err => {
        console.error('❌ on_init callback error:', err.message);
      });
    }
    
  } catch (error) {
    console.error('❌ Error in /init:', error);
    const errorResponse = createErrorResponse('10002', `Internal server error: ${error.message}`);
    res.status(500).json(errorResponse);
  }
});

// Debug endpoint to view stored data
router.get('/debug', async (req, res) => {
  try {
    const initRequests = await InitData.find().sort({ created_at: -1 }).limit(50);
    
    // Process data to handle undefined context properties
    const safeRequests = initRequests.map(request => {
      const safeRequest = request.toObject();
      if (!safeRequest.context) {
        safeRequest.context = {};
      }
      
      // Ensure all required context properties exist to prevent 'undefined' errors
      const requiredProps = ['domain', 'action', 'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp'];
      requiredProps.forEach(prop => {
        if (!safeRequest.context[prop]) {
          safeRequest.context[prop] = '';
        }
      });
      
      return safeRequest;
    });
    
    res.json({
      count: initRequests.length,
      requests: safeRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;