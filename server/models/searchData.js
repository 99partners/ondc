const mongoose = require('mongoose');

const SearchDataSchema = new mongoose.Schema(
  {
    // Entire incoming payload for traceability
    fullPayload: { type: Object, required: true },

    // Common ONDC context fields for indexing/filtering
    domain: { type: String },
    country: { type: String },
    city: { type: String },
    core_version: { type: String },
    bap_id: { type: String },
    bap_uri: { type: String },
    transaction_id: { type: String },
    message_id: { type: String },
    timestamp: { type: Date },
    action: { type: String },

    // Useful query fields
    query: { type: String },
    source: { type: String, default: 'buyer-app' }
  },
  { timestamps: true }
);

SearchDataSchema.index({ transaction_id: 1 });
SearchDataSchema.index({ message_id: 1 });
SearchDataSchema.index({ action: 1 });
SearchDataSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SearchData', SearchDataSchema);


