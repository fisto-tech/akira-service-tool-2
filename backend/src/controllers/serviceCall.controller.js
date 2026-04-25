const ServiceCall    = require('../models/serviceCall.model');
const EscalationFlow = require('../models/escalationFlow.model');
const User           = require('../models/user.model');
const SupportRequest = require('../models/supportRequest.model');
const FieldVisit     = require('../models/fieldVisit.model');

// ── Helper: resolve SLA steps for customerType + segment ─────────────────────
async function resolveFlow(customerType, segment) {
  const key1 = `${customerType}|${segment}`;
  const key2 = `${customerType}|Default`;
  let flow = await EscalationFlow.findOne({ type: key1 });
  if (!flow) flow = await EscalationFlow.findOne({ type: key2 });
  if (!flow) flow = await EscalationFlow.findOne({ type: customerType });
  return flow;
}

// ── GET /api/service-calls/sla-employees?customerType=X&segment=Y ─────────────
// Returns the SLA flow config + Level-0 employee details.
// Used by the Assignment popup to show only eligible engineers.
exports.getSLAEmployees = async (req, res) => {
  try {
    const { customerType = 'All', segment = '' } = req.query;
    const flow = await resolveFlow(customerType, segment);

    if (!flow || !flow.steps.length) {
      return res.json({ configured: false, steps: [], level0: null });
    }

    const step0     = flow.steps[0];
    const engineers = await User.find({
      userId:        { $in: step0.engineerIds || [] },
      workingStatus: { $ne: 'Inactive' },
    }).select('-password');

    return res.json({
      configured: true,
      flowKey:    flow.type,
      steps:      flow.steps,
      level0: {
        dept:          step0.dept,
        durationHours: step0.durationHours,
        durationMins:  step0.durationMins,
        engineers,           // full employee objects for Level 1
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/service-calls ────────────────────────────────────────────────────
exports.getAllCalls = async (req, res) => {
  try {
    const calls = await ServiceCall.find().sort({ createdAt: -1 });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/service-calls/pending ───────────────────────────────────────────
// Returns calls that have at least one product that is un-assigned.
exports.getPendingAssignments = async (req, res) => {
  try {
    const calls = await ServiceCall.find({ 'products._assigned': false });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/service-calls ───────────────────────────────────────────────────
exports.createCall = async (req, res) => {
  try {
    const call = await ServiceCall.create(req.body);
    
    // Trigger Critical notification if priority is Critical
    if (call.priority === 'Critical') {
      const { sendNotification } = require('./notification.controller');
      await sendNotification({
        recipient: 'admin', // Or fetch admin IDs
        type: 'Critical',
        title: 'New Critical Service Call',
        message: `A new critical service call #${call.callNumber} has been registered for ${call.customerName}.`,
        data: { callId: call._id, callNumber: call.callNumber },
        priority: 'Critical'
      });
    }

    res.status(201).json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/service-calls/assign ───────────────────────────────────────────
exports.assignServiceCall = async (req, res) => {
  try {
    const {
      callId,
      productIndices,
      engineerId,
      engineerName,
      department,
      resHours,
      resMins,
      segment    = '',
      customerType = 'All',
    } = req.body;

    const call = await ServiceCall.findById(callId);
    if (!call) return res.status(404).json({ message: 'Call not found' });

    const now        = new Date();
    const durationMs = (parseInt(resHours) || 0) * 3600000 + (parseInt(resMins) || 0) * 60000;
    const deadline   = new Date(now.getTime() + durationMs);

    // Find the engineer's position within the SLA flow (level 0)
    const flow       = await resolveFlow(customerType || call.customerType, segment);
    const step0      = flow?.steps?.[0];
    const engPointer = step0?.engineerIds?.indexOf(engineerId) ?? 0;

    const historyEntry = {
      level:        0,
      department,
      engineerId,
      engineerName,
      assignedAt:   now,
      deadline,
      status:       'Pending',
    };

    // Update each selected product
    productIndices.forEach(idx => {
      const prod = call.products[idx];
      if (!prod) return;

      prod._assigned             = true;
      prod._assignedAt           = now;
      prod._assignedEngineerId   = engineerId;
      prod._assignedEngineerName = engineerName;
      prod._currentDepartment    = department;
      prod._escalationLevel      = 0;
      prod._levelPointer         = 0;
      prod._escalationPointer    = Math.max(engPointer, 0);
      prod._deadline             = deadline;
      prod._isCritical           = false;
      prod._escalationHistory    = [historyEntry];
    });

    // Call-level state
    call.status              = 'Assigned';
    call.currentEngineerId   = engineerId;
    call.currentEngineerName = engineerName;
    call.currentDepartment   = department;
    call.escalationLevel     = 0;
    call.deadline            = deadline;
    call.escalationHistory   = [...(call.escalationHistory || []), historyEntry];

    call.markModified('products');
    await call.save();

    // Trigger Notification for the assigned engineer
    const { sendNotification } = require('./notification.controller');
    await sendNotification({
      recipient: engineerId,
      type: 'Assignment',
      title: 'New Service Call Assigned',
      message: `You have been assigned a new service call #${call.callNumber}.`,
      data: { callId: call._id, callNumber: call.callNumber },
      priority: 'High'
    });

    res.json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/service-calls/active ────────────────────────────────────────────
// Returns calls that are NOT fully resolved
exports.getActiveCalls = async (req, res) => {
  try {
    const calls = await ServiceCall.find({ status: { $ne: 'Resolved' } }).sort({ createdAt: -1 });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/service-calls/:id/product/:pIdx/close ─────────────────────────
exports.closeProduct = async (req, res) => {
  try {
    const { id, pIdx } = req.params;
    const closureData = req.body; // status, remarks, visitDate, assignedTo, etc.
    
    const call = await ServiceCall.findById(id);
    if (!call) return res.status(404).json({ message: 'Call not found' });
    if (!call.products[pIdx]) return res.status(404).json({ message: 'Product not found' });

    call.products[pIdx]._productClosure = closureData;
    
    // Check if all assigned products are closed/resolved
    const allAssignedDone = call.products.every(p => {
      if (!p._assigned) return true;
      return p._resolved || p._productClosure?.status === 'Closed';
    });
    
    if (allAssignedDone) {
      call.status = 'Resolved';
    }

    call.markModified('products');
    await call.save();
    res.json(call);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/service-calls/support ──────────────────────────────────────────
exports.createSupportRequest = async (req, res) => {
  try {
    const { callId, productIdx, product, supportPerson, notes, callNumber } = req.body;
    
    const reqData = new SupportRequest({
      callId, callNumber, productIdx, product, supportPerson, notes, status: 'Pending'
    });
    await reqData.save();

    const call = await ServiceCall.findById(callId);
    if (call && call.products[productIdx]) {
      call.products[productIdx]._supportRequested = true;
      call.products[productIdx]._supportPersonName = supportPerson.name;
      call.status = 'Escalated';
      call.markModified('products');
      await call.save();
    }

    res.status(201).json(reqData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/service-calls/support/:userId ───────────────────────────────────
exports.getSupportRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await SupportRequest.find({ 'supportPerson.userId': userId });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/service-calls/support/:id/resolve ─────────────────────────────
exports.resolveSupportRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, resolutionType, resolvedAt } = req.body;
    
    const sReq = await SupportRequest.findByIdAndUpdate(id, {
      status, resolutionNotes, resolutionType, resolvedAt
    }, { new: true });

    if (sReq && status === 'Resolved') {
      const call = await ServiceCall.findById(sReq.callId);
      if (call && call.products[sReq.productIdx]) {
        call.products[sReq.productIdx]._resolved = true;
        call.products[sReq.productIdx]._productClosure = {
          status: 'Closed',
          resolutionType,
          remarks: resolutionNotes,
          closedAt: resolvedAt
        };
        
        // Check if all assigned products are closed/resolved
        const allAssignedDone = call.products.every(p => {
          if (!p._assigned) return true;
          return p._resolved || p._productClosure?.status === 'Closed';
        });
        
        if (allAssignedDone) {
          call.status = 'Resolved';
        }

        call.markModified('products');
        await call.save();
      }
    }

    res.json(sReq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/service-calls/field-visit ──────────────────────────────────────
exports.createFieldVisit = async (req, res) => {
  try {
    const { callId, productIdx, callNumber, type, assignedTo, assignedToName, assignmentDate, visitDate, diagnosisSummary } = req.body;
    
    const visitData = new FieldVisit({
      callId, callNumber, productIdx, type, assignedTo, assignedToName, assignmentDate, visitDate, diagnosisSummary, visitStatus: 'Open'
    });
    await visitData.save();

    res.status(201).json(visitData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/service-calls/field-visit/:userId ───────────────────────────────
exports.getFieldVisits = async (req, res) => {
  try {
    const { userId } = req.params;
    const visits = await FieldVisit.find({ assignedTo: userId });
    res.json(visits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/service-calls/field-visit/:id/close ───────────────────────────
exports.closeFieldVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await FieldVisit.findByIdAndUpdate(id, {
      visitStatus: 'Closed',
      closedAt: new Date()
    }, { new: true });
    
    res.json(visit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/service-calls/:id ──────────────────────────────────────────────
exports.updateCall = async (req, res) => {
  try {
    const call = await ServiceCall.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!call) return res.status(404).json({ message: 'Call not found' });

    // Trigger Critical notification if priority changed to Critical or is updated as Critical
    if (call.priority === 'Critical') {
      const { sendNotification } = require('./notification.controller');
      await sendNotification({
        recipient: 'admin',
        type: 'Critical',
        title: 'Service Call Marked Critical',
        message: `Service call #${call.callNumber} for ${call.customerName} is now CRITICAL.`,
        data: { callId: call._id, callNumber: call.callNumber },
        priority: 'Critical'
      });
    }

    res.json(call);
  } catch (err) {
    console.error("updateCall Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/service-calls/:id ─────────────────────────────────────────────
exports.deleteCall = async (req, res) => {
  try {
    const call = await ServiceCall.findByIdAndDelete(req.params.id);
    if (!call) return res.status(404).json({ message: 'Call not found' });
    res.json({ message: 'Call deleted successfully' });
  } catch (err) {
    console.error("deleteCall Error:", err);
    res.status(500).json({ message: err.message });
  }
};
