import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AlertTriangle, Clock, User, Package, FileText, CheckCircle,
  History, Shield, ChevronDown, ChevronUp,
  RefreshCw, HelpCircle, Send, X, MapPin, Bell,
  CheckSquare, Wrench, BarChart2, Eye,
  AlertCircle, ChevronRight, Layers, Phone, Mail, Share2, Play
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useNotification } from "../components/NotificationContext";
import useEscalationWorker from "../service/useEscalationWorker";

const API_URL = import.meta.env.VITE_API_URL;

// ── Storage keys (Legacy) ──────────────────────────────────────────────────────────────
const EMPLOYEES_KEY        = "employees";
const ESCALATION_FLOWS_KEY = "escalation_flows_v2";

const RESOLUTION_TYPES = ["Fixed", "Replaced", "No Fault Found", "Partially Fixed"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const load  = (key, fb = []) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fb)); } catch { return fb; } };
const save  = (key, val)     => localStorage.setItem(key, JSON.stringify(val));

// ── Product status helper ─────────────────────────────────────────────────────
const getProductStatus = (prod) => {
  if (prod._resolved)                              return "resolved";
  if (prod._productClosure?.status === "Resolved" || prod._productClosure?.status === "Closed")  return "closed";
  if (prod._productClosure?.status === "Pending") return "pending";
  if (prod._supportRequested)                     return "support";
  if (prod._attended)                             return "attended";
  return "open";
};

const PROD_STATUS_CFG = {
  resolved: { dot: "bg-emerald-500",  label: "Resolved",    cls: "bg-emerald-50/70 border-emerald-350 text-emerald-800" },
  closed:   { dot: "bg-emerald-500",  label: "Resolved",    cls: "bg-emerald-50/70 border-emerald-350 text-emerald-800" },
  pending:  { dot: "bg-amber-500",    label: "Pending",     cls: "bg-amber-50/70 border-amber-350 text-amber-805"       },
  support:  { dot: "bg-blue-500",     label: "Support Req", cls: "bg-blue-50/70 border-blue-350 text-blue-800"         },
  attended: { dot: "bg-indigo-500",  label: "Attended",    cls: "bg-indigo-50/70 border-indigo-350 text-indigo-800"     },
  open:     { dot: "bg-rose-500",     label: "Open",        cls: "bg-rose-50/70 border-rose-350 text-rose-800"           },
};

// ── Badge Component ───────────────────────────────────────────────────────────
const Badge = ({ label, color = "gray" }) => {
  const map = {
    green:  "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border-emerald-350",
    blue:   "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border-blue-350",
    slate:  "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-400",
    gray:   "bg-slate-100 text-slate-750 border-slate-400",
    orange: "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-350",
    red:    "bg-gradient-to-r from-rose-50 to-red-50 text-rose-800 border-rose-350",
    indigo: "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-800 border-indigo-350",
  };
  return (
    <span className={`text-[0.68vw] px-[0.6vw] py-[0.2vw] rounded-full border font-bold whitespace-nowrap tracking-wide shadow-sm transition-all duration-300 ${map[color] || map.gray}`}>
      {label}
    </span>
  );
};

// ── Contact Info Container ─────────────────────────────────────────────────────
const ContactInfoBar = ({ entry }) => {
  if (!entry?.contactPerson && !entry?.contactNumber && !entry?.emailId && !entry?.location) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, y: -5 }} 
      animate={{ opacity: 1, y: 0 }}
      className="mx-[0.9vw] mb-[0.6vw] bg-slate-50/85 backdrop-blur-sm border border-slate-400 rounded-[0.6vw] px-[0.9vw] py-[0.6vw] flex items-center gap-[1.6vw] flex-wrap shadow-inner"
    >
      <span className="text-[0.62vw] font-black text-slate-500 uppercase tracking-wider flex-shrink-0">Contact Details</span>
      {entry.contactPerson && (
        <div className="flex items-center gap-[0.35vw] text-[0.75vw] text-slate-800 font-bold hover:text-slate-950 transition-colors">
          <User className="w-[0.85vw] h-[0.85vw] text-slate-650 flex-shrink-0" />
          <span>{entry.contactPerson}</span>
        </div>
      )}
      {entry.contactNumber && (
        <a href={`tel:${entry.contactNumber}`} className="flex items-center gap-[0.35vw] text-[0.75vw] text-slate-850 font-bold hover:text-indigo-700 transition-colors">
          <Phone className="w-[0.8vw] h-[0.8vw] text-slate-650 flex-shrink-0" />
          <span className="font-mono">{entry.contactNumber}</span>
        </a>
      )}
      {entry.emailId && (
        <a href={`mailto:${entry.emailId}`} className="flex items-center gap-[0.35vw] text-[0.75vw] text-slate-850 font-bold hover:text-indigo-700 transition-colors">
          <Mail className="w-[0.8vw] h-[0.8vw] text-slate-650 flex-shrink-0" />
          <span className="font-mono">{entry.emailId}</span>
        </a>
      )}
      {entry.location && (
        <div className="flex items-center gap-[0.35vw] text-[0.75vw] text-slate-800 font-bold">
          <MapPin className="w-[0.8vw] h-[0.8vw] text-slate-650 flex-shrink-0" />
          <span>{entry.location}</span>
        </div>
      )}
    </motion.div>
  );
};

// ── Per-product SLA Timer ──────────────────────────────────────────────────────
const ProductSLATimer = ({ product, globalTimer }) => {
  const lastEsc = product._escalationHistory?.[product._escalationHistory.length - 1];
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (product._attended) {
      setTimeLeft("attended");
      return;
    }
    if (!lastEsc?.assignedAt) return;
    const flows = load(ESCALATION_FLOWS_KEY, {});
    const allFlows = Object.values(flows).find(f => Array.isArray(f)) || [];
    const step = allFlows.find(s => s.dept === lastEsc.department);
    const durationMs = (step?.slaHours || 2) * 60 * 60 * 1000;
    const deadline = new Date(lastEsc.assignedAt).getTime() + durationMs;

    const update = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft("overdue"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [lastEsc, product._attended]);

  if (product._attended) {
    return (
      <div className="flex items-center gap-[0.25vw] px-[0.5vw] py-[0.2vw] rounded-[0.4vw] bg-emerald-50 text-emerald-700 border border-emerald-350 font-bold text-[0.68vw] shadow-sm">
        <CheckSquare className="w-[0.7vw] h-[0.7vw]" />
        Attended
      </div>
    );
  }

  if (!lastEsc && !globalTimer) return null;
  if (!lastEsc && globalTimer) {
    return (
      <div className={`flex items-center gap-[0.25vw] px-[0.5vw] py-[0.2vw] rounded-[0.4vw] font-mono text-[0.68vw] font-bold shadow-sm ${globalTimer.isExpired ? "bg-red-55 text-red-700 border border-red-350 animate-pulse" : globalTimer.isUrgent ? "bg-amber-55 text-amber-800 border border-amber-350" : "bg-blue-55 text-blue-700 border border-blue-350"}`}>
        <Clock className="w-[0.7vw] h-[0.7vw]" />
        {globalTimer.isExpired ? "Escalating" : globalTimer.remainingFormatted}
      </div>
    );
  }
  if (!timeLeft) return null;
  const isOverdue = timeLeft === "overdue";
  return (
    <div className={`flex items-center gap-[0.25vw] px-[0.5vw] py-[0.2vw] rounded-[0.4vw] font-mono text-[0.68vw] font-bold shadow-sm ${isOverdue ? "bg-red-55 text-red-700 border border-red-350 animate-pulse" : "bg-blue-55 text-blue-700 border border-blue-350"}`}>
      <Clock className="w-[0.7vw] h-[0.7vw]" />
      {isOverdue ? "SLA Breached" : timeLeft}
    </div>
  );
};

// ── Support Escalation Modal (per-product) ────────────────────────────────────
const SupportEscalationModal = ({ product, entry, currentUser, employees: propsEmployees, onConfirm, onClose, showAll = false }) => {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const emps = propsEmployees || load(EMPLOYEES_KEY, []);
    const flows = load(ESCALATION_FLOWS_KEY, {});
    const q = search.toLowerCase();
    const matchesSearch = (e) =>
      !q || e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q);
    if (showAll)
      return emps.filter((e) => e.userId !== currentUser?.userId && matchesSearch(e));
    const prodDept = product._currentDepartment || entry.currentDepartment;
    const allFlowsArr = Object.values(flows).find((f) => Array.isArray(f)) || [];
    const allowedDepts = new Set([prodDept]);
    const myIdx = allFlowsArr.findIndex((s) => s.dept === prodDept);
    if (myIdx >= 0 && myIdx + 1 < allFlowsArr.length)
      allowedDepts.add(allFlowsArr[myIdx + 1].dept);
    return emps.filter(
      (e) =>
        allowedDepts.has(e.department) &&
        e.userId !== currentUser?.userId &&
        matchesSearch(e)
    );
  }, [entry, product, currentUser, search, showAll, propsEmployees]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-[2vw]">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-[36vw] rounded-[1vw] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col border border-slate-400"
      >
        <div className="bg-slate-950 px-[1.4vw] py-[1vw] flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-[0.6vw]">
            <Share2 className="w-[1.2vw] h-[1.2vw] text-indigo-400" />
            <h3 className="text-[1vw] font-bold text-white tracking-tight">
              {showAll ? "Reassign Support Request" : "Request Support — This Product"}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer transition-colors p-[0.3vw] hover:bg-white/10 rounded-full">
            <X className="w-[1.1vw] h-[1.1vw]" />
          </button>
        </div>

        <div className="p-[1.4vw] flex flex-col gap-[1vw] overflow-y-auto flex-1">
          <div className="bg-indigo-50 border border-indigo-300 rounded-[0.5vw] p-[0.7vw] text-[0.72vw] text-indigo-900 leading-relaxed font-bold shadow-sm">
            <strong className="text-indigo-950">Scope:</strong>{" "}
            {showAll
              ? "Reassign this support request to any available person across departments."
              : "Only this product will be reassigned. Others remain with you."}
          </div>

          <div className="bg-slate-50 border border-slate-400 rounded-[0.6vw] p-[0.8vw] shadow-sm">
            <div className="text-[0.82vw] font-black text-slate-850">
              {product.productModel || product.itemCode}
            </div>
            {product.serialNumber && (
              <div className="text-[0.72vw] text-slate-700 font-mono font-bold mt-[0.15vw]">
                SN: {product.serialNumber}
              </div>
            )}
            {product.callDescription && (
              <div className="text-[0.72vw] text-slate-800 mt-[0.3vw] leading-relaxed italic border-t border-slate-400 pt-[0.3vw]">
                <strong className="text-slate-600 not-italic font-black">Issue:</strong> {product.callDescription}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-[0.4vw]">
            <label className="text-[0.78vw] font-black text-slate-800">
              Select Support Person <span className="text-indigo-650">*</span>
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or department…"
              className="w-full border border-slate-400 rounded-[0.5vw] px-[0.8vw] py-[0.5vw] text-[0.8vw] font-semibold outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all bg-white"
            />
            <div className="border border-slate-400 rounded-[0.5vw] max-h-[14vw] overflow-y-auto divide-y divide-slate-300 bg-white shadow-inner">
              {candidates.length === 0 ? (
                <div className="p-[1.2vw] text-center text-slate-600 font-bold text-[0.75vw]">
                  No eligible support personnel found
                </div>
              ) : (
                candidates.map((emp) => (
                  <div
                    key={emp.userId}
                    onClick={() => setSelectedPerson(emp)}
                    className={`flex items-center gap-[0.8vw] px-[0.9vw] py-[0.6vw] cursor-pointer transition-all
                      ${selectedPerson?.userId === emp.userId
                        ? "bg-indigo-50 border-l-[0.2vw] border-indigo-600 font-bold text-indigo-950"
                        : "hover:bg-slate-50 border-l-[0.2vw] border-transparent font-medium"
                      }`}
                  >
                    <div className="w-[1.8vw] h-[1.8vw] rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-white text-[0.58vw] font-bold">
                        {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.8vw] font-bold text-slate-850">{emp.name}</div>
                      <div className="text-[0.68vw] text-slate-650 font-bold">{emp.department} · {emp.userId}</div>
                    </div>
                    {selectedPerson?.userId === emp.userId && (
                      <CheckCircle className="w-[0.9vw] h-[0.9vw] text-indigo-600 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[0.3vw]">
            <label className="text-[0.78vw] font-black text-slate-800">
              Handover Notes <span className="text-indigo-650">*</span>
            </label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what you've tried, current status, or instructions..."
              className="border border-slate-400 rounded-[0.5vw] p-[0.7vw] text-[0.8vw] font-medium outline-none resize-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white"
            />
          </div>
        </div>

        <div className="px-[1.4vw] py-[0.8vw] border-t border-slate-400 bg-slate-50 flex justify-end gap-[0.7vw]">
          <button
            onClick={onClose}
            className="px-[1.2vw] py-[0.5vw] border border-slate-400 bg-white rounded-[0.5vw] text-[0.8vw] font-bold cursor-pointer hover:bg-slate-100 text-slate-700 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!selectedPerson) { alert("Please select a support person."); return; }
              if (!notes.trim()) { alert("Please add handover notes."); return; }
              onConfirm({ supportPerson: selectedPerson, notes });
            }}
            className="px-[1.2vw] py-[0.5vw] bg-indigo-600 hover:bg-indigo-700 text-white rounded-[0.5vw] text-[0.8vw] font-bold cursor-pointer flex items-center gap-[0.4vw] transition-colors shadow-md shadow-indigo-600/15"
          >
            <Send className="w-[0.85vw] h-[0.85vw]" />
            Assign Support
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Assign Field Visit Modal ──────────────────────────────────────────────────
const AssignVisitModal = ({ type, entry, product, currentUser, employees: propsEmployees, onSave, onClose, inlineMode = false }) => {
  const employees = propsEmployees || load(EMPLOYEES_KEY, []);
  const techEngs  = employees.filter(e => {
    const dept = (e.department || "").toLowerCase();
    return dept.includes("engineer") || dept.includes("service") || dept.includes("r&d") || dept.includes("support") || dept.includes("technician");
  });
  const [form, setForm] = useState({
    assignedTo: "", assignedToName: "",
    assignmentDate: new Date().toISOString().slice(0, 16),
    visitDate: "", diagnosisSummary: "",
  });
  const sf  = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isFV = type === "Field Visit";

  const formBody = (
    <div className="flex flex-col gap-[0.9vw]">
      {product && (
        <div className="border border-indigo-300 rounded-[0.5vw] p-[0.6vw] bg-gradient-to-r from-indigo-50 to-blue-50/30">
          <div className="text-[0.72vw] font-bold text-indigo-950">
            Product: <strong className="font-bold text-indigo-900">{product.productModel || product.itemCode}</strong>
            {product.serialNumber && <span className="ml-[0.5vw] font-mono text-[0.65vw] text-indigo-850 font-bold">SN: {product.serialNumber}</span>}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-[0.3vw]">
        <label className="text-[0.78vw] font-black text-slate-800">Assign To *</label>
        <select value={form.assignedTo} onChange={e => {
          const emp = techEngs.find(en => en.userId === e.target.value);
          sf("assignedTo", e.target.value); sf("assignedToName", emp?.name || "");
        }} className="border border-slate-400 rounded-[0.5vw] p-[0.6vw] text-[0.8vw] bg-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold">
          <option value="">-- Select specialist --</option>
          {techEngs.map(e => <option key={e.userId} value={e.userId}>{e.name} ({e.department})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-[0.8vw]">
        <div className="flex flex-col gap-[0.3vw]">
          <label className="text-[0.78vw] font-black text-slate-800">Assignment Date</label>
          <input type="datetime-local" value={form.assignmentDate} onChange={e => sf("assignmentDate", e.target.value)}
            className="border border-slate-400 rounded-[0.5vw] p-[0.6vw] text-[0.78vw] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white" />
        </div>
        <div className="flex flex-col gap-[0.3vw]">
          <label className="text-[0.78vw] font-black text-slate-800">{isFV ? "Visit Date" : "Received Date"}</label>
          <input type="date" value={form.visitDate} onChange={e => sf("visitDate", e.target.value)}
            className="border border-slate-400 rounded-[0.5vw] p-[0.6vw] text-[0.78vw] font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white" />
        </div>
      </div>
      <div className="flex flex-col gap-[0.3vw]">
        <label className="text-[0.78vw] font-black text-slate-800">Diagnosis Summary</label>
        <textarea rows="2" value={form.diagnosisSummary} onChange={e => sf("diagnosisSummary", e.target.value)}
          placeholder="Initial findings or instructions for the field visit..."
          className="border border-slate-400 rounded-[0.5vw] p-[0.6vw] text-[0.78vw] font-semibold outline-none resize-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white" />
      </div>
    </div>
  );

  const saveBtn = (
    <button onClick={() => { if (!form.assignedTo) { alert("Please select a person."); return; } onSave(form); }}
      className="px-[1.2vw] py-[0.5vw] bg-indigo-600 hover:bg-indigo-700 text-white rounded-[0.5vw] text-[0.8vw] font-bold cursor-pointer flex items-center gap-[0.4vw] transition-colors shadow-md shadow-indigo-600/15">
      <CheckCircle className="w-[0.85vw] h-[0.85vw]" />Save Assignment
    </button>
  );

  if (inlineMode) return (
    <div className="border border-indigo-300 rounded-[0.6vw] overflow-hidden bg-white mt-[0.6vw] shadow-sm">
      <div className="bg-slate-50 border-b border-indigo-300 px-[0.8vw] py-[0.5vw] flex justify-between items-center">
        <span className="text-[0.78vw] font-black text-slate-800">Assign {type}</span>
      </div>
      <div className="p-[0.8vw]">{formBody}<div className="flex justify-end mt-[0.8vw]">{saveBtn}</div></div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-[2vw]">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-[38vw] rounded-[1vw] shadow-2xl overflow-hidden border border-slate-400"
      >
        <div className="border-b border-slate-400 px-[1.4vw] py-[1vw] flex justify-between items-center bg-slate-50">
          <h3 className="text-[1vw] font-black text-slate-850">Assign {type}</h3>
          <button onClick={onClose} className="text-slate-550 hover:text-slate-800 p-[0.3vw] hover:bg-slate-100 rounded-full transition-all"><X className="w-[1.1vw] h-[1.1vw]" /></button>
        </div>
        <div className="p-[1.4vw]">{formBody}</div>
        <div className="px-[1.4vw] py-[0.8vw] border-t border-slate-400 flex justify-end gap-[0.7vw] bg-slate-50">
          <button onClick={onClose} className="px-[1.2vw] py-[0.5vw] border border-slate-400 rounded-[0.5vw] text-[0.8vw] font-bold bg-white hover:bg-slate-100 transition-colors shadow-sm">Cancel</button>
          {saveBtn}
        </div>
      </motion.div>
    </div>
  );
};

// ── Generic Issue Details Container ───────────────────────────────────────────
const IssueDetailsContainer = ({ product }) => {
  return (
    <div className="mt-[0.6vw] bg-slate-50 border border-slate-400 rounded-[0.5vw] px-[0.8vw] py-[0.6vw] shadow-inner">
      <div className="text-[0.65vw] font-black text-slate-500 uppercase tracking-widest mb-[0.3vw]">Reported Issue Details</div>
      <div className="text-[0.78vw] text-slate-850 leading-relaxed font-bold bg-white border border-slate-400 rounded-[0.4vw] p-[0.6vw] shadow-sm">
        {product.callDescription || "No description provided"}
      </div>
    </div>
  );
};

// ── Product Closure Panel ─────────────────────────────────────────────────────
const ProductClosurePanel = ({ prod, prodIdx, entry, currentUser, employees: propsEmployees, onAssignFieldVisit, onProductClose, onSupportRequest, onProductAttend }) => {
  const existing = prod._productClosure || {};
  const saved    = existing.status;
  const [selected, setSelected]             = useState("");
  const [remarks, setRemarks]               = useState(existing.remarks || "");
  const [notes, setNotes]                   = useState(""); // For Support Request
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [search, setSearch]                 = useState("");
  const [showDropdown, setShowDropdown]     = useState(false);
  const dropdownRef                         = useRef(null);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (saved === "Closed") return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-[0.6vw] bg-gradient-to-r from-emerald-50 to-teal-50/30 border border-emerald-350 rounded-[0.5vw] px-[0.8vw] py-[0.5vw] flex items-center gap-[0.6vw] shadow-sm"
    >
      <CheckCircle className="w-[0.9vw] h-[0.9vw] text-emerald-700 flex-shrink-0" />
      <span className="text-[0.75vw] font-bold text-emerald-800">Resolved & Closed</span>
      {existing.remarks && <span className="text-[0.7vw] text-emerald-700 truncate opacity-95 italic font-bold">· {existing.remarks}</span>}
    </motion.div>
  );

  const handleUpdate = (status, extra = {}) => {
    if (status === "Resolved" && !remarks.trim()) { alert("Resolution details required."); return; }
    if (status === "Pending"  && !remarks.trim()) { alert("Reason required for pending."); return; }

    const data = {
      status: status === "Resolved" ? "Closed" : status,
      remarks,
      ...extra,
      updatedAt: new Date().toISOString()
    };

    onProductClose(prodIdx, data);
    setSelected("");
  };

  const handleSupport = () => {
    if (!selectedPerson) { alert("Please select a support person."); return; }
    if (!notes.trim()) { alert("Please add handover notes."); return; }
    onSupportRequest(prodIdx, { supportPerson: selectedPerson, notes });
    setSelected("");
  };

  const candidates = useMemo(() => {
    const emps = propsEmployees || load(EMPLOYEES_KEY, []);
    const q = search.toLowerCase();
    return emps.filter(e => 
      e.userId !== currentUser?.userId && 
      (!q || e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q))
    );
  }, [currentUser, search, propsEmployees]);

  const tabs = [
    { k: "Open",       l: "Support",     e: "🔄", c: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/15" },
    { k: "Resolved",   l: "Resolve",     e: "✓", c: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/15" },
    { k: "Pending",    l: "Pending",     e: "⏸", c: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/15" },
    { k: "FVRequired", l: "Field Visit", e: "📍", c: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/15" },
  ];

  return (
    <div className="mt-[0.6vw] flex flex-col gap-[0.6vw]">
      {/* Attendance Guard */}
      {!prod._attended ? (
        <motion.div 
          initial={{ scale: 0.98, opacity: 0.9 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-indigo-50/70 via-blue-50/20 to-slate-50 border border-indigo-300 rounded-[0.6vw] p-[1.2vw] flex flex-col items-center justify-center text-center gap-[0.6vw] shadow-sm relative overflow-hidden"
        >
          <div className="absolute -right-[1vw] -top-[1vw] w-[4vw] h-[4vw] bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="w-[2.2vw] h-[2.2vw] rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 shadow-inner">
            <Play className="w-[1.1vw] h-[1.1vw] fill-indigo-650 animate-pulse ml-[0.1vw]" />
          </div>
          <div>
            <div className="text-[0.85vw] font-black text-slate-800 tracking-tight">Attend this Service Call</div>
            <p className="text-[0.72vw] text-slate-650 mt-[0.15vw] max-w-[90%] mx-auto font-bold">Acknowledge and attend to halt the auto-escalation timer.</p>
          </div>
          <button 
            onClick={() => onProductAttend(prodIdx)} 
            className="w-full py-[0.55vw] bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-[0.5vw] font-bold text-[0.75vw] transition-all duration-300 transform active:scale-95 shadow-md shadow-indigo-600/15 cursor-pointer flex items-center justify-center gap-[0.4vw]"
          >
            <CheckSquare className="w-[0.85vw] h-[0.85vw]" />
            Acknowledge & Attend
          </button>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-[0.4vw]">
            {tabs.map(t => (
              <button key={t.k} onClick={() => setSelected(selected === t.k ? "" : t.k)}
                className={`py-[0.5vw] text-[0.68vw] font-bold rounded-[0.5vw] border transition-all cursor-pointer flex items-center justify-center gap-[0.3vw] ${selected === t.k ? `${t.c}` : "bg-white border-slate-400 text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-400"}`}>
                <span className="text-[0.78vw]">{t.e}</span><span>{t.l}</span>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {selected === "Open" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-blue-50 border border-blue-300 rounded-[0.6vw] p-[0.8vw] space-y-[0.7vw] overflow-hidden shadow-inner">
                <div className="text-[0.65vw] font-black text-blue-900 uppercase tracking-tight">Request Support / Escalate</div>
                <div className="flex flex-col gap-[0.5vw]">
                  <div className="relative" ref={dropdownRef}>
                    <input 
                      type="text" 
                      value={search} 
                      onFocus={() => setShowDropdown(true)}
                      onChange={e => { setSearch(e.target.value); setSelectedPerson(null); setShowDropdown(true); }} 
                      placeholder="Search person or department..." 
                      className="w-full border border-slate-400 rounded-[0.5vw] px-[0.7vw] py-[0.5vw] text-[0.75vw] font-bold outline-none bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm" 
                    />
                    {showDropdown && candidates.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 border border-slate-400 bg-white rounded-b-[0.5vw] max-h-[12vw] overflow-y-auto divide-y divide-slate-200 shadow-lg mt-[-0.1vw]">
                        {candidates.map(emp => (
                          <div key={emp.userId} onClick={() => { setSelectedPerson(emp); setSearch(emp.name); setShowDropdown(false); }} className={`px-[0.7vw] py-[0.6vw] text-[0.72vw] font-bold cursor-pointer hover:bg-blue-50/65 flex justify-between items-center transition-colors ${selectedPerson?.userId === emp.userId ? "bg-blue-55 text-blue-950 font-black border-l-2 border-blue-600" : "text-slate-800"}`}>
                            <span>{emp.name} ({emp.department})</span>
                            {selectedPerson?.userId === emp.userId && <CheckCircle className="w-[0.75vw] h-[0.75vw] text-blue-750" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Provide handover notes..." className="w-full border border-slate-400 rounded-[0.5vw] p-[0.7vw] text-[0.75vw] font-semibold outline-none bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm resize-none" />
                </div>
                <button onClick={handleSupport} className="w-full py-[0.6vw] bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-[0.5vw] font-bold text-[0.75vw] hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/10 cursor-pointer">Assign Support Person</button>
              </motion.div>
            )}

            {selected === "Resolved" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-emerald-50 border border-emerald-300 rounded-[0.6vw] p-[0.8vw] space-y-[0.7vw] overflow-hidden shadow-inner">
                <div className="text-[0.65vw] font-black text-emerald-900 uppercase tracking-tight">Resolution Details</div>
                <textarea rows="3" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Enter details of fixed parts, logical adjustments, or resolution explanation..." className="w-full border border-slate-400 rounded-[0.5vw] p-[0.8vw] text-[0.78vw] font-semibold outline-none bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all shadow-sm resize-none" />
                <button onClick={() => handleUpdate("Resolved")} className="w-full py-[0.6vw] bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-[0.5vw] font-bold text-[0.75vw] hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/10 cursor-pointer">Confirm Resolution</button>
              </motion.div>
            )}

            {selected === "Pending" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-amber-50 border border-amber-300 rounded-[0.6vw] p-[0.8vw] space-y-[0.7vw] overflow-hidden shadow-inner">
                <div className="text-[0.65vw] font-black text-amber-900 uppercase tracking-tight">Pending Reason</div>
                <textarea rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Why is this call pending? (e.g., waiting for parts, client unavailable)" className="w-full border border-slate-400 rounded-[0.5vw] p-[0.7vw] text-[0.75vw] font-semibold outline-none bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all shadow-sm resize-none" />
                <button onClick={() => handleUpdate("Pending")} className="w-full py-[0.6vw] bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-[0.5vw] font-bold text-[0.75vw] hover:from-amber-600 hover:to-orange-655 transition-all shadow-md shadow-amber-500/10 cursor-pointer">Mark Pending</button>
              </motion.div>
            )}

            {selected === "FVRequired" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-[0.1vw] overflow-hidden">
                 <AssignVisitModal type="Field Visit" entry={entry} product={prod} currentUser={currentUser} employees={propsEmployees} inlineMode onClose={() => setSelected("")} onSave={f => { onAssignFieldVisit(f, prodIdx); handleUpdate("Field Visit Required", { visitDate: f.visitDate, assignedTo: f.assignedToName }); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

// ── Escalation Card ───────────────────────────────────────────────────────────
const EscalationCard = ({ entry, currentUser, employees, timer, isExpanded, onToggle, onSupportRequest, onAssignFieldVisit, onProductClose, onProductAttend, isPendingTab }) => {
  const [activeProductIdx, setActiveProductIdx] = useState(0);

  const isProductHandled = (p) => {
    if (isPendingTab) return p._productClosure?.status !== "Pending";
    return p._supportRequested || p._productClosure?.status === "Pending" || p._productClosure?.status === "Closed" || p._resolved;
  };

  const openProducts = useMemo(() => {
    const isAdmin = currentUser?.department === "Admin";
    return (entry.products || [])
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => {
        if (isProductHandled(p)) return false;
        if (isAdmin) return true;
        return p._assignedEngineerId === currentUser?.userId;
      });
  }, [entry.products, currentUser]);

  const clampedIdx    = Math.min(activeProductIdx, Math.max(0, openProducts.length - 1));
  const activeProdObj = openProducts[clampedIdx];
  const activeProd    = activeProdObj?.p;
  const safeActiveIdx = activeProdObj?.i ?? 0;

  return (
    <motion.div 
      layout
      transition={{ duration: 0.2 }}
      className={`bg-white rounded-[0.8vw] border overflow-hidden transition-all duration-300 ${entry.status === "Resolved" ? "border-emerald-350 shadow-md shadow-emerald-500/5 bg-gradient-to-br from-white to-emerald-50/10" : "border-slate-400 shadow-sm hover:shadow-md hover:border-slate-400 bg-gradient-to-br from-white to-slate-50/20"}`}
    >
      <div className="px-[1vw] pt-[0.9vw] pb-[0.7vw] cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={onToggle}>
        <div className="flex justify-between items-start">
          <div className="space-y-[0.3vw]">
            <div className="flex items-center gap-[0.5vw] flex-wrap">
              <span className="font-mono text-[0.9vw] font-black text-slate-900 tracking-tight">{entry.callNumber}</span>
              <Badge label={entry.priority} color={entry.priority === "Critical" ? "red" : "slate"} />
            </div>
            <div className="text-[0.75vw] text-slate-800 font-bold flex items-center gap-[0.25vw]">
              <User className="w-[0.75vw] h-[0.75vw] text-slate-650" />
              {entry.customerName}
            </div>
          </div>
          <div className="flex items-center gap-[0.6vw]">
            {timer && entry.status !== "Resolved" && (
              <div className={`flex items-center gap-[0.25vw] px-[0.6vw] py-[0.3vw] rounded-[0.4vw] font-mono text-[0.72vw] font-bold border shadow-sm ${timer.isExpired ? "bg-rose-55 text-rose-700 border-rose-350 animate-pulse" : "bg-blue-55 text-blue-705 border-blue-350"}`}>
                <Clock className="w-[0.78vw] h-[0.78vw]" />{timer.remainingFormatted}
              </div>
            )}
            <div className="p-[0.3vw] rounded-full hover:bg-slate-100 transition-colors">
              {isExpanded ? <ChevronUp className="w-[1.1vw] h-[1.1vw] text-slate-700" /> : <ChevronDown className="w-[1.1vw] h-[1.1vw] text-slate-700" />}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ContactInfoBar entry={entry} />

            <div className="border-t border-slate-400 bg-slate-50/40">
              {openProducts.length > 1 && (
                <div className="flex border-b border-slate-400 bg-white px-[0.9vw] pt-[0.6vw] gap-[0.3vw] overflow-x-auto">
                  {openProducts.map(({ i: realIdx, p }, tabIdx) => (
                    <button 
                      key={realIdx} 
                      onClick={() => setActiveProductIdx(tabIdx)} 
                      className={`flex items-center gap-[0.35vw] px-[0.9vw] py-[0.55vw] rounded-t-[0.5vw] border-b-2 text-[0.72vw] font-black transition-all whitespace-nowrap ${clampedIdx === tabIdx ? "border-indigo-600 text-indigo-800 bg-indigo-50 shadow-sm" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                    >
                      <span>P{realIdx + 1}</span>
                      {(p._assignedSegment || p.productSegment) && (
                        <span className="text-[0.6vw] bg-indigo-50 text-indigo-805 border border-indigo-350 px-[0.3vw] py-[0.05vw] rounded font-black shadow-sm">
                          {p._assignedSegment || p.productSegment}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {openProducts.length === 0 ? (
                <div className="p-[1.4vw] text-center text-[0.8vw] text-slate-600 font-bold">All products handled in this view.</div>
              ) : activeProd ? (
                <div className="p-[0.9vw] grid grid-cols-1 md:grid-cols-12 gap-[0.9vw]">
                  {/* Left Side: Product Information */}
                  <div className="md:col-span-7 space-y-[0.6vw]">
                    <div className="rounded-[0.6vw] border border-slate-400 bg-white p-[0.8vw] shadow-sm">
                      <div className="flex items-start justify-between mb-[0.5vw]">
                        <div className="text-[0.85vw] font-black text-slate-900 tracking-tight">{activeProd.productModel || activeProd.itemCode}</div>
                        <ProductSLATimer product={activeProd} globalTimer={timer} />
                      </div>
                      <div className="grid grid-cols-2 gap-[0.6vw] mb-[0.6vw] text-[0.72vw]">
                        {(activeProd._assignedSegment || activeProd.productSegment) && (
                          <div className="flex items-center gap-[0.35vw]">
                            <span className="font-bold text-slate-600">Segment:</span>
                            <span className="bg-indigo-50 text-indigo-800 px-[0.5vw] py-[0.15vw] rounded-full border border-indigo-350 font-bold text-[0.65vw] shadow-sm">{activeProd._assignedSegment || activeProd.productSegment}</span>
                          </div>
                        )}
                        {activeProd.errorCode && (
                          <div className="flex items-center gap-[0.35vw]">
                            <span className="font-bold text-slate-600">Error Code:</span>
                            <span className="bg-rose-50 text-rose-800 px-[0.5vw] py-[0.15vw] rounded-full border border-rose-350 font-mono font-bold text-[0.65vw] shadow-sm">{activeProd.errorCode}</span>
                          </div>
                        )}
                      </div>
                      <IssueDetailsContainer product={activeProd} />
                    </div>
                  </div>

                  {/* Right Side: Control & Closure Actions */}
                  <div className="md:col-span-5">
                    <ProductClosurePanel 
                      prod={activeProd} 
                      prodIdx={safeActiveIdx} 
                      entry={entry} 
                      currentUser={currentUser} 
                      employees={employees} 
                      onAssignFieldVisit={onAssignFieldVisit} 
                      onProductClose={onProductClose} 
                      onSupportRequest={onSupportRequest} 
                      onProductAttend={onProductAttend}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Tab Components ────────────────────────────────────────────────────────────
const PendingTab = ({ queue, currentUser, employees, onProductClose, onAssignFieldVisit, expandedCall, setExpanded, onSupportRequest, onProductAttend }) => {
  const items = queue.filter(e => {
    const hasUserProducts = (e.products || []).some(p => 
      p._assignedEngineerId === currentUser?.userId && 
      p._productClosure?.status === "Pending"
    );
    return hasUserProducts;
  });
  
  if (items.length === 0) return <div className="bg-white rounded-[0.8vw] p-[3vw] text-center border border-slate-400 text-slate-600 font-bold shadow-sm">No pending products.</div>;
  return (
    <div className="space-y-[0.8vw]">
      {items.map(e => <EscalationCard key={e.callId} entry={e} currentUser={currentUser} employees={employees} isPendingTab isExpanded={expandedCall === e.callId} onToggle={() => setExpanded(expandedCall === e.callId ? null : e.callId)} onProductClose={(pIdx, d) => onProductClose(e.callId, pIdx, d)} onAssignFieldVisit={(f, p) => onAssignFieldVisit(e.callId, f, p)} onSupportRequest={(p, d) => onSupportRequest(e.callId, p, d)} onProductAttend={(pIdx) => onProductAttend(e.callId, pIdx)} />)}
    </div>
  );
};

const SupportReqActionPanel = ({ req, currentUser, onDone }) => {
  const [action, setAction]         = useState(""); 
  const [resolutionType, setResType] = useState("Fixed");
  const [remarks, setRemarks]        = useState("");

  const handleClose = async () => {
    if (!remarks.trim()) { alert("Please provide resolution notes."); return; }
    try {
      await axios.patch(`${API_URL}/service-calls/support/${req._id}/resolve`, {
        status: "Resolved",
        resolutionNotes: remarks,
        resolutionType,
        resolvedAt: new Date().toISOString()
      });
      onDone();
    } catch (err) {
      alert("Failed to resolve support request");
    }
  };

  return (action === "close" ? (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="p-[0.7vw] border border-emerald-350 rounded-[0.5vw] bg-emerald-50/30 mt-[0.5vw] space-y-[0.6vw] shadow-inner overflow-hidden"
    >
       <div className="text-[0.68vw] font-black text-emerald-900 tracking-wider uppercase">Resolution Action</div>
       <div className="grid grid-cols-2 md:grid-cols-4 gap-[0.4vw]">
         {RESOLUTION_TYPES.map(t => (
           <button 
             key={t} 
             onClick={() => setResType(t)} 
             className={`py-[0.35vw] rounded-[0.4vw] border text-[0.65vw] transition-all font-bold cursor-pointer ${resolutionType === t ? "bg-emerald-600 border-emerald-650 text-white shadow-sm shadow-emerald-500/10" : "bg-white border-slate-400 text-slate-600 hover:bg-slate-50"}`}
           >
             {t}
           </button>
         ))}
       </div>
       <textarea rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Provide details of steps taken to resolve..." className="w-full border border-slate-400 rounded-[0.4vw] p-[0.5vw] text-[0.75vw] font-semibold outline-none bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 resize-none transition-all" />
       <button onClick={handleClose} className="w-full py-[0.5vw] bg-emerald-600 hover:bg-emerald-700 text-white rounded-[0.4vw] text-[0.75vw] font-bold transition-all shadow-md shadow-emerald-600/15 cursor-pointer">Confirm & Close Task</button>
    </motion.div>
  ) : (
    <button onClick={() => setAction("close")} className="self-start px-[0.9vw] py-[0.5vw] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-350 rounded-[0.5vw] text-[0.72vw] font-bold flex items-center gap-[0.3vw] transition-all mt-[0.5vw] cursor-pointer shadow-sm">
      <CheckCircle className="w-[0.8vw] h-[0.8vw]" /> Resolve Support Request
    </button>
  ));
};

const SupportRequestsTab = ({ currentUser, reqs, onRefresh }) => {
  const activeReqs = reqs.filter(r => r.status !== "Resolved");

  return (
    <div className="space-y-[0.8vw]">
      <div className="bg-white rounded-[0.8vw] p-[1vw] border border-slate-400 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-[0.6vw]">
          <div className="w-[2vw] h-[2vw] rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-300 shadow-sm">
            <HelpCircle className="w-[1.1vw] h-[1.1vw]" />
          </div>
          <h2 className="text-[1.1vw] font-black text-slate-800">Support Tasks Assigned to Me</h2>
        </div>
        <Badge label={`${activeReqs.length} Pending`} color="orange" />
      </div>
      {activeReqs.length === 0 ? <div className="bg-white rounded-[0.8vw] p-[3vw] text-center border border-slate-400 text-slate-600 font-bold shadow-sm">No open support requests at this time.</div> : (
        <div className="grid gap-[0.8vw]">
          {activeReqs.map(r => (
            <div key={r._id} className="bg-white rounded-[0.8vw] border border-slate-400 p-[1vw] shadow-sm flex flex-col gap-[0.6vw] transition-all hover:border-blue-400">
               <div className="flex justify-between items-start">
                 <div>
                   <div className="flex items-center gap-[0.5vw]">
                     <span className="text-[0.95vw] font-black text-slate-900 tracking-tight">{r.callNumber}</span>
                     {r.product && <span className="bg-slate-100 text-slate-800 px-[0.5vw] py-[0.15vw] rounded text-[0.65vw] border border-slate-400 font-mono font-bold shadow-sm">{r.product.productModel || r.product.itemCode}</span>}
                   </div>
                 </div>
                 <Badge label={r.status} color="blue" />
               </div>
               <div className="bg-amber-50/30 border border-amber-355 rounded-[0.5vw] p-[0.7vw] text-[0.75vw] text-slate-800 shadow-inner font-semibold">
                 <strong className="text-amber-955 font-black">Support Notes:</strong> {r.notes}
               </div>
               <SupportReqActionPanel req={r} currentUser={currentUser} onDone={onRefresh} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VisitsTab = ({ type, visits, onRefresh }) => {
  const activeVisits = visits.filter(v => v.visitStatus !== "Closed");

  const handleCloseVisit = async (visitId) => {
    try {
      await axios.patch(`${API_URL}/service-calls/field-visit/${visitId}/close`);
      onRefresh();
    } catch (err) {
      alert("Failed to close field visit");
    }
  };

  return (
    <div className="space-y-[0.8vw]">
      <div className="bg-white rounded-[0.8vw] p-[1vw] border border-slate-400 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-[0.6vw]">
          <div className="w-[2vw] h-[2vw] rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-300 shadow-sm">
            <MapPin className="w-[1.1vw] h-[1.1vw]" />
          </div>
          <h2 className="text-[1.1vw] font-black text-slate-800">{type} Schedule</h2>
        </div>
        <Badge label={`${activeVisits.length} Scheduled`} color="blue" />
      </div>
      {activeVisits.length === 0 ? <div className="bg-white rounded-[0.8vw] p-[3vw] text-center border border-slate-400 text-slate-600 font-bold shadow-sm">No upcoming field visits.</div> : (
        <div className="grid gap-[0.8vw]">
          {activeVisits.map(v => (
            <div key={v._id} className="bg-white rounded-[0.8vw] border border-slate-400 p-[1vw] shadow-sm flex flex-col gap-[0.7vw] hover:border-indigo-400 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[0.95vw] font-black text-slate-900 tracking-tight">{v.callNumber}</span>
                <Badge label={`Visit Date: ${new Date(v.visitDate).toLocaleDateString()}`} color="blue" />
              </div>
              <div className="text-[0.75vw] text-slate-800 font-semibold bg-blue-50/20 border border-blue-300 p-[0.7vw] rounded-[0.5vw] shadow-inner">
                <strong className="text-blue-950 font-black">Diagnosis / Visit Objective:</strong> {v.diagnosisSummary || "No objective details specified."}
              </div>
              <button 
                onClick={() => handleCloseVisit(v._id)} 
                className="self-start px-[0.9vw] py-[0.5vw] bg-emerald-50 border border-emerald-350 text-emerald-800 hover:bg-emerald-100 rounded-[0.5vw] text-[0.72vw] font-bold flex items-center gap-[0.3vw] transition-all cursor-pointer shadow-sm"
              >
                <CheckSquare className="w-[0.8vw] h-[0.8vw]" /> Mark Completed
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ReportsTab = ({ currentUser, queue, supportReqs, fieldVisits }) => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const uid = currentUser?.userId;
    if (!uid) return;
    const acts = [];

    // 1. Product Closures
    queue.forEach(e => {
      (e.products || []).forEach((p, i) => {
        if (p._assignedEngineerId === uid && p._productClosure?.updatedAt) {
           acts.push({
             id: `prod_${e.callId}_${i}_${p._productClosure.updatedAt}`,
             type: "Product Update",
             title: `Call ${e.callNumber} • ${p.productModel || p.itemCode}`,
             date: p._productClosure.updatedAt,
             details: p._productClosure.remarks,
             status: p._productClosure.status,
             color: p._productClosure.status === "Closed" ? "green" : (p._productClosure.status === "orange" ? "orange" : "blue")
           });
        }
      });
    });

    // 2. Resolved Support Requests
    const resolvedReqs = supportReqs.filter(r => r.status === "Resolved");
    resolvedReqs.forEach(r => {
      acts.push({
        id: `supp_${r._id}`,
        type: "Support Request Resolved",
        title: `Call ${r.callNumber} • Support Resolved`,
        date: r.resolvedAt || r.updatedAt,
        details: r.resolutionNotes,
        status: "Resolved",
        color: "green"
      });
    });

    // 3. Closed Field Visits
    const closedVisits = fieldVisits.filter(v => v.visitStatus === "Closed");
    closedVisits.forEach(v => {
      acts.push({
        id: `vis_${v._id}`,
        type: "Field Visit Completed",
        title: `Call ${v.callNumber} • Scheduled ${new Date(v.visitDate).toLocaleDateString()}`,
        date: v.closedAt || v.createdAt,
        details: v.diagnosisSummary || "No diagnosis provided.",
        status: "Completed",
        color: "green"
      });
    });

    // Sort by date (descending)
    acts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    setActivities(acts);
  }, [currentUser, queue, supportReqs, fieldVisits]);

  const stats = {
    total: activities.length,
    resolved: activities.filter(a => a.color === "green").length,
    pending: activities.filter(a => a.color === "orange" || a.color === "yellow").length,
  };

  return (
    <div className="space-y-[0.8vw]">
      <div className="bg-white rounded-[0.8vw] border border-slate-400 p-[1vw] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-[0.6vw]">
          <div className="w-[2vw] h-[2vw] rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 border border-indigo-300 shadow-sm animate-pulse">
            <BarChart2 className="w-[1.1vw] h-[1.1vw]" />
          </div>
          <h2 className="text-[1.1vw] font-bold text-slate-800">My Activity Report</h2>
        </div>
        <div className="flex gap-[0.6vw]">
           <div className="bg-blue-50 text-blue-800 border border-blue-300 px-[0.8vw] py-[0.35vw] rounded-[0.5vw] font-bold text-[0.75vw] shadow-sm">Total Actions: {stats.total}</div>
           <div className="bg-emerald-50 text-emerald-700 border border-emerald-350 px-[0.8vw] py-[0.35vw] rounded-[0.5vw] font-bold text-[0.75vw] shadow-sm">Resolved: {stats.resolved}</div>
           <div className="bg-amber-50 text-amber-800 border border-amber-350 px-[0.8vw] py-[0.35vw] rounded-[0.5vw] font-bold text-[0.75vw] shadow-sm">Pending: {stats.pending}</div>
        </div>
      </div>

      <div className="bg-white rounded-[0.8vw] border border-slate-400 shadow-sm overflow-hidden">
        {activities.length === 0 ? (
           <div className="p-[4vw] text-center text-slate-650">
              <History className="w-[3vw] h-[3vw] mx-auto mb-[0.8vw] opacity-40" />
              <div className="text-[0.9vw] font-bold">There is no recent activity logged.</div>
           </div>
        ) : (
           <div className="divide-y divide-slate-300 max-h-[60vh] overflow-y-auto pr-[0.3vw] shadow-inner bg-slate-50/10">
              {activities.map((act) => (
                <div key={act.id} className="p-[1vw] hover:bg-slate-50/60 transition-colors flex items-start gap-[0.9vw]">
                   <div className={`mt-[0.1vw] w-[2.2vw] h-[2.2vw] rounded-[0.6vw] flex items-center justify-center flex-shrink-0 shadow-sm
                      ${act.type.includes("Visit") ? "bg-blue-100 text-blue-800 border border-blue-350" :
                        act.type.includes("Support") ? "bg-amber-100 text-amber-850 border border-amber-350" : "bg-indigo-100 text-indigo-850 border border-indigo-350"}`}>
                      {act.type.includes("Visit") ? <MapPin className="w-[1.1vw] h-[1.1vw]" /> :
                       act.type.includes("Support") ? <HelpCircle className="w-[1.1vw] h-[1.1vw]" /> : <CheckCircle className="w-[1.1vw] h-[1.1vw]" />}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-[0.2vw]">
                          <div className="font-black text-[0.85vw] text-slate-900 tracking-tight">{act.title}</div>
                          <span className="text-[0.68vw] text-slate-600 font-extrabold bg-slate-100 border border-slate-400 px-[0.45vw] py-[0.1vw] rounded shadow-sm">
                            {act.date ? new Date(act.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown'}
                          </span>
                      </div>
                      <div className="flex items-center gap-[0.5vw] mb-[0.4vw]">
                         <span className="text-[0.65vw] font-bold text-slate-600 uppercase tracking-widest">{act.type}</span>
                         <Badge label={act.status} color={act.color} />
                      </div>
                      {act.details && (
                         <div className="text-[0.75vw] text-slate-850 bg-slate-50 border border-slate-400 p-[0.6vw] rounded-[0.5vw] mt-[0.4vw] italic font-bold shadow-inner">
                           "{act.details}"
                         </div>
                      )}
                   </div>
                </div>
              ))}
           </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const ServiceCallResponse = () => {
  const { timers }                  = useEscalationWorker();
  const [queue, setQueue]           = useState([]);
  const [activeTab, setActiveTab]   = useState("escalation");
  const [expandedCall, setExpanded] = useState(null);
  const [loggedInUser, setUser]     = useState(null);
  const [loading, setLoading]       = useState(true);

  const { toast }                   = useNotification();

  const [supportReqs, setSupportReqs] = useState([]);
  const [fieldVisits, setFieldVisits] = useState([]);
  const [employees, setEmployees]     = useState([]);

  useEffect(() => {
    const u = JSON.parse(sessionStorage.getItem("loggedInUser") || localStorage.getItem("loggedInUser") || "null");
    if (u) setUser(u);
    const ld = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/service-calls/active`);
        setQueue(data.map(call => ({ ...call, callId: call._id })));
        
        if (u?.userId) {
          const sRes = await axios.get(`${API_URL}/service-calls/support/${u.userId}`);
          setSupportReqs(sRes.data);
          const fRes = await axios.get(`${API_URL}/service-calls/field-visit/${u.userId}`);
          setFieldVisits(fRes.data);
        }

        // Fetch employees
        const empRes = await axios.get(`${API_URL}/auth/employees`);
        setEmployees(empRes.data);
        localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(empRes.data));
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    ld(); const iv = setInterval(ld, 3000); return () => clearInterval(iv);
  }, []);

  const myEscalations = useMemo(() => {
    const uid = loggedInUser?.userId;
    const isAdmin = loggedInUser?.department === "Admin";
    return queue.filter(e => {
      if (e.status === "Resolved") return false;
      
      if (isAdmin) {
        return (e.products || []).some(p => !p._resolved && p._productClosure?.status !== "Closed" && !p._supportRequested && !p._productClosure?.status);
      }
      
      const hasProductsForUser = (e.products || []).some(p => 
        p._assignedEngineerId === uid && 
        !p._resolved && 
        p._productClosure?.status !== "Closed" && 
        !p._supportRequested &&
        p._productClosure?.status !== "Pending"
      );
      
      return hasProductsForUser;
    });
  }, [queue, loggedInUser]);

  const liveCounts = useMemo(() => {
    const uid = loggedInUser?.userId;
    return {
      escalation: myEscalations.length,
      support:    supportReqs.filter(r => r.status !== "Resolved").length,
      fieldVisit: fieldVisits.filter(r => r.visitStatus !== "Closed").length,
      pending:    queue.filter(e => {
        return (e.products || []).some(p => 
          p._assignedEngineerId === uid && 
          p._productClosure?.status === "Pending"
        );
      }).length,
    };
  }, [queue, loggedInUser, myEscalations, supportReqs, fieldVisits]);

  const handleProductClose = async (callId, pIdx, d) => {
    try {
      await axios.patch(`${API_URL}/service-calls/${callId}/product/${pIdx}/close`, d);
      toast("Product status updated", "success");
      
      const { data } = await axios.get(`${API_URL}/service-calls/active`);
      setQueue(data.map(call => ({ ...call, callId: call._id })));
    } catch (err) {
      toast("Failed to update product status", "error");
    }
  };

  const handleProductAttend = async (callId, pIdx) => {
    try {
      await axios.patch(`${API_URL}/service-calls/${callId}/product/${pIdx}/attend`);
      toast("Call attended successfully", "success");
      
      const { data } = await axios.get(`${API_URL}/service-calls/active`);
      setQueue(data.map(call => ({ ...call, callId: call._id })));
    } catch (err) {
      toast("Failed to mark call as attended", "error");
    }
  };

  const handleSupportRequest = async (callId, pIdx, data) => {
    const entry = queue.find(e => e.callId === callId); if (!entry) return;
    try {
      await axios.post(`${API_URL}/service-calls/support`, {
        callId, callNumber: entry.callNumber, productIdx: pIdx,
        product: entry.products[pIdx], supportPerson: data.supportPerson, notes: data.notes
      });
      toast("Support request assigned", "success");
      
      const { data: qData } = await axios.get(`${API_URL}/service-calls/active`);
      setQueue(qData.map(call => ({ ...call, callId: call._id })));
      
      if (loggedInUser?.userId) {
        const sRes = await axios.get(`${API_URL}/service-calls/support/${loggedInUser.userId}`);
        setSupportReqs(sRes.data);
      }
    } catch (err) {
      toast("Failed to assign support request", "error");
    }
  };

  const handleAssignVisit = async (callId, type, form, productIdx) => {
    const entry = queue.find(e => e.callId === callId); if (!entry) return;
    try {
      await axios.post(`${API_URL}/service-calls/field-visit`, {
        callId, callNumber: entry.callNumber, productIdx, type, ...form
      });
      toast("Field visit assigned", "success");
      
      if (loggedInUser?.userId) {
        const fRes = await axios.get(`${API_URL}/service-calls/field-visit/${loggedInUser.userId}`);
        setFieldVisits(fRes.data);
      }
    } catch (err) {
      toast("Failed to assign field visit", "error");
    }
  };

  const tabs = [
    { id: "escalation", label: "Escalation/ Assignments", icon: Shield,    count: liveCounts.escalation, color: "from-blue-600 via-indigo-600 to-indigo-700 shadow-indigo-600/20" },
    { id: "pending",    label: "Pending Checks",          icon: AlertCircle,count: liveCounts.pending,    color: "from-amber-500 via-orange-500 to-orange-600 shadow-orange-600/20" },
    { id: "support",    label: "Support Desk",            icon: HelpCircle, count: liveCounts.support,    color: "from-sky-500 via-blue-500 to-indigo-500 shadow-blue-500/20" },
    { id: "fieldvisit", label: "Field Visits",            icon: MapPin,     count: liveCounts.fieldVisit, color: "from-indigo-600 via-violet-600 to-purple-600 shadow-indigo-600/20" },
    { id: "reports",    label: "Action Logs",             icon: BarChart2,  count: 0,                     color: "from-slate-800 to-slate-900 shadow-slate-900/20" },
  ];

  const refreshData = async () => {
    if (!loggedInUser?.userId) return;
    try {
      const { data } = await axios.get(`${API_URL}/service-calls/active`);
      setQueue(data.map(call => ({ ...call, callId: call._id })));
      
      const sRes = await axios.get(`${API_URL}/service-calls/support/${loggedInUser.userId}`);
      setSupportReqs(sRes.data);
      
      const fRes = await axios.get(`${API_URL}/service-calls/field-visit/${loggedInUser.userId}`);
      setFieldVisits(fRes.data);
    } catch(err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] bg-slate-100/70 p-[1.2vw] rounded-[1vw] border border-slate-400 shadow-inner">
        <RefreshCw className="w-[3vw] h-[3vw] text-indigo-650 animate-spin mb-[1vw]" />
        <span className="text-[1vw] font-bold text-slate-800">Fetching latest tasks...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-[0.85vw] bg-slate-100/70 p-[1.2vw] rounded-[1vw] border border-slate-400 shadow-inner">
      {/* Premium Glass-Effect Tab Container */}
      <div className="flex gap-[0.5vw] mb-[1.2vw] bg-white/80 backdrop-blur-md border border-slate-400 rounded-[0.8vw] p-[0.35vw] sticky top-0 z-10 shadow-sm">
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id)} 
            className={`flex-1 flex items-center justify-center gap-[0.5vw] py-[0.55vw] rounded-[0.5vw] font-bold transition-all duration-305 relative cursor-pointer overflow-hidden ${activeTab === t.id ? `bg-gradient-to-r ${t.color} text-white shadow-md` : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            {activeTab === t.id && (
              <motion.div 
                layoutId="activeTabGlow"
                className="absolute inset-0 bg-white/5 opacity-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <t.icon className="w-[1vw] h-[1vw]" />
            <span className="tracking-tight">{t.label}</span>
            {t.count > 0 && (
              <span className={`text-[0.65vw] px-[0.45vw] py-[0.05vw] rounded-full font-bold transition-colors ${activeTab === t.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-750"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto pr-[0.3vw] pb-[5vw]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-[0.8vw]"
          >
            {activeTab === "escalation" && (
              myEscalations.length === 0 ? (
                <div className="bg-white rounded-[0.8vw] p-[3vw] text-center border border-slate-400 text-slate-650 font-bold shadow-sm">
                  <p>No valid calls available in your queue to work on at this moment.</p>
                </div>
              ) : (
                myEscalations.map(e => (
                  <EscalationCard 
                    key={e.callId} 
                    entry={e} 
                    currentUser={loggedInUser} 
                    employees={employees} 
                    timer={timers.find(t => t.callId === e.callId)} 
                    isExpanded={expandedCall === e.callId} 
                    onToggle={() => setExpanded(expandedCall === e.callId ? null : e.callId)} 
                    onSupportRequest={(p, d) => handleSupportRequest(e.callId, p, d)} 
                    onAssignFieldVisit={(f, p) => handleAssignVisit(e.callId, "Field Visit", f, p)} 
                    onProductClose={(p, d) => handleProductClose(e.callId, p, d)} 
                    onProductAttend={(pIdx) => handleProductAttend(e.callId, pIdx)} 
                  />
                ))
              )
            )}
            {activeTab === "pending"    && <PendingTab queue={queue} currentUser={loggedInUser} employees={employees} onProductClose={handleProductClose} onAssignFieldVisit={handleAssignVisit} expandedCall={expandedCall} setExpanded={setExpanded} onSupportRequest={handleSupportRequest} onProductAttend={handleProductAttend} />}
            {activeTab === "support"    && <SupportRequestsTab currentUser={loggedInUser} reqs={supportReqs} onRefresh={refreshData} />}
            {activeTab === "fieldvisit" && <VisitsTab type="Field Visit" visits={fieldVisits} onRefresh={refreshData} />}
            {activeTab === "reports"    && <ReportsTab currentUser={loggedInUser} queue={queue} supportReqs={supportReqs} fieldVisits={fieldVisits} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ServiceCallResponse;