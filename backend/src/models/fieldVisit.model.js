const mongoose = require('mongoose');

const fieldVisitSchema = new mongoose.Schema({
  callId: String,
  callNumber: String,
  productIdx: Number,
  type: String, // e.g. 'Field Visit'
  assignedTo: String,
  assignedToName: String,
  assignmentDate: Date,
  visitDate: Date,
  diagnosisSummary: String,
  visitStatus: { type: String, default: 'Open' }, // Open, Closed
  closedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('FieldVisit', fieldVisitSchema);
