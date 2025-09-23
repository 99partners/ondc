const mongoose = require('mongoose');

const searchDataSchema = new mongoose.Schema({
  query: {
    type: String,
    required: true,
    trim: true
  },
  filters: {
    type: Object,
    default: {}
  },
  results: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number },
    category: { type: String },
    image: { type: String },
    metadata: { type: Object, default: {} }
  }],
  source: {
    type: String,
    required: true,
    enum: ['api', 'third-party']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const SearchData = mongoose.model('SearchData', searchDataSchema);

module.exports = SearchData;