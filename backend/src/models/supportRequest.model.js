const mongoose = require('mongoose');

const supportRequestSchema = new mongoose.Schema({
  callId: String,
  callNumber: String,
  productIdx: Number,
  product: mongoose.Schema.Types.Mixed,
  supportPerson: mongoose.Schema.Types.Mixed,
  notes: String,
  status: { type: String, default: 'Pending' }, // Pending, Resolved
  resolutionNotes: String,
  resolutionType: String,
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
