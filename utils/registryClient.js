const axios = require('axios');
const config = require('../config');

const defaultHeaders = {
  'content-type': 'application/json'
};

async function lookupParticipant(payload) {
  const url = `${config.registry.url}/lookup`;
  const response = await axios.post(url, payload, { headers: defaultHeaders, timeout: config.api.timeout });
  return response.data;
}

async function markUsedEndpoint(payload) {
  const url = `${config.registry.url}/used_endpoint`;
  const response = await axios.post(url, payload, { headers: defaultHeaders, timeout: config.api.timeout });
  return response.data;
}

module.exports = {
  lookupParticipant,
  markUsedEndpoint
};


