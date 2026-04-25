const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  itemCode: String,
  itemDescription: String,
  serialNumber: String,
  productModel: String,
  productSegment: String,
  errorCode: String,
  _assigned: { type: Boolean, default: false },
  _assignedAt: Date,
  _assignedEngineerId: String,
  _assignedEngineerName: String,
  _escalationLevel: { type: Number, default: 0 },
  _currentDepartment: String,
  _assignedSegment: String,
  _resolved: { type: Boolean, default: false },
  _supportRequested: { type: Boolean, default: false },
  _escalationHistory: [mongoose.Schema.Types.Mixed],
  // SLA escalation tracking
  _deadline: Date,
  _isCritical: { type: Boolean, default: false },
  _levelPointer: { type: Number, default: 0 },      // which step in SLA flow
  _escalationPointer: { type: Number, default: 0 }, // which engineer within that step
  _productClosure: mongoose.Schema.Types.Mixed,
});

const serviceCallSchema = new mongoose.Schema({
  callNumber: { type: String, required: true, unique: true },
  customerName: String,
  partyCode: String,
  contactPerson: String,
  contactNumber: String,
  location: String,
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  status: { type: String, default: 'Registered', enum: ['Registered', 'Assigned', 'Open', 'Pending', 'Resolved', 'Critical', 'Escalated'] },
  dateTime: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now },
  mode: String,
  emailId: String,
  locationType: { type: String, default: 'IPR' },
  segment: String,
  customerType: String,
  products: [productSchema],
  
  // SLA / Escalation Fields
  currentEngineerId: String,
  currentEngineerName: String,
  currentDepartment: String,
  escalationLevel: { type: Number, default: 0 },
  deadline: Date,
  escalationHistory: [mongoose.Schema.Types.Mixed]
}, { timestamps: true });

module.exports = mongoose.model('ServiceCall', serviceCallSchema);
