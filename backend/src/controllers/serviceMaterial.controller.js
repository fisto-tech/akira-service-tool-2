const ServiceMaterial = require('../models/serviceMaterial.model');

// ── GET /api/service-material ────────────────────────────────────────────────
exports.getAllInwards = async (req, res) => {
  try {
    const inwards = await ServiceMaterial.find().sort({ createdAt: -1 });
    res.json(inwards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/service-material/:id ─────────────────────────────────────────────
exports.getInwardById = async (req, res) => {
  try {
    const inward = await ServiceMaterial.findById(req.params.id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });
    res.json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/service-material ────────────────────────────────────────────────
exports.createInward = async (req, res) => {
  try {
    const inward = await ServiceMaterial.create(req.body);
    res.status(201).json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/service-material/:id ─────────────────────────────────────────────
exports.updateInward = async (req, res) => {
  try {
    const inward = await ServiceMaterial.findByIdAndUpdate(
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

// ── DELETE /api/service-material/:id ──────────────────────────────────────────
exports.deleteInward = async (req, res) => {
  try {
    const inward = await ServiceMaterial.findByIdAndDelete(req.params.id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });
    res.json({ message: 'Inward deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/service-material/:id/claim-product ────────────────────────────
exports.claimProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, userId, userName } = req.body;

    const inward = await ServiceMaterial.findById(id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });

    const product = inward.products.find(p => p._pid === productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // if (product.assignedTo) return res.status(400).json({ message: 'Product already assigned' });

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

// ── PATCH /api/service-material/:id/product/:productId/report ──────────────────
exports.updateProductReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, report } = req.body;

    const inward = await ServiceMaterial.findById(id);
    if (!inward) return res.status(404).json({ message: 'Inward not found' });

    const product = inward.products.find(p => p._pid === productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.report = report;
    product.status = report.status;
    
    // Also update remark if needed
    if (report.currentRemark) {
        product.remark = report.currentRemark;
    }

    inward.markModified('products');
    await inward.save();
    res.json(inward);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
