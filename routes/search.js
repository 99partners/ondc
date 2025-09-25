const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const config = require('../config');
const productService = require('../services/productService');

const router = express.Router();

function validateSearch(req) {
  const body = req.body || {};
  const ctx = body.context;
  const intent = body.message?.intent;

  const requiredContext = [
    'domain', 'action', 'country', 'city', 'core_version',
    'bap_id', 'bap_uri', 'transaction_id', 'message_id', 'timestamp', 'ttl'
  ];

  if (!ctx || !intent) {
    return { ok: false, nack: true, message: 'Missing context or message.intent' };
  }

  for (const f of requiredContext) {
    if (!ctx[f]) return { ok: false, nack: true, message: `Missing context.${f}` };
  }

  if (ctx.action !== 'search') {
    return { ok: false, nack: true, message: 'context.action must be search' };
  }

  if (!intent.item?.descriptor?.name) {
    return { ok: false, nack: true, message: 'intent.item.descriptor.name is required' };
  }

  return { ok: true };
}

router.post('/search', async (req, res) => {
  try {
    const valid = validateSearch(req);
    if (!valid.ok) {
      const nackRes = {
        context: req.body?.context || {},
        message: { ack: { status: 'NACK' } },
        error: { code: 'BAD_REQUEST', message: valid.message }
      };
      return res.status(400).json(nackRes);
    }

    // Immediate ACK echoing request context (per ONDC RET v1.2.0)
    const ackRes = {
      context: req.body.context,
      message: { ack: { status: 'ACK' } }
    };
    res.json(ackRes);

    // Async on_search callback
    const intent = req.body.message.intent;
    const criteria = {
      query: intent.item?.descriptor?.name || '',
      category: intent.category?.id || 'fashion:apparel',
      priceRange: {
        min: intent.item?.price?.minimum?.value ? parseFloat(intent.item.price.minimum.value) : null,
        max: intent.item?.price?.maximum?.value ? parseFloat(intent.item.price.maximum.value) : null
      }
    };

    const products = await productService.searchFashion(criteria);

    // Build on_search context from incoming context per contract
    const inCtx = req.body.context;
    const onSearchContext = {
      domain: inCtx.domain,
      country: inCtx.country,
      city: inCtx.city,
      action: 'on_search',
      core_version: inCtx.core_version,
      bap_id: inCtx.bap_id,
      bap_uri: inCtx.bap_uri,
      bpp_id: config.ondc.sellerId,
      bpp_uri: `https://${config.domain}`,
      transaction_id: inCtx.transaction_id,
      message_id: uuidv4(),
      timestamp: moment().toISOString(),
      ttl: inCtx.ttl
    };

    const catalog = {
      "bpp/descriptor": {
        name: '99DigiCom Fashion',
        code: '99digicom-seller',
        short_desc: 'Fashion and apparel',
        long_desc: 'Apparel and accessories',
        images: []
      },
      "bpp/categories": [
        { id: 'fashion:apparel', parent_category_id: null, name: 'Apparel', description: 'Clothing and apparel' }
      ],
      "bpp/providers": [
        {
          id: '99digicom-seller',
          descriptor: { name: '99DigiCom Fashion', short_desc: 'Fashion seller', long_desc: 'Apparel and accessories' },
          categories: ['fashion:apparel'],
          items: products.map(p => ({
            id: p.id,
            parent_item_id: null,
            descriptor: {
              name: p.name,
              short_desc: p.short_desc,
              long_desc: p.description,
              images: p.images
            },
            price: { currency: 'INR', value: p.price.toString(), maximum_value: p.mrp?.toString?.() || p.price.toString() },
            category_id: p.category_id,
            fulfillment_id: 'standard_delivery',
            location_id: 'ka-bengaluru',
            time: { label: 'Delivery Time', duration: 'P2D' },
            rateable: true,
            tags: [
              { code: 'brand', value: p.brand || '' },
              { code: 'gender', value: p.gender || '' },
              { code: 'material', value: p.material || '' },
              { code: 'size', value: Array.isArray(p.size) ? p.size.join(',') : '' },
              { code: 'color', value: Array.isArray(p.color) ? p.color.join(',') : '' },
              { code: 'size_chart', value: p.size_chart_url || '' },
              { code: 'hsn', value: p.hsn || '' },
              { code: 'tax_rate', value: typeof p.tax_rate === 'number' ? String(p.tax_rate) : '' }
            ]
          })),
          fulfillments: [
            { id: 'standard_delivery', type: 'Delivery', tracking: false, tl_method: 'http', contact: { phone: '0000000000', email: 'support@99digicom.com' }, returns: { returnable: true, time: { duration: 'P7D' } }, cancellations: { cancellable: true, time: { duration: 'PT2H' } } }
          ],
          locations: [
            { id: 'ka-bengaluru', gps: '12.9716,77.5946', address: { city: 'Bengaluru', state: 'Karnataka', area_code: '560100' } }
          ]
        }
      ]
    };

    const onSearchPayload = {
      context: onSearchContext,
      message: { catalog }
    };

    // Post back to buyer app's on_search
    const onSearchUrl = `${req.body.context.bap_uri}/on_search`;
    await axios.post(onSearchUrl, onSearchPayload, { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error('Error in /search flow:', e.message);
  }
});

module.exports = router;


