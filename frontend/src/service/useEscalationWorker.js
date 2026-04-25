import { useState, useEffect, useRef, useCallback } from "react";

const ESCALATION_KEY = "escalation_queue_v1";
const SERVICE_CALLS_KEY = "service_calls_v2";
const EMPLOYEES_KEY = "employees";
const NOTIFICATIONS_KEY = "escalation_notifications_v1";

export default function useEscalationWorker() {
  const workerRef = useRef(null);
  const intervalRef = useRef(null);
  const [timers, setTimers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isWorkerReady, setIsWorkerReady] = useState(false);

  // Track which timer-based notifications we've already emitted to avoid spamming
  const notifiedTimersRef = useRef({ reminder: new Set(), expired: new Set() });

  // Simple beep using WebAudio (best-effort; may be blocked without user gesture)
  const playBeep = (volume = 0.06, duration = 150, freq = 880) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.value = volume;
      o.frequency.value = freq;
      o.type = "sine";
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, duration);
    } catch (e) {
      // ignore audio errors (autoplay/policy may block sound)
      // console.warn("Audio not available", e);
    }
  };

  // Browser notification helpers
  const isNotificationSupported = typeof window !== "undefined" && "Notification" in window;

  const requestNotificationPermissionOnce = () => {
    try {
      if (!isNotificationSupported) return;
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  };

  const showBrowserNotification = (title, body, tag) => {
    try {
      if (!isNotificationSupported) return false;
      if (Notification.permission === "granted") {
        const n = new Notification(title, { body, tag, renotify: true });
        n.onclick = () => {
          try {
            window.focus();
            // navigate to escalation page where user can act on the call
            window.location.href = "/escalation";
            n.close();
          } catch (e) {
            // noop
          }
        };
        return true;
      }

      // If permission not decided, request but do not block
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            try {
              new Notification(title, { body, tag, renotify: true });
            } catch (e) {}
          }
        });
      }
    } catch (e) {
      // ignore
    }
    return false;
  };

  // ask once on load so user sees browser prompt early
  useEffect(() => {
    requestNotificationPermissionOnce();
  }, []);


  // Load existing notifications
  useEffect(() => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading notifications", e);
      }
    }
  }, []);

  // Initialize worker
  useEffect(() => {
    try {
      // Use Vite-compatible worker import so the worker JS is served (not index.html)
      workerRef.current = new Worker(new URL("./escalation-worker.js", import.meta.url), { type: "module" });

      workerRef.current.addEventListener("message", (e) => {
        const { type, data } = e.data;

        switch (type) {
          case "WORKER_READY":
            setIsWorkerReady(true);
            break;

          case "ESCALATION_RESULT":
            if (data.updated) {
              // Save updated queue
              localStorage.setItem(
                ESCALATION_KEY,
                JSON.stringify(data.updatedQueue)
              );
              // Save updated service calls
              localStorage.setItem(
                SERVICE_CALLS_KEY,
                JSON.stringify(data.updatedServiceCalls)
              );

              // Save notifications
              if (data.notifications.length > 0) {
                setNotifications((prev) => {
                  const updated = [...data.notifications, ...prev].slice(
                    0,
                    50
                  ); // Keep last 50
                  localStorage.setItem(
                    NOTIFICATIONS_KEY,
                    JSON.stringify(updated)
                  );
                  return updated;
                });

                // Browser notifications for escalations/critical events (include customer + error code)
                try {
                  const updatedCalls = data.updatedServiceCalls ||
                    JSON.parse(localStorage.getItem(SERVICE_CALLS_KEY) || "[]");

                  const logged = JSON.parse(sessionStorage.getItem("loggedInUser") || "null");

                  data.notifications.forEach((notif) => {
                    // only notify in-browser to the assigned engineer for that call
                    if (!logged) return;

                    const call = updatedCalls.find(
                      (c) => c.callNumber === notif.callNumber || c.id === notif.callId
                    );

                    const assignedId = call?.currentEngineerId || call?.assignedEngineer || notif.engineerId || null;

                    // show browser notification only if the logged-in user is the assigned engineer
                    if (!assignedId || logged.userId !== assignedId) return;

                    const errCode = call?.errorCode || call?.error || "";
                    const customer = notif.customerName || call?.customerName || "";

                    const title = notif.type === "critical"
                      ? `CRITICAL: ${notif.callNumber}`
                      : `Escalated to you: ${notif.callNumber}`;

                    // concise body: customer + problem code + short reason/message
                    const bodyParts = [];
                    if (customer) bodyParts.push(`Customer: ${customer}`);
                    if (errCode) bodyParts.push(`Problem code: ${errCode}`);
                    if (notif.message) bodyParts.push(notif.message.replace(/^Call\s+\S+\s*/, ""));
                    const body = bodyParts.join(" — ");

                    // show browser notification (best-effort)
                    showBrowserNotification(title, body, notif.callNumber);
                    // play a sound for escalation
                    playBeep(0.12, 360, notif.type === "critical" ? 320 : 520);
                  });
                } catch (e) {
                  console.error("Browser notification error", e);
                }
              }
            }
            break;

          case "TIMER_UPDATE":
            // update timers
            setTimers(data);

            // emit reminder / expiration notifications (debounced per-call)
            try {
              data.forEach((t) => {
                // Reminder when timer becomes urgent (first time)
                if (t.isUrgent && !notifiedTimersRef.current.reminder.has(t.callId)) {
                  const reminder = {
                    type: "reminder",
                    callNumber: t.callNumber,
                    message: `Reminder: ${t.callNumber} - ${t.remainingFormatted} remaining for ${t.currentDepartment}`,
                    timestamp: new Date().toISOString(),
                    priority: t.priority,
                  };
                  setNotifications((prev) => {
                    const updated = [reminder, ...prev].slice(0, 50);
                    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
                    return updated;
                  });

                  // NOTE: per user preference, do NOT show native browser notification for reminders — keep in-app only
                  notifiedTimersRef.current.reminder.add(t.callId);
                  playBeep(0.05, 220, 720);
                }

                // Expired (imminent escalation) — notify once
                if (t.isExpired && !notifiedTimersRef.current.expired.has(t.callId)) {
                  const expiredNotif = {
                    type: "escalation",
                    callNumber: t.callNumber,
                    message: `Timer expired for ${t.callNumber} — will escalate now`,
                    timestamp: new Date().toISOString(),
                    priority: t.priority,
                  };
                  setNotifications((prev) => {
                    const updated = [expiredNotif, ...prev].slice(0, 50);
                    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
                    return updated;
                  });

                  // browser notification for expiration (include customer + error code)
                  try {
                    const calls = JSON.parse(localStorage.getItem(SERVICE_CALLS_KEY) || "[]");
                    const call = calls.find((c) => c.callNumber === t.callNumber || c.id === t.callId);
                    const customer = t.customerName || call?.customerName || "";
                    const err = call?.errorCode || call?.error || "";
                    const logged = JSON.parse(localStorage.getItem("loggedInUser") || "null");

                    // Only show browser notification for expiry to the assigned engineer (per preference)
                    const assignedId = call?.currentEngineerId || call?.assignedEngineer || null;
                    const shouldNotify = logged && assignedId && logged.userId === assignedId;

                    if (shouldNotify) {
                      const bodyParts = [expiredNotif.message];
                      if (customer) bodyParts.push(`Customer: ${customer}`);
                      if (err) bodyParts.push(`Problem code: ${err}`);
                      showBrowserNotification(`Escalating: ${t.callNumber}`, bodyParts.join(" — "), t.callNumber + "-expired");
                    }
                  } catch (e) {
                    /* ignore */
                  }

                  notifiedTimersRef.current.expired.add(t.callId);
                  // stronger sound for expiration
                  playBeep(0.12, 420, 440);
                }

                // Clean-up flags if timer moves away from urgent/expired (call resolved/assigned/escalated)
                if (!t.isUrgent) notifiedTimersRef.current.reminder.delete(t.callId);
                if (!t.isExpired) notifiedTimersRef.current.expired.delete(t.callId);
              });
            } catch (e) {
              console.error("Timer notification error", e);
            }

            break;
        }
      });

      workerRef.current.addEventListener("error", (e) => {
        console.error("Escalation Worker Error:", e);
      });
    } catch (e) {
      console.error("Failed to create worker:", e);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Periodic check - every 1 second for timers, every 10 seconds for escalation
  useEffect(() => {
    if (!isWorkerReady) return;

    let tickCount = 0;

    intervalRef.current = setInterval(() => {
      tickCount++;

      const escalationQueue = JSON.parse(
        localStorage.getItem(ESCALATION_KEY) || "[]"
      );
      const employees = JSON.parse(
        localStorage.getItem(EMPLOYEES_KEY) || "[]"
      );
      const serviceCalls = JSON.parse(
        localStorage.getItem(SERVICE_CALLS_KEY) || "[]"
      );

      // Update timers every second
      workerRef.current?.postMessage({
        type: "GET_TIMERS",
        data: { escalationQueue },
      });

      // Check escalations every 10 seconds
      if (tickCount % 10 === 0) {
        workerRef.current?.postMessage({
          type: "CHECK_ESCALATIONS",
          data: { escalationQueue, employees, serviceCalls },
        });
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isWorkerReady]);

  // Resolve a call
  const resolveCall = useCallback((callId) => {
    const queue = JSON.parse(
      localStorage.getItem(ESCALATION_KEY) || "[]"
    );
    const updatedQueue = queue.map((entry) => {
      if (entry.callId === callId) {
        return {
          ...entry,
          status: "Resolved",
          resolvedAt: new Date().toISOString(),
        };
      }
      return entry;
    });
    localStorage.setItem(ESCALATION_KEY, JSON.stringify(updatedQueue));

    // Also update service calls
    const calls = JSON.parse(
      localStorage.getItem(SERVICE_CALLS_KEY) || "[]"
    );
    const updatedCalls = calls.map((call) => {
      if (call.id === callId) {
        return {
          ...call,
          status: "Resolved",
          resolvedAt: new Date().toISOString(),
        };
      }
      return call;
    });
    localStorage.setItem(SERVICE_CALLS_KEY, JSON.stringify(updatedCalls));

    setNotifications((prev) => {
      const notification = {
        type: "resolved",
        callNumber:
          updatedQueue.find((e) => e.callId === callId)?.callNumber || "",
        message: `Call resolved successfully`,
        timestamp: new Date().toISOString(),
      };
      const updated = [notification, ...prev].slice(0, 50);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
  }, []);

  return {
    timers,
    notifications,
    isWorkerReady,
    resolveCall,
    clearNotifications,
  };
}