const ProductionMaterial = require('../models/productionMaterial.model');

// --- GET /api/production-material ---
exports.getAllInwards = async (req, res) => {
  try {
    const inwards = await ProductionMaterial.find().sort({ createdAt: -1 });
    res.json(inwards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- GET /api/production-material/:id ---
exports.getInwardById = async (req, res) => {
  try {
    const inward = await ProductionMaterial.findById(req.params.id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });
    res.json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- POST /api/production-material ---
exports.createInward = async (req, res) => {
  try {
    const inward = await ProductionMaterial.create(req.body);
    res.status(201).json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- PUT /api/production-material/:id ---
exports.updateInward = async (req, res) => {
  try {
    const inward = await ProductionMaterial.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!inward) return res.status(404).json({ message: 'Inward not found' });
    res.json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- DELETE /api/production-material/:id ---
exports.deleteInward = async (req, res) => {
  try {
    const inward = await ProductionMaterial.findByIdAndDelete(req.params.id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });
    res.json({ message: 'Inward deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- PATCH /api/production-material/:id/claim-product ---
exports.claimProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, userId, userName } = req.body;

    const inward = await ProductionMaterial.findById(id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });

    const product = inward.products.find(p => p._pid === productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.assignedTo = userId;
    product.assignedToName = userName;
    product.status = 'Assigned';

    inward.markModified('products');
    await inward.save();
    res.json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- PATCH /api/production-material/:id/product/:productId/report ---
exports.updateProductReport = async (req, res) => {
  try {
    const { id, productId } = req.params;
    const { report } = req.body;

    const inward = await ProductionMaterial.findById(id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });

    const product = inward.products.find(p => p._pid === productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.report = report;
    product.status = report.status || 'Updated';

    inward.markModified('products');
    await inward.save();
    res.json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// --- PATCH /api/production-material/:id/product/:productId/final-status ---
exports.updateFinalStatus = async (req, res) => {
  try {
    const { id, productId } = req.params;
    const { finalStatus, finalStatusRemarks, finalStatusDate, finalStatusHistory, report } = req.body;

    const inward = await ProductionMaterial.findById(id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });

    const product = inward.products.find(p => p._pid === productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (finalStatus !== undefined) product.finalStatus = finalStatus;
    if (finalStatusRemarks !== undefined) product.finalStatusRemarks = finalStatusRemarks;
    if (finalStatusDate !== undefined) product.finalStatusDate = finalStatusDate;
    if (finalStatusHistory !== undefined) product.finalStatusHistory = finalStatusHistory;
    if (report !== undefined) product.report = report;

    inward.markModified('products');
    await inward.save();
    res.json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
