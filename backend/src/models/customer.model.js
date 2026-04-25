const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  partyType: { type: String },
  productSegment: { type: String },
  partyCode: { type: String, required: true },
  partyDescription: { type: String, required: true },
  itemCode: { type: String, required: true, unique: true },
  itemDescription: { type: String },
  warrantyPeriodDays: { type: Number },
  state: { type: String },
  districtCity: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
