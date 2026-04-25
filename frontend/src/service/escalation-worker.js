// escalation-worker.js
// Runs in background, checks escalation deadlines every 10 seconds

const ESCALATION_KEY = "escalation_queue_v1";
const SERVICE_CALLS_KEY = "service_calls_v2";
const EMPLOYEES_KEY = "employees";
// Auto-escalation timeout — reduced for testing
const ESCALATION_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute (testing)

const ESCALATION_FLOW = ["Support Engineer", "Service Engineer", "R&D"];

function getFromStorage(key) {
  try {
    const data = self.localStorage;
    // Workers don't have localStorage, so we use message passing
    return null;
  } catch (e) {
    return null;
  }
}

// Main escalation check function - receives data via postMessage
function checkEscalations(data) {
  const { escalationQueue, employees, serviceCalls } = data;
  const now = new Date();
  let updated = false;
  const notifications = [];

  const updatedQueue = escalationQueue.map((entry) => {
    if (entry.status === "Resolved" || entry.status === "Closed") {
      return entry;
    }

    const deadline = new Date(entry.deadline);

    // Check if deadline has passed
    if (now >= deadline) {
      const currentLevel = entry.currentLevel;
      const nextLevel    = currentLevel + 1;
      
      // Use custom flow from entry if available, else default
      const flow = entry.masterFlow || ESCALATION_FLOW.map(d => ({ dept: d, durationHours: 2, durationMins: 0 }));
      
      if (nextLevel < flow.length) {
        const nextStep       = flow[nextLevel];
        const nextDepartment = nextStep.dept;

        // Find candidate engineers in the next department
        const candidates = employees.filter((emp) => emp.department === nextDepartment);

        if (candidates.length > 0) {
          // Compute current active load for each candidate using serviceCalls (calls not Resolved/Closed)
          const load = candidates.map((emp) => {
            const activeCount = serviceCalls.filter(
              (c) =>
                c.status !== "Resolved" &&
                c.status !== "Closed" &&
                (c.assignedEngineer === emp.userId || c.currentEngineerId === emp.userId)
            ).length;
            return { emp, activeCount };
          });

          // Prefer engineers who are free (zero active assignments)
          const freeEngineers = load.filter((l) => l.activeCount === 0);
          let selectedEngineerEntry;

          if (freeEngineers.length > 0) {
            // If multiple are free, pick deterministically (by userId) to avoid thrashing
            selectedEngineerEntry = freeEngineers.reduce((a, b) => (a.emp.userId < b.emp.userId ? a : b));
          } else {
            // No one is free — pick engineer with the smallest active count (least-loaded)
            selectedEngineerEntry = load.reduce((a, b) => (a.activeCount <= b.activeCount ? a : b));
          }

          const selectedEngineer = selectedEngineerEntry.emp;
          
          // Calculate next deadline using masterFlow durations
          const durMs = (nextStep.durationHours ?? 2) * 60 * 60 * 1000 + (nextStep.durationMins ?? 0) * 60 * 1000;
          const nextDeadline = new Date(now.getTime() + (durMs || ESCALATION_TIMEOUT_MS)).toISOString();

          const escalationRecord = {
            level: nextLevel,
            department: nextDepartment,
            engineerId: selectedEngineer.userId,
            engineerName: selectedEngineer.name,
            assignedAt: now.toISOString(),
            deadline: nextDeadline,
            status: "Pending",
            previousDepartment: flow[currentLevel].dept || flow[currentLevel],
            previousEngineerId: entry.currentEngineerId,
            previousEngineerName: entry.currentEngineerName,
            reason: `No response within SLA from ${flow[currentLevel].dept || flow[currentLevel]}`,
          };

          entry.escalationHistory.push(escalationRecord);
          entry.currentLevel = nextLevel;
          entry.currentDepartment = nextDepartment;
          entry.currentEngineerId = selectedEngineer.userId;
          entry.currentEngineerName = selectedEngineer.name;
          entry.deadline = nextDeadline;
          entry.status = "Escalated";

          updated = true;

          notifications.push({
            type: "escalation",
            callNumber: entry.callNumber,
            from: flow[currentLevel].dept || flow[currentLevel],
            to: nextDepartment,
            engineer: selectedEngineer.name,
            engineerId: selectedEngineer.userId,
            message: `Call ${entry.callNumber} escalated from ${flow[currentLevel].dept || flow[currentLevel]} to ${nextDepartment} (${selectedEngineer.name})`,
            timestamp: now.toISOString(),
            priority: entry.priority,
            customerName: entry.customerName,
          });
        }
      } else {
        // Already at highest level (R&D) - mark as critical
        if (entry.status !== "Critical_Unresolved") {
          entry.status = "Critical_Unresolved";
          updated = true;

          notifications.push({
            type: "critical",
            callNumber: entry.callNumber,
            message: `CRITICAL: Call ${entry.callNumber} has exceeded all escalation levels! Immediate attention required.`,
            timestamp: now.toISOString(),
            priority: "Critical",
            customerName: entry.customerName,
          });
        }
      }
    }

    return entry;
  });

  // Also update service calls with escalation info
  const updatedServiceCalls = serviceCalls.map((call) => {
    const matchingEscalation = updatedQueue.find(
      (e) => e.callId === call.id
    );
    if (matchingEscalation) {
      return {
        ...call,
        status: matchingEscalation.status,
        escalationLevel: matchingEscalation.currentLevel,
        currentDepartment: matchingEscalation.currentDepartment,
        currentEngineerId: matchingEscalation.currentEngineerId,
        currentEngineerName: matchingEscalation.currentEngineerName,
        escalationHistory: matchingEscalation.escalationHistory,
      };
    }
    return call;
  });

  return {
    updatedQueue,
    updatedServiceCalls,
    notifications,
    updated,
  };
}

// Calculate remaining time for active entries
function calculateTimers(escalationQueue) {
  const now = new Date();
  return escalationQueue
    .filter(
      (e) =>
        e.status !== "Resolved" &&
        e.status !== "Closed" &&
        e.status !== "Critical_Unresolved"
    )
    .map((entry) => {
      const deadline = new Date(entry.deadline);
      const remainingMs = Math.max(0, deadline - now);
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);

      return {
        callId: entry.callId,
        callNumber: entry.callNumber,
        remainingMs,
        remainingFormatted: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        currentLevel: entry.currentLevel,
        currentDepartment: entry.currentDepartment,
        currentEngineerName: entry.currentEngineerName,
        isUrgent: remainingMs < 5 * 60 * 1000, // Less than 5 min
        isExpired: remainingMs === 0,
        customerName: entry.customerName,
        priority: entry.priority,
      };
    });
}

// Listen for messages from main thread
self.addEventListener("message", (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "CHECK_ESCALATIONS": {
      const result = checkEscalations(data);
      self.postMessage({ type: "ESCALATION_RESULT", data: result });
      break;
    }
    case "GET_TIMERS": {
      const timers = calculateTimers(data.escalationQueue);
      self.postMessage({ type: "TIMER_UPDATE", data: timers });
      break;
    }
    case "PING": {
      self.postMessage({ type: "PONG" });
      break;
    }
  }
});

self.postMessage({ type: "WORKER_READY" });