/**
 * escalationWorker.service.js
 *
 * Runs every 30 seconds and checks all active ServiceCall products.
 * If a product's SLA deadline has passed and it is still unresolved,
 * it automatically escalates to the next configured engineer in the
 * SLA flow (same level → next engineer → next level → Critical).
 */

const ServiceCall    = require('../models/serviceCall.model');
const EscalationFlow = require('../models/escalationFlow.model');
const User           = require('../models/user.model');
const socketConfig   = require('../config/socket');

const WORKER_INTERVAL_MS = 30 * 1000; // 30 s

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build the SLA flow key the same way the frontend does. */
function flowKey(customerType, segment) {
  return `${customerType}|${segment}`;
}

/** Load all SLA flows as a map keyed by `type`. */
async function loadFlowMap() {
  const flows = await EscalationFlow.find().lean();
  const map   = {};
  flows.forEach(f => { map[f.type] = f.steps; });
  return map;
}

/** Load all active users as a map keyed by userId. */
async function loadUserMap() {
  const users = await User.find({ workingStatus: { $ne: 'Inactive' } })
                          .select('-password').lean();
  const map   = {};
  users.forEach(u => { map[u.userId] = u; });
  return map;
}

/**
 * Resolve the best matching SLA steps for a given customerType + segment.
 * Priority: exact → fallback default segment → customerType-only.
 */
function resolveSteps(flowMap, customerType, segment) {
  return (
    flowMap[flowKey(customerType, segment)] ||
    flowMap[flowKey(customerType, 'Default')] ||
    flowMap[customerType] ||
    null
  );
}

// ─── Core escalation logic ────────────────────────────────────────────────────

async function runEscalationCheck() {
  try {
    const now = new Date();

    // Only fetch calls that have at least one product past its deadline
    const calls = await ServiceCall.find({
      status:                  { $nin: ['Resolved', 'Critical'] },
      'products._assigned':    true,
      'products._resolved':    { $ne: true },
      'products._isCritical':  { $ne: true },
      'products._deadline':    { $lt: now },
    });

    if (!calls.length) return;

    const [flowMap, userMap] = await Promise.all([loadFlowMap(), loadUserMap()]);

    let io;
    try { io = socketConfig.getIO(); } catch { /* socket not yet ready */ }

    for (const call of calls) {
      let modified = false;

      for (let pIdx = 0; pIdx < call.products.length; pIdx++) {
        const prod = call.products[pIdx];

        // Skip products that don't need action
        if (!prod._assigned)          continue;
        if (prod._resolved)            continue;
        if (prod._isCritical)          continue;
        if (!prod._deadline)           continue;
        if (prod._deadline > now)      continue;
        if (prod._productClosure?.status === 'Closed') continue;
        if (prod._supportRequested)    continue;

        // Find SLA steps for this product
        const steps = resolveSteps(
          flowMap,
          call.customerType || 'All',
          prod.productSegment || prod._assignedSegment || ''
        );

        if (!steps || !steps.length) {
          // No SLA configured at all — mark Critical immediately
          prod._isCritical = true;
          call.status = 'Critical';
          modified = true;
          _emitCritical(io, call, pIdx, prod);
          continue;
        }

        // Walk levels/engineers to find the next available person
        const lvlPointer = prod._levelPointer  ?? 0;
        const escPointer = prod._escalationPointer ?? 0;

        let nextEngineer   = null;
        let nextLevel      = lvlPointer;
        let nextEngIdx     = escPointer;
        let nextStep       = null;

        outer:
        for (let lvl = lvlPointer; lvl < steps.length; lvl++) {
          const step     = steps[lvl];
          const startIdx = lvl === lvlPointer ? escPointer + 1 : 0;

          for (let eIdx = startIdx; eIdx < (step.engineerIds || []).length; eIdx++) {
            const eng = userMap[step.engineerIds[eIdx]];
            if (eng) {
              nextEngineer = eng;
              nextLevel    = lvl;
              nextEngIdx   = eIdx;
              nextStep     = step;
              break outer;
            }
          }
        }

        if (!nextEngineer) {
          // All levels exhausted — CRITICAL
          prod._isCritical  = true;
          prod._assigned    = false; // any SLA-configured engineer may pick it up
          call.status       = 'Critical';
          modified          = true;
          _emitCritical(io, call, pIdx, prod);
        } else {
          // Assign to next engineer
          const durationMs = (
            ((nextStep.durationHours || 0) * 60 + (nextStep.durationMins || 0)) * 60000
          );
          const newDeadline = new Date(now.getTime() + durationMs);

          const histEntry = {
            level:       nextLevel,
            department:  nextStep.dept,
            engineerId:  nextEngineer.userId,
            engineerName: nextEngineer.name,
            assignedAt:  now,
            deadline:    newDeadline,
            status:      'Pending',
            reason:      'SLA Auto-Escalation',
          };

          modified = true;

          // Notification integration
          const { sendNotification } = require('../controllers/notification.controller');
          
          // Notify the engineer it was escalated FROM
          if (prod._assignedEngineerId) {
            await sendNotification({
              recipient: prod._assignedEngineerId,
              type: 'Escalation',
              title: 'Call Escalated',
              message: `Call #${call.callNumber} has been escalated to ${nextEngineer.name}.`,
              data: { callId: call._id, callNumber: call.callNumber, escalatedTo: nextEngineer.name },
              priority: 'Medium'
            });
          }

          // Update product state
          const oldEngineerId = prod._assignedEngineerId;
          prod._assignedEngineerId   = nextEngineer.userId;
          prod._assignedEngineerName = nextEngineer.name;
          prod._currentDepartment    = nextStep.dept;
          prod._escalationLevel      = nextLevel;
          prod._levelPointer         = nextLevel;
          prod._escalationPointer    = nextEngIdx;
          prod._deadline             = newDeadline;
          prod._escalationHistory    = [...(prod._escalationHistory || []), histEntry];

          // Notify the NEW engineer
          await sendNotification({
            recipient: nextEngineer.userId,
            type: 'Assignment',
            title: 'Call Escalated to You',
            message: `Call #${call.callNumber} has been escalated to you from ${call.currentEngineerName || 'previous level'}.`,
            data: { callId: call._id, callNumber: call.callNumber, escalatedFrom: call.currentEngineerName },
            priority: 'High'
          });

          // Update call-level state too
          call.currentEngineerId   = nextEngineer.userId;
          call.currentEngineerName = nextEngineer.name;
          call.currentDepartment   = nextStep.dept;
          call.escalationLevel     = nextLevel;
          call.escalationHistory   = [...(call.escalationHistory || []), histEntry];

          if (io) {
            io.emit('call:escalated', {
              callId:       call._id.toString(),
              callNumber:   call.callNumber,
              productIdx:   pIdx,
              productModel: prod.productModel,
              toEngineer:   nextEngineer.name,
              department:   nextStep.dept,
              level:        nextLevel,
            });
          }
        }
      }

      if (modified) {
        call.markModified('products');
        call.markModified('escalationHistory');
        await call.save();
      }
    }
  } catch (err) {
    console.error('[EscalationWorker] Error:', err.message);
  }
}

async function _emitCritical(io, call, pIdx, prod) {
  if (!io) return;
  
  // Create notification for admins
  const { sendNotification } = require('../controllers/notification.controller');
  const User = require('../models/user.model');
  
  try {
    const admins = await User.find({ role: 'Admin' });
    for (const admin of admins) {
      await sendNotification({
        recipient: admin.userId,
        type: 'Critical',
        title: 'Critical Service Call Alert',
        message: `Service Call #${call.callNumber} for ${call.customerName} has reached Critical state!`,
        data: { callId: call._id, callNumber: call.callNumber, productIdx: pIdx },
        priority: 'Critical'
      });
    }
  } catch (err) {
    console.error('Error notifying admins of critical call:', err);
  }

  io.emit('call:critical', {
    callId:       call._id.toString(),
    callNumber:   call.callNumber,
    customerName: call.customerName,
    productIdx:   pIdx,
    productModel: prod.productModel,
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

function startEscalationWorker() {
  console.log('[EscalationWorker] Started — checking every 30 s');
  runEscalationCheck();                            // immediate first run
  setInterval(runEscalationCheck, WORKER_INTERVAL_MS);
}

module.exports = { startEscalationWorker };
