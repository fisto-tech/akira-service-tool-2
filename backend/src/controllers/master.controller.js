const PartyType = require('../models/partyType.model');
const ProductSegment = require('../models/productSegment.model');
const EscalationFlow = require('../models/escalationFlow.model');
const Customer = require('../models/customer.model');
const MasterSettings = require('../models/masterSettings.model');
const BoardType = require('../models/boardType.model');
const FourMCategory = require('../models/fourMCategory.model');

// --- Party Types ---
exports.getPartyTypes = async (req, res) => {
  try { res.json(await PartyType.find()); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.addPartyType = async (req, res) => {
  try { res.json(await PartyType.create(req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.updatePartyType = async (req, res) => {
  try { res.json(await PartyType.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.deletePartyType = async (req, res) => {
  try { await PartyType.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ message: err.message }); }
};

// --- Product Segments ---
exports.getProductSegments = async (req, res) => {
  try { res.json(await ProductSegment.find()); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.addProductSegment = async (req, res) => {
  try { res.json(await ProductSegment.create(req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.updateProductSegment = async (req, res) => {
  try { res.json(await ProductSegment.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.deleteProductSegment = async (req, res) => {
  try { await ProductSegment.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ message: err.message }); }
};

// --- Escalation Flows ---
exports.getEscalationFlows = async (req, res) => {
  try { res.json(await EscalationFlow.find()); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.saveEscalationFlow = async (req, res) => {
  try {
    const { type, steps } = req.body;
    const flow = await EscalationFlow.findOneAndUpdate({ type }, { steps }, { upsert: true, new: true });
    res.json(flow);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// --- Customers ---
exports.getCustomers = async (req, res) => {
  try { res.json(await Customer.find()); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.saveCustomers = async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers)) return res.status(400).json({ message: "Customers must be an array" });
    
    // Using deleteMany and insertMany for bulk replacement
    await Customer.deleteMany({});
    const saved = await Customer.insertMany(customers);
    res.json(saved);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.bulkAddCustomers = async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers)) return res.status(400).json({ message: "Customers must be an array" });
    const saved = await Customer.insertMany(customers, { ordered: false });
    res.json({ message: "Successfully added all records", insertedCount: saved.length });
  } catch (err) {
    console.error("bulkAddCustomers error:", err);
    if (err.name === 'BulkWriteError' || err.code === 11000 || err.writeErrors) {
      const insertedCount = err.result?.nInserted || err.insertedDocs?.length || 0;
      const duplicateCount = err.writeErrors?.length || 0;
      return res.status(200).json({ 
        message: `Import complete: ${insertedCount} new records added. ${duplicateCount} duplicates were skipped.`,
        insertedCount,
        duplicateCount,
        partial: true
      });
    }
    res.status(500).json({ message: err.message });
  }
};
exports.bulkDeleteCustomers = async (req, res) => {
  try {
    const { itemCodes } = req.body;
    await Customer.deleteMany({ itemCode: { $in: itemCodes } });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.addCustomer = async (req, res) => {
  try { res.json(await Customer.create(req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.updateCustomer = async (req, res) => {
  try { res.json(await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.deleteCustomer = async (req, res) => {
  try { await Customer.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ message: err.message }); }
};

// --- Settings ---
exports.getSettings = async (req, res) => {
  try {
    const settings = await MasterSettings.findOne({ key: req.params.key });
    res.json(settings ? settings.value : null);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.saveSettings = async (req, res) => {
  try {
    const { key, value } = req.body;
    const settings = await MasterSettings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
    res.json(settings);
  } catch (err) { res.status(500).json({ message: err.message }); }
};
// --- Board Types ---
exports.getBoardTypes = async (req, res) => {
  try { res.json(await BoardType.find()); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.addBoardType = async (req, res) => {
  try { res.json(await BoardType.create(req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.updateBoardType = async (req, res) => {
  try { res.json(await BoardType.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.deleteBoardType = async (req, res) => {
  try { await BoardType.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ message: err.message }); }
};

// --- 4M Categories ---
exports.getFourMCategories = async (req, res) => {
  try { res.json(await FourMCategory.find()); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.addFourMCategory = async (req, res) => {
  try { res.json(await FourMCategory.create(req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.updateFourMCategory = async (req, res) => {
  try { res.json(await FourMCategory.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { res.status(500).json({ message: err.message }); }
};
exports.deleteFourMCategory = async (req, res) => {
  try { await FourMCategory.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { res.status(500).json({ message: err.message }); }
};
