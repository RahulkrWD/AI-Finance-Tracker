const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer'],
    default: 'expense'
  },
  category: {
    type: String,
    required: true
  },
  merchant: {
    type: String,
    default: ''
  },
  sourceFile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Statement'
  },
  aiConfidence: {
    type: Number,
    default: 0.0
  },
  userModified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);