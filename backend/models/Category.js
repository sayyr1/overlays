// src/models/Category.js
import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  valuesByKey: {
    type: Map,
    of: [String],
    default: {}
  },
  brandModels: {
    type: Map,
    of: [String],
    default: {}
  }
});

export default mongoose.model('Category', CategorySchema);
