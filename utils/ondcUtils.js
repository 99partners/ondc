const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

function generateContext(action, bapId, bapUri) {
  return {
    domain: config.ondc.domain,
    country: config.ondc.country,
    city: config.ondc.city,
    action,
    core_version: config.ondc.version,
    bap_id: bapId || config.ondc.sellerId,
    bap_uri: bapUri || `https://${config.domain}`,
    bpp_id: config.ondc.sellerId,
    bpp_uri: `https://${config.domain}`,
    transaction_id: uuidv4(),
    message_id: uuidv4(),
    timestamp: moment().toISOString(),
    ttl: 'PT30S'
  };
}

function ack(status = true) {
  return { message: { ack: { status: status ? 'ACK' : 'NACK' } } };
}

module.exports = {
  generateContext,
  ack
};


