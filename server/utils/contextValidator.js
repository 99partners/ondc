/**
 * ONDC Context Validation Utility
 * Provides functions for validating and ensuring safe context objects
 */

// ONDC Error Codes
const ONDC_ERRORS = {
  '20002': { type: 'CONTEXT-ERROR', code: '20002', message: 'Invalid timestamp' },
  '30022': { type: 'CONTEXT-ERROR', code: '30022', message: 'Invalid timestamp' },
  '10001': { type: 'CONTEXT-ERROR', code: '10001', message: 'Invalid context: Mandatory field missing or incorrect value.' },
  '10002': { type: 'CONTEXT-ERROR', code: '10002', message: 'Invalid message' }
};

/**
 * Validates an ONDC context object
 * @param {Object} context - The context object to validate
 * @returns {Array} - Array of error messages, empty if valid
 */
function validateContext(context) {
  const errors = [];
  
  // Ensure context is an object
  if (!context || typeof context !== 'object') {
    errors.push('Context is required and must be an object');
    return errors;
  }
  
  // --- ONDC Mandatory Context Fields for BAP -> BPP Request (as per V1.2.0) ---
  // Check each property with type validation
  if (!context.domain || typeof context.domain !== 'string') errors.push('domain is required and must be a string');
  if (!context.country || typeof context.country !== 'string') errors.push('country is required and must be a string');
  if (!context.city || typeof context.city !== 'string') errors.push('city is required and must be a string');
  if (!context.action || typeof context.action !== 'string') errors.push('action is required and must be a string');
  if (!context.core_version || typeof context.core_version !== 'string') errors.push('core_version is required and must be a string');
  if (!context.bap_id || typeof context.bap_id !== 'string') errors.push('bap_id is required and must be a string');
  if (!context.bap_uri || typeof context.bap_uri !== 'string') errors.push('bap_uri is required and must be a string');
  if (!context.bpp_id || typeof context.bpp_id !== 'string') errors.push('bpp_id is required and must be a string');
  if (!context.bpp_uri || typeof context.bpp_uri !== 'string') errors.push('bpp_uri is required and must be a string');
  if (!context.transaction_id || typeof context.transaction_id !== 'string') errors.push('transaction_id is required and must be a string');
  if (!context.message_id || typeof context.message_id !== 'string') errors.push('message_id is required and must be a string');
  if (!context.timestamp || typeof context.timestamp !== 'string') errors.push('timestamp is required and must be a string');
  if (!context.ttl || typeof context.ttl !== 'string') errors.push('ttl is required and must be a string');
  
  return errors;
}

/**
 * Creates a safe context object with default values for missing properties
 * @param {Object} context - The original context object
 * @returns {Object} - A safe context object with all required properties
 */
function ensureSafeContext(context) {
  if (!context || typeof context !== 'object') {
    return {
      domain: '',
      country: '',
      city: '',
      action: '',
      core_version: '',
      bap_id: '',
      bap_uri: '',
      bpp_id: '',
      bpp_uri: '',
      transaction_id: '',
      message_id: '',
      timestamp: '',
      ttl: ''
    };
  }
  
  // Create a safe copy with default values for missing properties
  return {
    domain: typeof context.domain === 'string' ? context.domain : '',
    country: typeof context.country === 'string' ? context.country : '',
    city: typeof context.city === 'string' ? context.city : '',
    action: typeof context.action === 'string' ? context.action : '',
    core_version: typeof context.core_version === 'string' ? context.core_version : '',
    bap_id: typeof context.bap_id === 'string' ? context.bap_id : '',
    bap_uri: typeof context.bap_uri === 'string' ? context.bap_uri : '',
    bpp_id: typeof context.bpp_id === 'string' ? context.bpp_id : '',
    bpp_uri: typeof context.bpp_uri === 'string' ? context.bpp_uri : '',
    transaction_id: typeof context.transaction_id === 'string' ? context.transaction_id : '',
    message_id: typeof context.message_id === 'string' ? context.message_id : '',
    timestamp: typeof context.timestamp === 'string' ? context.timestamp : '',
    ttl: typeof context.ttl === 'string' ? context.ttl : ''
  };
}

/**
 * Safely extracts payload from request body
 * @param {Object} req - Express request object
 * @returns {Object} - Safe payload object with context and message
 */
function extractSafePayload(req) {
  // Ensure req.body exists
  const payload = req.body || {};
  
  // Extract context and message with defaults
  const rawContext = payload.context || {};
  const message = payload.message || {};
  
  // Create safe context
  const safeContext = ensureSafeContext(rawContext);
  
  return {
    payload,
    rawContext,
    safeContext,
    message
  };
}

/**
 * Creates an error response object
 * @param {string} errorCode - The error code
 * @param {string} message - The error message
 * @returns {Object} - The error response object
 */
function createErrorResponse(errorCode, message) {
  const error = ONDC_ERRORS[errorCode] || { type: 'CONTEXT-ERROR', code: errorCode, message };
  return {
    message: { ack: { status: 'NACK' } },
    error: {
      type: error.type,
      code: error.code,
      message: error.message
    }
  };
}

/**
 * Creates an acknowledgment response
 * @returns {Object} - The ACK response object
 */
function createAckResponse() {
  return {
    message: { ack: { status: 'ACK' } }
  };
}

/**
 * Helper function to create transaction trail data with safe context
 * @param {Object} params - Parameters for transaction trail
 * @param {Object} safeContext - Safe context object
 * @param {string} action - Action name
 * @param {string} status - Status (ACK/NACK)
 * @param {Object} bppConfig - BPP configuration
 * @returns {Object} - Transaction trail data
 */
function createTransactionTrailData(params, safeContext, action, status, bppConfig) {
  return {
    transaction_id: safeContext.transaction_id,
    message_id: safeContext.message_id,
    action: safeContext.action || action,
    direction: 'incoming',
    status: status,
    context: safeContext,
    ...params,
    timestamp: new Date(),
    bap_id: safeContext.bap_id,
    bap_uri: safeContext.bap_uri,
    bpp_id: safeContext.bpp_id || bppConfig.BPP_ID,
    bpp_uri: safeContext.bpp_uri || bppConfig.BPP_URI,
    domain: safeContext.domain,
    country: safeContext.country,
    city: safeContext.city,
    core_version: safeContext.core_version
  };
}

module.exports = {
  validateContext,
  ensureSafeContext,
  extractSafePayload,
  createErrorResponse,
  createAckResponse,
  createTransactionTrailData,
  ONDC_ERRORS
};