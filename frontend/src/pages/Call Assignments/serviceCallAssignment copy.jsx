import React, { useState, useEffect, useMemo } from "react";
import {
  Search, X, User, CheckCircle, Clock,
  ArrowRight, Activity, Shield, Package,
  Layers, ChevronDown, ChevronUp, Users,
  AlertCircle, Tag, CheckSquare,
  MapPin, Phone, Calendar, AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants ──────────────────────────────────────────────────────────────────
const SERVICE_CALLS_KEY    = "service_calls_v2";
const EMPLOYEES_KEY        = "employees";
const ESCALATION_KEY       = "escalation_queue_v1";
const ESCALATION_FLOWS_KEY = "escalation_flows_v2";
const CUSTOMER_DB_KEY      = "customer_db_grouped_v5";

// ── Helpers ────────────────────────────────────────────────────────────────────
const lsLoad = (key, fb) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; }
  catch { return fb; }
};
const lsSave = (key, v) => localStorage.setItem(key, JSON.stringify(v));

const initials = (name = "") =>
  name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

const AVATAR_COLORS = [
  "from-blue-400 to-blue-600",   "from-purple-400 to-purple-600",
  "from-green-400 to-green-600", "from-orange-400 to-orange-600",
  "from-pink-400 to-pink-600",   "from-teal-400 to-teal-600",
  "from-yellow-400 to-yellow-600","from-red-400 to-red-600",
];
const avatarColor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const Avatar = ({ name, size = "md" }) => {
  const sz = {
    sm: "w-[1.4vw] h-[1.4vw] text-[0.55vw]",
    md: "w-[2vw]   h-[2vw]   text-[0.72vw]",
    lg: "w-[2.8vw] h-[2.8vw] text-[0.9vw]",
  };
  return (
    <div className={`rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center font-bold text-white flex-shrink-0 ${sz[size]}`}>
      {initials(name)}
    </div>
  );
};

// Segment color palette
const SEG_COLORS = [
  { badge: "bg-blue-100 text-blue-700 border-blue-300",   dot: "bg-blue-500",   ring: "ring-blue-200",   header: "bg-blue-50 border-blue-200"   },
  { badge: "bg-purple-100 text-purple-700 border-purple-300", dot: "bg-purple-500", ring: "ring-purple-200", header: "bg-purple-50 border-purple-200" },
  { badge: "bg-teal-100 text-teal-700 border-teal-300",   dot: "bg-teal-500",   ring: "ring-teal-200",   header: "bg-teal-50 border-teal-200"   },
  { badge: "bg-orange-100 text-orange-700 border-orange-300", dot: "bg-orange-500",ring: "ring-orange-200", header: "bg-orange-50 border-orange-200" },
  { badge: "bg-green-100 text-green-700 border-green-300",  dot: "bg-green-500",  ring: "ring-green-200",  header: "bg-green-50 border-green-200"  },
  { badge: "bg-pink-100 text-pink-700 border-pink-300",    dot: "bg-pink-500",   ring: "ring-pink-200",   header: "bg-pink-50 border-pink-200"   },
];
const getSegColor = (seg, allSegs) => {
  const idx = allSegs.indexOf(seg);
  return SEG_COLORS[(idx < 0 ? 0 : idx) % SEG_COLORS.length];
};

// ── Build segment groups from all calls ────────────────────────────────────────
// Returns: [{ groupKey, callId, callNumber, customerName, partyCode, priority,
//             dateTime, segment, products: [{p, productIdx}], colorIdx }]
const buildSegmentGroups = (calls) => {
  const groups = [];
  const segOrder = {};

  calls.forEach(c => {
    const prods = c.products || [];
    // Group unassigned products by segment within this call
    const segMap = {};
    prods.forEach((p, idx) => {
      if (!p._assigned && !p._supportRequested) {
        const seg = p.productSegment || "—";
        if (!segMap[seg]) segMap[seg] = [];
        segMap[seg].push({ p, productIdx: idx });
      }
    });

    Object.entries(segMap).forEach(([seg, items]) => {
      if (!segOrder[seg]) segOrder[seg] = Object.keys(segOrder).length;
      groups.push({
        groupKey: `${c.id}||${seg}`,
        callId: c.id,
        callNumber: c.callNumber,
        customerName: c.customerName,
        partyCode: c.partyCode,
        contactPerson: c.contactPerson || "",
        contactNumber: c.contactNumber || "",
        location: c.location || "",
        priority: c.priority,
        dateTime: c.dateTime,
        timestamp: c.timestamp,
        segment: seg,
        customerType: c.customerType || "All",
        products: items,
        colorIdx: segOrder[seg],
      });
    });
  });

  return groups;
};

export default function ServiceCallAssignment() {
  const [groups, setGroups]                 = useState([]);   // all unassigned segment groups
  const [employees, setEmployees]           = useState([]);
  const [selectedGroup, setSelectedGroup]   = useState(null);
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [searchTerm, setSearchTerm]         = useState("");
  const [engSearch, setEngSearch]           = useState("");
  const [isAssigning, setIsAssigning]       = useState(false);
  const [expandedGroup, setExpandedGroup]   = useState(null); // groupKey
  const [justAssigned, setJustAssigned]     = useState(null); // flash key
  const [resHours, setResHours]             = useState(0);    // local override
  const [resMins,  setResMins]              = useState(0);    // local override

  // All unique segment names (for color mapping)
  const allSegments = useMemo(() => {
    const s = new Set();
    groups.forEach(g => s.add(g.segment));
    return Array.from(s);
  }, [groups]);

  const [priorityFilter, setPriorityFilter] = useState("All");

  useEffect(() => {
    const calls = lsLoad(SERVICE_CALLS_KEY, []);
    setGroups(buildSegmentGroups(calls));
    setEmployees(lsLoad(EMPLOYEES_KEY, []));
  }, []);

  // ── Filter groups by search ────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    const s = searchTerm.toLowerCase();
    let res = groups;
    if (priorityFilter !== "All") {
      res = res.filter(g => g.priority === priorityFilter);
    }
    if (!s) return res;
    return res.filter(g =>
      g.callNumber.toLowerCase().includes(s) ||
      g.customerName.toLowerCase().includes(s) ||
      g.segment.toLowerCase().includes(s) ||
      g.products.some(({ p }) =>
        (p.productModel || p.itemCode || "").toLowerCase().includes(s)
      )
    );
  }, [groups, searchTerm, priorityFilter]);

  // ── Get the resolved SLA flow for the selected group ─────────────────────
  const selectedFlow = useMemo(() => {
    if (!selectedGroup) return null;
    const allFlows = lsLoad(ESCALATION_FLOWS_KEY, {});
    const custDb   = lsLoad(CUSTOMER_DB_KEY, []);
    const custRow  = custDb.find(r => r.partyCode === selectedGroup.partyCode);
    const partyType = custRow?.partyType || "Default";

    const flowKey        = `${partyType}|${selectedGroup.segment}`;
    const defaultFlowKey = `${partyType}|Default`;

    let flow = allFlows[flowKey];
    if (!flow || flow.length === 0) flow = allFlows[defaultFlowKey];
    if (!flow || flow.length === 0) flow = allFlows[partyType];

    if (!flow || flow.length === 0) {
      return [
        { dept: "Support Engineer", durationHours: 2, durationMins: 0 },
        { dept: "Service Engineer", durationHours: 4, durationMins: 0 },
        { dept: "R&D",              durationHours: 8, durationMins: 0 },
      ];
    }
    return flow;
  }, [selectedGroup]);

  // Sync resolution time whenever the flow changes
  useEffect(() => {
    if (selectedFlow?.[0]) {
      setResHours(selectedFlow[0].durationHours || 0);
      setResMins(selectedFlow[0].durationMins || 0);
    }
  }, [selectedFlow]);

  // ── Determine employees for a selected group ──────────────────────────────
  const processedEmployees = useMemo(() => {
    const queue = lsLoad(ESCALATION_KEY, []);
    
    // Count active tasks for each user across all calls in the queue
    const workloadMap = {};
    queue.forEach(q => {
      (q.products || []).forEach(p => {
        const assignedId = p._assignedEngineerId || q.currentEngineerId;
        if (assignedId && p.status !== "Rectified") {
           workloadMap[assignedId] = (workloadMap[assignedId] || 0) + 1;
        }
      });
    });

    if (!selectedGroup || !selectedFlow) {
      return employees.map(e => ({ ...e, activeTasks: workloadMap[e.userId] || 0 }));
    }

    const step0    = selectedFlow[0] || {};
    const l1Dept   = step0.dept;
    const l1EngIds = step0.engineerIds || [];

    return employees.map(e => {
      const activeTasks = workloadMap[e.userId] || 0;
      let isEligible = false;
      if (l1EngIds.length > 0) {
        isEligible = l1EngIds.includes(e.userId);
      } else if (l1Dept) {
        isEligible = e.department === l1Dept;
      }
      
      // Smart recommendation: eligibility + workload balance
      const isRecommended = isEligible && activeTasks < 3;
      
      return { ...e, isEligible, isRecommended, activeTasks };
    });
  }, [selectedGroup, selectedFlow, employees]);

  // Filter by search
  const filteredEmployees = useMemo(() => {
    const s = engSearch.toLowerCase();
    if (!s) return processedEmployees;
    return processedEmployees.filter(e =>
      e.name?.toLowerCase().includes(s) ||
      e.userId?.toLowerCase().includes(s) ||
      e.department?.toLowerCase().includes(s)
    );
  }, [processedEmployees, engSearch]);

  // ── Handle assignment ──────────────────────────────────────────────────────
  const handleAssign = () => {
    if (!selectedGroup || !selectedEngineer) return;
    setIsAssigning(true);

    setTimeout(() => {
      const now = new Date();

      // Resolve SLA flow for this group
      const masterFlow = selectedFlow;
      if (!masterFlow) return;

      const step0    = masterFlow[0];
      // Use the local state overrides instead of the default flow values
      const dur      = (resHours || 0) * 3600000 + (resMins || 0) * 60000;
      const deadline = new Date(now.getTime() + dur).toISOString();

      const escalationHistory = [{
        level:        0,
        department:   step0.dept,
        engineerId:   selectedEngineer.userId,
        engineerName: selectedEngineer.name,
        assignedAt:   now.toISOString(),
        deadline:     deadline,
        status:       "Pending",
      }];

      // 1. Update the call record (all products in this segment group)
      const allCalls    = lsLoad(SERVICE_CALLS_KEY, []);
      const updatedCalls = allCalls.map(c => {
        if (c.id !== selectedGroup.callId) return c;
        const prods = [...(c.products || [])];
        selectedGroup.products.forEach(({ productIdx }) => {
          prods[productIdx] = {
            ...prods[productIdx],
            _assigned:            true,
            _assignedAt:          now.toISOString(),
            _assignedEngineerId:  selectedEngineer.userId,
            _assignedEngineerName:selectedEngineer.name,
            _escalationLevel:     0,
            _escalationHistory:   escalationHistory,
            _currentDepartment:   step0.dept,
            _assignedSegment:     selectedGroup.segment,
          };
        });
        // Mark call as Assigned if at least one product is assigned
        return { 
          ...c, 
          status: "Assigned", 
          products: prods,
          currentEngineerId: selectedEngineer.userId,
          currentEngineerName: selectedEngineer.name,
          currentDepartment: step0.dept,
          escalationLevel: 0,
          deadline: deadline
        };
      });
      lsSave(SERVICE_CALLS_KEY, updatedCalls);

      // 2. Update / create escalation queue entry
      const existingQueue = lsLoad(ESCALATION_KEY, []);
      const qIdx = existingQueue.findIndex(e => e.callId === selectedGroup.callId);

      if (qIdx >= 0) {
        const existing = existingQueue[qIdx];
        const qProds   = [...(existing.products || [])];
        selectedGroup.products.forEach(({ productIdx }) => {
          qProds[productIdx] = {
            ...(qProds[productIdx] || {}),
            _assigned:            true,
            _assignedAt:          now.toISOString(),
            _assignedEngineerId:  selectedEngineer.userId,
            _assignedEngineerName:selectedEngineer.name,
            _escalationLevel:     0,
            _escalationHistory:   escalationHistory,
            _currentDepartment:   step0.dept,
            _assignedSegment:     selectedGroup.segment,
          };
        });
        existingQueue[qIdx] = { 
          ...existing, 
          products: qProds, 
          masterFlow,
          currentEngineerId: selectedEngineer.userId,
          currentEngineerName: selectedEngineer.name,
          currentDepartment: step0.dept,
          currentLevel: 0,
          deadline: deadline,
          status: "Assigned"
        };
      } else {
        // Build products array sized to the full call
        const callRecord  = allCalls.find(c => c.id === selectedGroup.callId);
        const qProds = (callRecord?.products || []).map((p, idx) => {
          const isInGroup = selectedGroup.products.some(({ productIdx }) => productIdx === idx);
          if (isInGroup) {
            return {
              ...p,
              _assigned:            true,
              _assignedAt:          now.toISOString(),
              _assignedEngineerId:  selectedEngineer.userId,
              _assignedEngineerName:selectedEngineer.name,
              _escalationLevel:     0,
              _escalationHistory:   escalationHistory,
              _currentDepartment:   step0.dept,
              _assignedSegment:     selectedGroup.segment,
            };
          }
          return { ...p, _escalationLevel: 0, _escalationHistory: [], _supportRequested: false, _resolved: false };
        });

        existingQueue.push({
          callId:        selectedGroup.callId,
          callNumber:    selectedGroup.callNumber,
          customerName:  selectedGroup.customerName,
          partyCode:     selectedGroup.partyCode,
          priority:      selectedGroup.priority,
          products:      qProds,
          contactPerson: selectedGroup.contactPerson,
          contactNumber: selectedGroup.contactNumber,
          location:      selectedGroup.location,
          masterFlow,
          status: "Assigned",
          currentEngineerId: selectedEngineer.userId,
          currentEngineerName: selectedEngineer.name,
          currentDepartment: step0.dept,
          currentLevel: 0,
          deadline: deadline,
          escalationHistory: escalationHistory
        });
      }
      lsSave(ESCALATION_KEY, existingQueue);

      // 3. Flash + remove from local state
      setJustAssigned(selectedGroup.groupKey);
      setTimeout(() => {
        setGroups(prev => prev.filter(g => g.groupKey !== selectedGroup.groupKey));
        setJustAssigned(null);
      }, 700);

      setSelectedGroup(null);
      setSelectedEngineer(null);
      setEngSearch("");
      setIsAssigning(false);
    }, 400);
  };

  const priorityBadge = (p) => ({
    Critical: "bg-red-100 text-red-600 border-red-200",
    High:     "bg-orange-100 text-orange-600 border-orange-200",
    Medium:   "bg-yellow-100 text-yellow-600 border-yellow-200",
    Low:      "bg-green-100 text-green-600 border-green-200",
  }[p] || "bg-gray-100 text-gray-500 border-gray-200");

  const getTypeColor = (type) => {
    switch (type) {
      case "OEM":           return "bg-blue-100 text-blue-700 border-blue-200";
      case "End Customer":  return "bg-green-100 text-green-700 border-green-200";
      case "Distributor":   return "bg-purple-100 text-purple-700 border-purple-200";
      case "Dealer":        return "bg-orange-100 text-orange-700 border-orange-200";
      default:              return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Group by callNumber for display (UI grouping)
  const groupedByCall = useMemo(() => {
    const map = {};
    filteredGroups.forEach(g => {
      if (!map[g.callId]) map[g.callId] = {
        callId: g.callId,
        callNumber: g.callNumber,
        customerName: g.customerName,
        customerType: g.customerType,
        priority: g.priority,
        dateTime: g.dateTime,
        segments: []
      };
      map[g.callId].segments.push(g);
    });
    return Object.values(map);
  }, [filteredGroups]);

  return (
    <div className="w-full h-full font-sans text-[0.85vw] flex gap-[1vw] bg-gray-50 overflow-hidden">

      {/* ── LEFT: Unassigned Segment Groups ────────────────────────────────── */}
      <div className="w-[38%] bg-white border-r border-gray-200 flex flex-col rounded-xl shadow-sm max-h-[90vh]">

        {/* Header */}
        <div className="px-[1.2vw] pt-[1vw] border-b border-gray-100 flex flex-col gap-[0.7vw]">
          {/* Sidebar Header */}
          <div className="mb-[1.5vw]">
            <div className="flex items-center justify-between mb-[1vw]">
              <div>
                <h2 className="text-[1.3vw] font-black text-gray-800 tracking-tight flex items-center gap-[0.5vw]">
                  <Layers className="w-[1.2vw] h-[1.2vw] text-indigo-500" /> Available for assignment
                </h2>
              
              </div>
              <div className="bg-indigo-50 text-indigo-600 text-[0.7vw] px-[0.6vw] py-[0.15vw] rounded-full font-bold border border-indigo-100 flex items-center gap-[0.3vw]">
                {/* <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-indigo-500 animate-pulse" /> */}
                {groups.length} 
              </div>
            </div>
            
            <div className="flex flex-col gap-[0.8vw]">
              <div className="relative group/search">
                <Search className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 w-[1vw] h-[1vw] text-gray-400 group-focus-within/search:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search customers, calls, segments…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-[0.7vw] pl-[2.4vw] pr-[1vw] py-[0.7vw] text-[0.82vw] outline-none focus:border-indigo-400 focus:ring-4 ring-indigo-50 transition-all shadow-sm"
                />
              </div>

              {/* Priority Tabs */}
              <div className="flex p-[0.3vw] bg-gray-100 rounded-[0.6vw] gap-[0.2vw]">
                {["All", "Critical", "High", "Medium"].map(p => {
                  const isActive = priorityFilter === p;
                  const count    = groups.filter(g => p === "All" ? true : g.priority === p).length;
                  return (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`flex-1 flex justify-center gap-[0.5vw] items-center py-[0.4vw] rounded-[0.4vw] transition-all cursor-pointer ${
                        isActive 
                          ? "bg-white text-indigo-600 shadow-sm border border-gray-200/50" 
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-200/50"
                      }`}
                    >
                      <span className="text-[0.7vw] font-bold">{p}</span>
                      <span className={`text-[0.55vw] font-black px-[0.5vw] py-[0.1vw] rounded-[0.4vw] ${isActive ? "bg-blue-500 text-white" : " bg-white text-gray-700"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-[0.8vw] py-[0.7vw] space-y-[0.8vw]">
          {groupedByCall.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[30vh] text-gray-300">
              <CheckCircle className="w-[2.5vw] h-[2.5vw] mb-[0.8vw] opacity-30" />
              <p className="text-[0.85vw] font-medium">All segments assigned!</p>
            </div>
          ) : (
            groupedByCall.map(callRow => (
              <div key={callRow.callId} className="border border-gray-100 rounded-[0.8vw] overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200">
                {/* Call header: Professional layout */}
                <div className="px-[1vw] py-[0.75vw] bg-gray-50 border-b border-gray-100 flex items-center justify-between group/call">
                  <div className="flex flex-col gap-[0.2vw]">
                    <div className="flex items-center gap-[0.6vw]">
                      <span className="font-mono text-[0.75vw] font-black text-indigo-600 tracking-tight">{callRow.callNumber}</span>
                      <div className="h-[0.7vw] w-[1px] bg-gray-200" />
                      <span className="text-[0.8vw] text-gray-800 font-black truncate max-w-[15vw] tracking-tight">{callRow.customerName}</span>
                    </div>
                    <div className="flex items-center gap-[0.4vw]">
                      <span className={`text-[0.52vw] px-[0.45vw] py-[0.05vw] rounded-full border font-black uppercase tracking-widest ${getTypeColor(callRow.customerType)}`}>
                        {callRow.customerType}
                      </span>
                      <span className={`text-[0.52vw] px-[0.45vw] py-[0.05vw] rounded-full border font-black uppercase tracking-widest ${priorityBadge(callRow.priority)}`}>
                        {callRow.priority}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-[1vw] h-[1vw] text-gray-300 group-hover/call:text-indigo-400 transition-colors" />
                </div>

                {/* Segment groups within this call */}
                <div className="divide-y divide-gray-100">
                  {callRow.segments.map(g => {
                    const sc        = getSegColor(g.segment, allSegments);
                    const isSelected = selectedGroup?.groupKey === g.groupKey;
                    const isExpanded = expandedGroup  === g.groupKey;
                    const isFlashing = justAssigned   === g.groupKey;

                    return (
                      <motion.div
                        key={g.groupKey}
                        animate={isFlashing ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? `bg-indigo-50 ring-2 ring-inset ring-indigo-300`
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          setSelectedGroup(isSelected ? null : g);
                          setSelectedEngineer(null);
                          setEngSearch("");
                        }}
                      >
                        <div className="px-[1vw] py-[0.85vw] flex items-center gap-[1vw]">
                          {/* Visual vertical bar indicator */}
                          {/* <div className={`w-[0.35vw] h-[2vw] rounded-full flex-shrink-0 ${sc.dot}`} /> */}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-[0.1vw]">
                              <span className="text-[0.85vw] font-black text-gray-800 tracking-tight">{g.segment}</span>
                              <div className="flex items-center gap-[0.3vw] bg-gray-100 px-[0.5vw] py-[0.1vw] rounded-full">
                                <Package className="w-[0.75vw] h-[0.75vw] text-gray-400" />
                                <span className="text-[0.65vw] text-gray-600 font-black">{g.products.length}</span>
                              </div>
                            </div>
                            {/* Product names preview */}
                            <div className="text-[0.68vw] text-gray-400 font-medium truncate">
                              {g.products.map(({ p }) => p.productModel || p.itemCode || "—").join(" · ")}
                            </div>
                          </div>

                          {/* Selection indicator */}
                          {isSelected ? (
                            <div className="w-[1.4vw] h-[1.4vw] rounded-full bg-indigo-600 flex items-center justify-center shadow-lg">
                              <ArrowRight className="w-[1vw] h-[1vw] text-white" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setExpandedGroup(isExpanded ? null : g.groupKey); }}
                              className="text-gray-400 hover:text-gray-600 p-[0.3vw] rounded hover:bg-gray-100 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-[1vw] h-[1vw]" /> : <ChevronDown className="w-[1vw] h-[1vw]" />}
                            </button>
                          )}
                        </div>

                        {/* Expanded product list */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className={`mx-[1vw] mb-[0.8vw] border rounded-[0.5vw] divide-y divide-gray-100 ${sc.header}`}>
                                {g.products.map(({ p, productIdx }) => (
                                  <div key={productIdx} className="px-[0.8vw] py-[0.5vw] flex items-center gap-[0.6vw]">
                                    <Package className="w-[0.85vw] h-[0.85vw] text-gray-400 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[0.75vw] font-bold text-gray-700 truncate">
                                        {p.productModel || p.itemCode || "—"}
                                      </div>
                                      {p.serialNumber && (
                                        <div className="text-[0.65vw] font-mono text-gray-400">SN: {p.serialNumber}</div>
                                      )}
                                    </div>
                                    {p.errorCode && (
                                      <span className="text-[0.6vw] bg-red-50 text-red-600 border border-red-100 px-[0.4vw] py-[0.05vw] rounded font-black tracking-wider">
                                        {p.errorCode}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Assignment Console ───────────────────────────────────────── */}
      <div className="flex-1 max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedGroup ? (
            <motion.div
              key={selectedGroup.groupKey}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-[1vw]"
            >
              {(() => {
                const sc = getSegColor(selectedGroup.segment, allSegments);
                return (
                  <div className={`rounded-[1vw] border ${sc.header} p-[1.5vw] shadow-sm relative overflow-hidden group/header`}>
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-[1vw]">
                        <div className="flex flex-col gap-[0.5vw]">
                          <div className="flex items-center gap-[0.8vw]">
                            <h3 className="text-[1.3vw] font-black text-gray-900 tracking-tight">{selectedGroup.customerName}</h3>
                            <div className="flex items-center gap-[0.4vw]">
                              <span className={`text-[0.62vw] px-[0.5vw] py-[0.1vw] rounded-full border font-bold ${getTypeColor(selectedGroup.customerType)}`}>
                                {selectedGroup.customerType}
                              </span>
                              <span className={`text-[0.62vw] px-[0.5vw] py-[0.1vw] rounded-full border font-bold ${priorityBadge(selectedGroup.priority)}`}>
                                {selectedGroup.priority}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-[1.2vw] text-[0.75vw] text-gray-500 font-medium">
                            <div className="flex items-center gap-[0.35vw] bg-white/60 px-[0.5vw] py-[0.1vw] rounded border border-white/40 shadow-sm">
                              <span className="text-gray-400 font-bold uppercase text-[0.6vw]">ID</span>
                              <span className="font-mono text-indigo-600 font-black">{selectedGroup.callNumber}</span>
                            </div>
                            <div className="flex items-center gap-[0.3vw]">
                              <Tag className="w-[0.9vw] h-[0.9vw] text-indigo-400" />
                              <span className="text-indigo-600 font-bold">{selectedGroup.segment}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => { setSelectedGroup(null); setSelectedEngineer(null); }}
                          className="w-[2vw] h-[2vw] flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all group/close cursor-pointer"
                        >
                          <X className="w-[1.1vw] h-[1.1vw] group-hover/close:scale-110 transition-transform" />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-[2vw] py-[1vw] border-y border-black/5 mb-[1vw]">
                        {selectedGroup.location && (
                          <div className="flex items-start gap-[0.5vw]">
                            <MapPin className="w-[0.9vw] h-[0.9vw] text-gray-400 shrink-0 mt-[0.15vw]" />
                            <div className="flex flex-col">
                              <span className="text-[0.6vw] text-gray-400 font-bold uppercase tracking-wider">Location</span>
                              <span className="text-[0.72vw] text-gray-700 font-medium line-clamp-2">{selectedGroup.location}</span>
                            </div>
                          </div>
                        )}
                        {selectedGroup.contactPerson && (
                          <div className="flex items-start gap-[0.5vw]">
                            <User className="w-[0.9vw] h-[0.9vw] text-gray-400 shrink-0 mt-[0.15vw]" />
                            <div className="flex flex-col">
                              <span className="text-[0.6vw] text-gray-400 font-bold uppercase tracking-wider">Contact</span>
                              <span className="text-[0.72vw] text-gray-700 font-medium truncate">{selectedGroup.contactPerson}</span>
                            </div>
                          </div>
                        )}
                        {selectedGroup.contactNumber && (
                          <div className="flex items-start gap-[0.5vw]">
                            <Phone className="w-[0.9vw] h-[0.9vw] text-gray-400 shrink-0 mt-[0.15vw]" />
                            <div className="flex flex-col">
                              <span className="text-[0.6vw] text-gray-400 font-bold uppercase tracking-wider">Phone</span>
                              <span className="text-[0.72vw] text-gray-700 font-medium font-mono">{selectedGroup.contactNumber}</span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-[0.5vw]">
                          <Calendar className="w-[0.9vw] h-[0.9vw] text-gray-400 shrink-0 mt-[0.15vw]" />
                          <div className="flex flex-col">
                            <span className="text-[0.6vw] text-gray-400 font-bold uppercase tracking-wider">Created On</span>
                            <span className="text-[0.72vw] text-gray-700 font-medium">
                              {new Date(selectedGroup.timestamp || selectedGroup.dateTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Products list with a more refined design */}
                      <div className="flex flex-wrap gap-[0.8vw]">
                        {selectedGroup.products.map(({ p, productIdx }) => (
                          <div key={productIdx} className="bg-white border border-black/5 rounded-[0.7vw] p-[0.8vw] shadow-sm min-w-[12vw] flex flex-col gap-[0.2vw] hover:border-indigo-200 transition-all">
                            <div className="text-[0.82vw] font-black text-gray-800 truncate">{p.productModel || p.itemCode || "—"}</div>
                            <div className="flex items-center gap-[0.4vw]">
                              <span className="text-[0.62vw] font-bold text-gray-400 bg-gray-50 px-[0.3vw] py-[0.05vw] rounded">SN</span>
                              <span className="text-[0.68vw] font-mono text-gray-600 font-medium">{p.serialNumber || "—"}</span>
                            </div>
                            {p.errorCode && (
                              <div className="flex items-center gap-[0.4vw] mt-[0.2vw]">
                                <AlertTriangle className="w-[0.7vw] h-[0.7vw] text-red-500" />
                                <span className="text-[0.68vw] font-mono text-red-600 font-black">Err: {p.errorCode}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-[1.2vw] flex items-center gap-[0.5vw] text-[0.68vw] text-gray-400 font-bold uppercase tracking-widest pl-[0.2vw]">
                      <Users className="w-[0.85vw] h-[0.85vw] text-indigo-400" />
                      <span>Collective Assignment • {selectedGroup.products.length} Items</span>
                    </div>
                  </div>
                );
              })()}

              {/* ── Employee Picker + Summary ─────────────────────────────── */}
              <div className="flex gap-[1vw] items-start">
                {/* Employee list */}
                <div className="w-[62%] bg-white rounded-[0.8vw] border border-gray-200 shadow-sm flex flex-col max-h-[55vh]">
                  <div className="p-[0.9vw] border-b border-gray-100">
                    <h4 className="text-[0.9vw] font-bold text-gray-800 mb-[0.6vw] flex items-center gap-[0.4vw]">
                      <User className="w-[0.95vw] h-[0.95vw] text-indigo-500" />
                      Select Employee
                      <span className="ml-auto text-[0.65vw] bg-gray-50 text-gray-400 border border-gray-200 px-[0.5vw] py-[0.05vw] rounded font-bold">
                        {employees.length} total
                      </span>
                    </h4>
                    <div className="relative">
                      <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search name, dept, ID…"
                        value={engSearch}
                        onChange={e => setEngSearch(e.target.value)}
                        className="w-full pl-[1.9vw] pr-[0.7vw] py-[0.4vw] bg-gray-50 border border-gray-200 rounded-[0.4vw] text-[0.78vw] outline-none focus:ring-2 ring-indigo-50 focus:border-indigo-300 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-[0.7vw] space-y-[0.35vw]">
                    {filteredEmployees.length === 0 ? (
                      <div className="text-center text-gray-400 text-[0.78vw] py-[2vw]">No employees found</div>
                    ) : (
                      // Sort: Eligible first, then alphabetically
                      [...filteredEmployees].sort((a,b) => (b.isEligible - a.isEligible) || a.name.localeCompare(b.name)).map(emp => (
                        <motion.div
                          key={emp.userId}
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => setSelectedEngineer(emp)}
                          className={`flex items-center gap-[0.7vw] p-[0.7vw] rounded-[0.5vw] border cursor-pointer transition-all ${
                            selectedEngineer?.userId === emp.userId
                              ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100"
                              : "bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className={`w-[2.2vw] h-[2.2vw] rounded-full bg-gradient-to-br ${(() => { const colors = ["from-blue-400 to-blue-600","from-purple-400 to-purple-600","from-green-400 to-green-600","from-orange-400 to-orange-600","from-pink-400 to-pink-600","from-teal-400 to-teal-600"]; let h = 0; for (let i = 0; i < emp.name.length; i++) h = emp.name.charCodeAt(i) + ((h << 5) - h); return colors[Math.abs(h) % colors.length]; })()} flex items-center justify-center text-white text-[0.8vw] font-bold shadow-sm relative`}>
                            {emp.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)}
                            {/* {emp.isEligible && (
                              <div className="absolute -top-[0.2vw] -right-[0.2vw] w-[0.7vw] h-[0.7vw] bg-green-500 rounded-full border-2 border-white shadow-sm" />
                            )} */}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-[0.4vw]">
                              <div className="text-[0.82vw] font-bold text-gray-800 truncate">{emp.name}</div>
                              {/* {emp.isRecommended && (
                                <div className="relative">
                                  <div className="absolute -inset-[0.15vw] bg-emerald-400/20 rounded-[0.4vw] blur-[0.3vw] animate-pulse" />
                                  <span className="relative flex items-center gap-[0.2vw] bg-emerald-500 text-white text-[0.45vw] px-[0.4vw] py-[0.08vw] rounded-[0.25vw] font-black tracking-wider shadow-sm shadow-emerald-200 border border-emerald-400">
                                    <CheckCircle className="w-[0.6vw] h-[0.6vw]" />
                                    RECOMMENDED
                                  </span>
                                </div>
                              )} */}
                              {emp.isEligible && !emp.isRecommended && (
                                <span className="text-[0.5vw] bg-blue-50 text-blue-600 border border-blue-200 px-[0.35vw] py-[0.02vw] rounded-full font-black uppercase tracking-wider">
                                  Eligible
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-[0.5vw]">
                              <div className="text-[0.68vw] text-gray-400 font-bold uppercase tracking-wider">{emp.department}</div>
                              <div className="h-[0.2vw] w-[0.2vw] bg-gray-300 rounded-full" />
                              <div className={`text-[0.68vw] font-black tracking-tight ${emp.activeTasks > 3 ? "text-orange-500" : "text-indigo-500"}`}>
                                {emp.activeTasks} Active Tasks
                              </div>
                            </div>
                          </div>
                          {selectedEngineer?.userId === emp.userId ? (
                            <CheckCircle className="w-[1.1vw] h-[1.1vw] text-indigo-500" />
                          ) : (
                            <div className="text-[0.62vw] text-gray-300 font-mono font-bold">{emp.userId}</div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                {/* Assignment Preview Card */}
                <div className="w-[38%] flex flex-col gap-[0.8vw]">
                  <div className="bg-white rounded-[0.8vw] border border-gray-200 p-[1.2vw] shadow-sm flex flex-col gap-[1.1vw]">
                    <div className="flex items-center gap-[0.5vw] border-b border-gray-100 pb-[0.8vw]">
                      <Shield className="w-[1vw] h-[1vw] text-indigo-500" />
                      <h4 className="text-[0.9vw] font-bold text-gray-800">Assignment View</h4>
                    </div>

                    <div className="space-y-[1vw]">
                      <div className="grid grid-cols-2 gap-[1vw]">
                        <div>
                          <div className="text-[0.6vw] text-gray-400 uppercase font-bold tracking-wider mb-[0.2vw]">Batch</div>
                          <div className="text-[0.8vw] font-bold text-gray-700">{selectedGroup.products.length} product{selectedGroup.products.length !== 1 ? "s" : ""}</div>
                        </div>
                        <div>
                          <div className="text-[0.6vw] text-gray-400 uppercase font-bold tracking-wider mb-[0.2vw]">Segment</div>
                          <div className="text-[0.8vw] font-bold text-gray-700 truncate" title={selectedGroup.segment}>{selectedGroup.segment}</div>
                        </div>
                      </div>

                      {/* SLA Control */}
                      <div className="bg-gray-50 border border-gray-100 rounded-[0.6vw] p-[0.8vw]">
                        <div className="flex items-center justify-between mb-[0.5vw]">
                          <span className="text-[0.62vw] text-gray-400 uppercase font-bold tracking-wider">Set Resolution SLA</span>
                          <Clock className="w-[0.75vw] h-[0.75vw] text-gray-400" />
                        </div>
                        <div className="flex items-center gap-[0.6vw]">
                          <div className="flex-1">
                            <label className="text-[0.55vw] text-gray-400 font-bold ml-[0.2vw]">HRS</label>
                            <input
                              type="number"
                              min="0"
                              value={resHours}
                              onChange={e => setResHours(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-white border border-gray-200 rounded-[0.4vw] px-[0.5vw] py-[0.35vw] text-[0.8vw] font-bold outline-none focus:border-indigo-400 transition-all"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[0.55vw] text-gray-400 font-bold ml-[0.2vw]">MINS</label>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={resMins}
                              onChange={e => setResMins(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                              className="w-full bg-white border border-gray-200 rounded-[0.4vw] px-[0.5vw] py-[0.35vw] text-[0.8vw] font-bold outline-none focus:border-indigo-400 transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[0.6vw] text-gray-400 uppercase font-bold tracking-wider mb-[0.4vw]">Final Allocation</div>
                        {selectedEngineer ? (
                          <div className="flex items-center gap-[0.5vw] bg-indigo-50 border border-indigo-100 px-[0.6vw] py-[0.5vw] rounded-[0.5vw]">
                            <div className="w-[1.8vw] h-[1.8vw] rounded-full bg-indigo-500 flex items-center justify-center text-white text-[0.65vw] font-bold flex-shrink-0">
                              {selectedEngineer.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[0.8vw] font-bold text-gray-800 truncate" title={selectedEngineer.name}>{selectedEngineer.name}</div>
                              <div className="text-[0.6vw] text-indigo-500 font-bold uppercase">{selectedEngineer.department}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-gray-200 rounded-[0.5vw] py-[1.2vw] text-center text-gray-300 text-[0.68vw] font-medium bg-gray-50/30 italic">
                            Waiting for selection
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={!selectedEngineer || isAssigning}
                      onClick={handleAssign}
                      className={`w-full mt-[0.5vw] py-[0.8vw] rounded-[0.6vw] flex items-center justify-center gap-[0.6vw] font-bold text-[0.85vw] transition-all active:scale-[0.98] ${
                        selectedEngineer && !isAssigning
                          ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md cursor-pointer"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                      }`}
                    >
                      {isAssigning ? (
                        <>
                          <div className="w-[1vw] h-[1vw] border-2 border-gray-300 border-t-white rounded-full animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>Assign {selectedGroup.products.length} Items <ArrowRight className="w-[1.1vw] h-[1.1vw]" /></>
                      )}
                    </button>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-[0.7vw] p-[0.8vw] flex gap-[0.6vw]">
                    <AlertCircle className="w-[1vw] h-[1vw] text-amber-500 shrink-0 mt-[0.1vw]" />
                    <div className="text-[0.65vw] text-amber-700 leading-tight">
                      This will assign products to <strong>{selectedEngineer?.name || "the selected engineer"}</strong> with a <strong>{resHours}h {resMins}m</strong> resolution window.
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full text-gray-300 pt-[6vw]"
            >
              <div className="w-[6vw] h-[6vw] bg-gray-100 rounded-full flex items-center justify-center mb-[1.2vw]">
                <Layers className="w-[3vw] h-[3vw] text-gray-200" />
              </div>
              <h3 className="text-[1.1vw] font-bold text-gray-400 uppercase tracking-[0.1vw]">Call Assignment</h3>
              <p className="text-[0.82vw] mt-[0.4vw] text-gray-400 text-center max-w-[18vw] leading-relaxed">
                Select a pending segment group from the list on the left to initialize assignment.
              </p>
              {groups.length > 0 && (
                <div className="mt-[1.5vw] flex items-center gap-[0.6vw] bg-white border border-gray-200 rounded-[0.7vw] px-[1.2vw] py-[0.6vw] shadow-sm">
                  <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-[0.75vw] text-gray-500 font-bold">
                    {groups.length} group{groups.length !== 1 ? "s" : ""} awaiting action
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}