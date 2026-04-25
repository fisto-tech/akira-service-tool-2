import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AlertTriangle, Clock, User, Package, FileText, CheckCircle,
  History, Shield, ChevronDown, ChevronUp,
  RefreshCw, HelpCircle, Send, X, MapPin, Bell,
  CheckSquare, Wrench, BarChart2, Eye,
  AlertCircle, ChevronRight, Layers, Phone, Mail, Share2,
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
  return "open";
};

const PROD_STATUS_CFG = {
  resolved: { dot: "bg-green-500",  label: "Resolved",    cls: "bg-green-50 border-green-300 text-green-700"    },
  closed:   { dot: "bg-green-500",  label: "Resolved",    cls: "bg-green-50 border-green-300 text-green-700"    },
  pending:  { dot: "bg-gray-500",   label: "Pending",     cls: "bg-gray-50 border-gray-300 text-gray-700"       },
  support:  { dot: "bg-blue-400",   label: "Support Req", cls: "bg-blue-50 border-blue-300 text-blue-700"       },
  open:     { dot: "bg-blue-400",   label: "Open",        cls: "bg-blue-50 border-blue-300 text-blue-700"       },
};

// ── Contact Info Container ─────────────────────────────────────────────────────
const ContactInfoBar = ({ entry }) => {
  if (!entry?.contactPerson && !entry?.contactNumber && !entry?.emailId && !entry?.location) return null;
  return (
    <div className="mx-[0.9vw] mb-[0.6vw] bg-slate-50 border border-slate-200 rounded-[0.45vw] px-[0.8vw] py-[0.5vw] flex items-center gap-[1.4vw] flex-wrap">
      <span className="text-[0.62vw] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">Contact</span>
      {entry.contactPerson && (
        <div className="flex items-center gap-[0.3vw] text-[0.75vw] text-slate-700">
          <User className="w-[0.8vw] h-[0.8vw] text-slate-400 flex-shrink-0" />
          <span className="font-semibold">{entry.contactPerson}</span>
        </div>
      )}
      {entry.contactNumber && (
        <div className="flex items-center gap-[0.3vw] text-[0.75vw] text-slate-700">
          <Phone className="w-[0.75vw] h-[0.75vw] text-slate-400 flex-shrink-0" />
          <span>{entry.contactNumber}</span>
        </div>
      )}
      {entry.emailId && (
        <div className="flex items-center gap-[0.3vw] text-[0.75vw] text-slate-700">
          <Mail className="w-[0.75vw] h-[0.75vw] text-slate-400 flex-shrink-0" />
          <span>{entry.emailId}</span>
        </div>
      )}
      {entry.location && (
        <div className="flex items-center gap-[0.3vw] text-[0.75vw] text-slate-700">
          <MapPin className="w-[0.75vw] h-[0.75vw] text-slate-400 flex-shrink-0" />
          <span>{entry.location}</span>
        </div>
      )}
    </div>
  );
};

// ── Per-product SLA Timer ──────────────────────────────────────────────────────
const ProductSLATimer = ({ product, globalTimer }) => {
  const lastEsc = product._escalationHistory?.[product._escalationHistory.length - 1];
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
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
  }, [lastEsc]);

  if (!lastEsc && !globalTimer) return null;
  if (!lastEsc && globalTimer) {
    return (
      <div className={`flex items-center gap-[0.25vw] px-[0.45vw] py-[0.2vw] rounded-[0.3vw] font-mono text-[0.68vw] font-bold ${globalTimer.isExpired ? "bg-red-100 text-red-600" : globalTimer.isUrgent ? "bg-gray-100 text-gray-700" : "bg-blue-50 text-blue-600"}`}>
        <Clock className="w-[0.7vw] h-[0.7vw]" />
        {globalTimer.isExpired ? "Escalating" : globalTimer.remainingFormatted}
      </div>
    );
  }
  if (!timeLeft) return null;
  const isOverdue = timeLeft === "overdue";
  return (
    <div className={`flex items-center gap-[0.25vw] px-[0.45vw] py-[0.2vw] rounded-[0.3vw] font-mono text-[0.68vw] font-bold ${isOverdue ? "bg-red-100 text-red-600 animate-pulse" : "bg-blue-50 text-blue-600"}`}>
      <Clock className="w-[0.7vw] h-[0.7vw]" />
      {isOverdue ? "SLA Breached" : timeLeft}
    </div>
  );
};

// ── Support Escalation Modal (per-product) ────────────────────────────────────
const SupportEscalationModal = ({ product, entry, currentUser, onConfirm, onClose, showAll = false }) => {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const emps = load(EMPLOYEES_KEY, []);
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
  }, [entry, product, currentUser, search, showAll]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white w-[34vw] rounded-[0.8vw] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="bg-gray-900 px-[1.2vw] py-[0.8vw] flex justify-between items-center">
          <div className="flex items-center gap-[0.6vw]">
            <Share2 className="w-[1.1vw] h-[1.1vw] text-white/80" />
            <h3 className="text-[0.95vw] font-bold text-white">
              {showAll ? "Reassign Support Request" : "Request Support — This Product"}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer transition-colors">
            <X className="w-[1.1vw] h-[1.1vw]" />
          </button>
        </div>

        <div className="p-[1.2vw] flex flex-col gap-[0.9vw] overflow-y-auto flex-1">
          <div className="bg-blue-50 border border-blue-200 rounded-[0.4vw] p-[0.6vw] text-[0.72vw] text-blue-700">
            <strong>Note:</strong>{" "}
            {showAll
              ? "Reassign this support request to any available person."
              : "Only this product will be reassigned. Others remain with you."}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-[0.5vw] p-[0.7vw]">
            <div className="text-[0.8vw] font-bold text-gray-800">
              {product.productModel || product.itemCode}
            </div>
            {product.serialNumber && (
              <div className="text-[0.7vw] text-gray-400 font-mono mt-[0.15vw]">
                SN: {product.serialNumber}
              </div>
            )}
            {product.callDescription && (
              <div className="text-[0.7vw] text-gray-600 mt-[0.25vw]">
                <strong>Issue:</strong> {product.callDescription}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-[0.4vw]">
            <label className="text-[0.78vw] font-semibold text-gray-700">
              Select Support Person <span className="text-blue-500">*</span>
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or department…"
              className="w-full border border-gray-300 rounded-[0.4vw] px-[0.8vw] py-[0.45vw] text-[0.8vw] outline-none focus:border-blue-400 transition-colors"
            />
            <div className="border border-gray-200 rounded-[0.4vw] max-h-[12vw] overflow-y-auto divide-y divide-gray-100">
              {candidates.length === 0 ? (
                <div className="p-[1vw] text-center text-gray-400 text-[0.75vw]">
                  No eligible support personnel found
                </div>
              ) : (
                candidates.map((emp) => (
                  <div
                    key={emp.userId}
                    onClick={() => setSelectedPerson(emp)}
                    className={`flex items-center gap-[0.7vw] px-[0.8vw] py-[0.55vw] cursor-pointer transition-all
                      ${selectedPerson?.userId === emp.userId
                        ? "bg-blue-50 border-l-[0.15vw] border-blue-500"
                        : "hover:bg-gray-50 border-l-[0.15vw] border-transparent"
                      }`}
                  >
                    <div className="w-[1.7vw] h-[1.7vw] rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[0.58vw] font-bold">
                        {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.8vw] font-semibold text-gray-800">{emp.name}</div>
                      <div className="text-[0.68vw] text-gray-400">{emp.department} · {emp.userId}</div>
                    </div>
                    {selectedPerson?.userId === emp.userId && (
                      <CheckCircle className="w-[0.9vw] h-[0.9vw] text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[0.3vw]">
            <label className="text-[0.78vw] font-semibold text-gray-700">
              Handover Notes <span className="text-blue-500">*</span>
            </label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the issue, what you've tried, what they need to know…"
              className="border border-gray-300 rounded-[0.4vw] p-[0.6vw] text-[0.8vw] outline-none resize-none focus:border-blue-400 transition-colors"
            />
          </div>
        </div>

        <div className="px-[1.2vw] py-[0.7vw] border-t border-gray-200 bg-gray-50 flex justify-end gap-[0.6vw]">
          <button
            onClick={onClose}
            className="px-[1.1vw] py-[0.45vw] border border-gray-300 bg-white rounded-[0.4vw] text-[0.8vw] font-medium cursor-pointer hover:bg-gray-100 text-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!selectedPerson) { alert("Please select a support person."); return; }
              if (!notes.trim()) { alert("Please add handover notes."); return; }
              onConfirm({ supportPerson: selectedPerson, notes });
            }}
            className="px-[1.1vw] py-[0.45vw] bg-gray-900 hover:bg-gray-800 text-white rounded-[0.4vw] text-[0.8vw] font-semibold cursor-pointer flex items-center gap-[0.35vw] transition-colors"
          >
            <Send className="w-[0.85vw] h-[0.85vw]" />
            Reassign Product
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Assign Field Visit Modal ──────────────────────────────────────────────────
const AssignVisitModal = ({ type, entry, product, currentUser, onSave, onClose, inlineMode = false }) => {
  const employees = load(EMPLOYEES_KEY, []);
  const techEngs  = employees.filter(e => ["Support Engineer", "Service Engineer", "R&D"].includes(e.department));
  const [form, setForm] = useState({
    assignedTo: "", assignedToName: "",
    assignmentDate: new Date().toISOString().slice(0, 16),
    visitDate: "", diagnosisSummary: "",
  });
  const sf  = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isFV = type === "Field Visit";

  const formBody = (
    <div className="flex flex-col gap-[0.8vw]">
      {product && (
        <div className="border rounded-[0.4vw] p-[0.55vw] bg-blue-50 border-blue-200">
          <div className="text-[0.72vw] font-semibold text-blue-700">
            Product: <strong>{product.productModel || product.itemCode}</strong>
            {product.serialNumber && <span className="ml-[0.4vw] font-mono text-[0.65vw] text-blue-700">SN: {product.serialNumber}</span>}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-[0.25vw]">
        <label className="text-[0.78vw] font-semibold text-gray-600">Assign To *</label>
        <select value={form.assignedTo} onChange={e => {
          const emp = techEngs.find(en => en.userId === e.target.value);
          sf("assignedTo", e.target.value); sf("assignedToName", emp?.name || "");
        }} className="border border-gray-300 rounded-[0.4vw] p-[0.55vw] text-[0.8vw] bg-white outline-none">
          <option value="">-- Select person --</option>
          {techEngs.map(e => <option key={e.userId} value={e.userId}>{e.name} ({e.department})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-[0.7vw]">
        <div className="flex flex-col gap-[0.25vw]">
          <label className="text-[0.78vw] font-semibold text-gray-600">Assignment Date</label>
          <input type="datetime-local" value={form.assignmentDate} onChange={e => sf("assignmentDate", e.target.value)}
            className="border border-gray-300 rounded-[0.4vw] p-[0.55vw] text-[0.78vw] outline-none" />
        </div>
        <div className="flex flex-col gap-[0.25vw]">
          <label className="text-[0.78vw] font-semibold text-gray-600">{isFV ? "Visit Date" : "Received Date"}</label>
          <input type="date" value={form.visitDate} onChange={e => sf("visitDate", e.target.value)}
            className="border border-gray-300 rounded-[0.4vw] p-[0.55vw] text-[0.78vw] outline-none" />
        </div>
      </div>
      <div className="flex flex-col gap-[0.25vw]">
        <label className="text-[0.78vw] font-semibold text-gray-600">Diagnosis Summary</label>
        <textarea rows="2" value={form.diagnosisSummary} onChange={e => sf("diagnosisSummary", e.target.value)}
          placeholder="Initial findings…"
          className="border border-gray-300 rounded-[0.4vw] p-[0.55vw] text-[0.78vw] outline-none resize-none" />
      </div>
    </div>
  );

  const saveBtn = (
    <button onClick={() => { if (!form.assignedTo) { alert("Please select a person."); return; } onSave(form); }}
      className="px-[1.1vw] py-[0.45vw] bg-gray-900 hover:bg-gray-800 text-white rounded-[0.4vw] text-[0.8vw] font-semibold cursor-pointer flex items-center gap-[0.35vw]">
      <CheckCircle className="w-[0.85vw] h-[0.85vw]" />Save Assignment
    </button>
  );

  if (inlineMode) return (
    <div className="border border-gray-200 rounded-[0.5vw] overflow-hidden bg-white mt-[0.5vw]">
      <div className="bg-gray-50 border-b border-gray-200 px-[0.7vw] py-[0.45vw] flex justify-between items-center">
        <span className="text-[0.78vw] font-bold text-gray-700">Assign {type}</span>
      </div>
      <div className="p-[0.75vw]">{formBody}<div className="flex justify-end mt-[0.7vw]">{saveBtn}</div></div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white w-[38vw] rounded-[0.8vw] shadow-2xl overflow-hidden">
        <div className="border-b px-[1.2vw] py-[0.8vw] flex justify-between items-center bg-gray-50">
          <h3 className="text-[0.95vw] font-bold text-gray-800">Assign {type}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-[1.1vw] h-[1.1vw]" /></button>
        </div>
        <div className="p-[1.2vw]">{formBody}</div>
        <div className="px-[1.2vw] py-[0.7vw] border-t border-gray-200 flex justify-end gap-[0.6vw]">
          <button onClick={onClose} className="px-[1.1vw] py-[0.45vw] border rounded-[0.4vw] text-[0.8vw] font-medium">Cancel</button>
          {saveBtn}
        </div>
      </div>
    </div>
  );
};

// ── Generic Issue Details Container ───────────────────────────────────────────
const IssueDetailsContainer = ({ product }) => {
  return (
    <div className="mt-[0.6vw] bg-slate-50 border border-slate-200 rounded-[0.4vw] px-[0.7vw] py-[0.5vw]">
      <div className="text-[0.65vw] font-bold text-slate-400 uppercase tracking-widest mb-[0.25vw]">Reported Issue</div>
      <div className="text-[0.78vw] text-slate-700 leading-relaxed font-medium bg-white border border-slate-100 rounded-[0.3vw] p-[0.4vw]">
        {product.callDescription || "No description provided"}
      </div>
    </div>
  );
};

// ── Badge ─────────────────────────────────────────────────────────────────────
const Badge = ({ label, color = "gray" }) => {
  const map = {
    green:  "bg-green-100 text-green-700 border-green-300",
    blue:   "bg-blue-100 text-blue-700 border-blue-300",
    slate:  "bg-slate-100 text-slate-600 border-slate-300",
    gray:   "bg-gray-100 text-gray-600 border-gray-300",
    orange: "bg-orange-100 text-orange-700 border-orange-300",
    red:    "bg-red-100 text-red-700 border-red-300",
  };
  return (
    <span className={`text-[0.68vw] px-[0.5vw] py-[0.15vw] rounded-full border font-semibold whitespace-nowrap ${map[color] || map.gray}`}>
      {label}
    </span>
  );
};

// ── Product Closure Panel ─────────────────────────────────────────────────────
const ProductClosurePanel = ({ prod, prodIdx, entry, currentUser, onAssignFieldVisit, onProductClose, onSupportRequest }) => {
  const existing = prod._productClosure || {};
  const saved    = existing.status;
  const [selected, setSelected]             = useState("");
  const [remarks, setRemarks]               = useState(existing.remarks || "");
  const [notes, setNotes]                   = useState(""); // For Support Request
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [search, setSearch]                 = useState("");

  if (saved === "Closed") return (
    <div className="mt-[0.5vw] bg-green-50 border border-green-200 rounded-[0.4vw] px-[0.7vw] py-[0.4vw] flex items-center gap-[0.5vw]">
      <CheckCircle className="w-[0.85vw] h-[0.85vw] text-green-600 flex-shrink-0" />
      <span className="text-[0.72vw] font-bold text-green-700">Resolved & Closed</span>
      {existing.remarks && <span className="text-[0.68vw] text-green-600 truncate opacity-70 italic">· {existing.remarks}</span>}
    </div>
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
    const emps = load(EMPLOYEES_KEY, []);
    const q = search.toLowerCase();
    if (!q || search === selectedPerson?.name) return [];
    return emps.filter(e => e.userId !== currentUser?.userId && (e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q)));
  }, [currentUser, search, selectedPerson]);

  const tabs = [
    { k: "Open",       l: "Open",        e: "🔄", c: "bg-blue-400" },
    { k: "Resolved",   l: "Resolved",    e: "✓", c: "bg-green-600" },
    { k: "Pending",    l: "Pending",     e: "⏸", c: "bg-yellow-500" },
    { k: "FVRequired", l: "Field Visit", e: "📍", c: "bg-blue-600" },
  ];

  return (
    <div className="mt-[0.6vw] flex flex-col gap-[0.5vw]">
      <div className="grid grid-cols-4 gap-[0.3vw]">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setSelected(selected === t.k ? "" : t.k)}
            className={`py-[0.5vw] text-[0.68vw] font-bold rounded-[0.4vw] border transition-all cursor-pointer flex items-center justify-center gap-[0.25vw] ${selected === t.k ? `${t.c} text-white shadow-sm` : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            <span className="text-[0.75vw]">{t.e}</span><span>{t.l}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selected === "Open" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-blue-50 border border-blue-200 rounded-[0.5vw] p-[0.7vw] space-y-[0.6vw] overflow-hidden">
            <div className="text-[0.65vw] font-bold text-blue-700 uppercase tracking-tight">Request Support / Escalate</div>
            <div className="flex flex-col gap-[0.4vw]">
              <div className="relative">
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setSelectedPerson(null); }} placeholder="Search person/department..." className="w-full border border-gray-200 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.75vw] outline-none bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm" />
                {candidates.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 border border-gray-200 bg-white rounded-b-[0.4vw] max-h-[10vw] overflow-y-auto divide-y divide-gray-50 shadow-lg mt-[-0.1vw]">
                    {candidates.map(emp => (
                      <div key={emp.userId} onClick={() => { setSelectedPerson(emp); setSearch(emp.name); }} className={`px-[0.6vw] py-[0.5vw] text-[0.72vw] cursor-pointer hover:bg-blue-50 flex justify-between items-center transition-colors ${selectedPerson?.userId === emp.userId ? "bg-blue-100 font-bold" : ""}`}>
                        <span>{emp.name} ({emp.department})</span>
                        {selectedPerson?.userId === emp.userId && <CheckCircle className="w-[0.75vw] h-[0.75vw] text-blue-600" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <textarea rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Provide handover notes..." className="w-full border border-gray-200 rounded-[0.4vw] p-[0.6vw] text-[0.75vw] outline-none bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm resize-none" />
            </div>
            <button onClick={handleSupport} className="w-full py-[0.55vw] bg-blue-600 text-white rounded-[0.4vw] font-bold text-[0.75vw] hover:bg-blue-700 transition-all shadow-sm">Assign Support Person</button>
          </motion.div>
        )}

        {selected === "Resolved" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-green-50 border border-green-200 rounded-[0.5vw] p-[0.7vw] space-y-[0.6vw] overflow-hidden">
            <div className="text-[0.65vw] font-bold text-green-700 uppercase tracking-tight">Resolution Details</div>
            <textarea rows="3" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Enter details of fixed parts, logic adjustments, or final outcome..." className="w-full border border-gray-200 rounded-[0.4vw] p-[0.7vw] text-[0.78vw] outline-none bg-white focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all shadow-sm resize-none" />
            <button onClick={() => handleUpdate("Resolved")} className="w-full py-[0.55vw] bg-green-600 text-white rounded-[0.4vw] font-bold text-[0.75vw] hover:bg-green-700 transition-all shadow-sm">Confirm Resolution</button>
          </motion.div>
        )}

        {selected === "Pending" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-yellow-50 border border-yellow-200 rounded-[0.5vw] p-[0.7vw] space-y-[0.6vw] overflow-hidden">
            <div className="text-[0.65vw] font-bold text-yellow-700 uppercase tracking-tight">Pending Reason</div>
            <textarea rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Why is this call pending? (e.g., waiting for parts, customer unavailable)" className="w-full border border-gray-200 rounded-[0.4vw] p-[0.6vw] text-[0.75vw] outline-none bg-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all shadow-sm resize-none" />
            <button onClick={() => handleUpdate("Pending")} className="w-full py-[0.55vw] bg-yellow-500 text-white rounded-[0.4vw] font-bold text-[0.75vw] hover:bg-yellow-600 transition-all shadow-sm">Mark Pending</button>
          </motion.div>
        )}

        {selected === "FVRequired" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-[0.1vw] overflow-hidden">
             <AssignVisitModal type="Field Visit" entry={entry} product={prod} currentUser={currentUser} inlineMode onClose={() => setSelected("")} onSave={f => { onAssignFieldVisit(f, prodIdx); handleUpdate("Field Visit Required", { visitDate: f.visitDate, assignedTo: f.assignedToName }); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Escalation Card ───────────────────────────────────────────────────────────
const EscalationCard = ({ entry, currentUser, timer, isExpanded, onToggle, onSupportRequest, onAssignFieldVisit, onProductClose, isPendingTab }) => {
  const [activeProductIdx, setActiveProductIdx] = useState(0);

  const isProductHandled = (p) => {
    if (isPendingTab) return p._productClosure?.status !== "Pending";
    return p._supportRequested || p._productClosure?.status === "Pending" || p._productClosure?.status === "Closed" || p._resolved;
  };
  // Filter to show only products assigned to the current user
  const openProducts = useMemo(() => {
    const isAdmin = currentUser?.department === "Admin";
    return (entry.products || [])
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => {
        // First check if product is handled
        if (isProductHandled(p)) return false;
        // Show all products to admin, but only assigned products to regular engineers
        if (isAdmin) return true;
        // For regular engineers, only show products assigned to them
        return p._assignedEngineerId === currentUser?.userId;
      });
  }, [entry.products, currentUser]);

  const clampedIdx    = Math.min(activeProductIdx, Math.max(0, openProducts.length - 1));
  const activeProdObj = openProducts[clampedIdx];
  const activeProd    = activeProdObj?.p;
  const safeActiveIdx = activeProdObj?.i ?? 0;

  return (
    <div className={`bg-white rounded-[0.6vw] border overflow-hidden transition-all ${entry.status === "Resolved" ? "border-green-300" : "border-gray-200 shadow-sm"}`}>
      <div className="px-[0.9vw] pt-[0.8vw] pb-[0.6vw] cursor-pointer" onClick={onToggle}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-[0.4vw] flex-wrap">
              <span className="font-mono text-[0.88vw] font-bold text-gray-800">{entry.callNumber}</span>
              <Badge label={entry.priority} color={entry.priority === "Critical" ? "red" : "slate"} />
            </div>
            <div className="text-[0.72vw] text-gray-600 mt-[0.15vw] font-medium"><User className="w-[0.72vw] h-[0.72vw] inline mr-[0.2vw] text-gray-400" />{entry.customerName}</div>
          </div>
          <div className="flex items-center gap-[0.5vw]">
            {timer && entry.status !== "Resolved" && (
              <div className={`flex items-center gap-[0.25vw] px-[0.5vw] py-[0.28vw] rounded-[0.4vw] font-mono text-[0.72vw] font-bold ${timer.isExpired ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                <Clock className="w-[0.78vw] h-[0.78vw]" />{timer.remainingFormatted}
              </div>
            )}
            {isExpanded ? <ChevronUp className="w-[1vw] h-[1vw] text-gray-400" /> : <ChevronDown className="w-[1vw] h-[1vw] text-gray-400" />}
          </div>
        </div>
      </div>

      {isExpanded && <ContactInfoBar entry={entry} />}

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/60">
          {openProducts.length > 1 && (
            <div className="flex border-b border-gray-200 bg-white px-[0.8vw] pt-[0.5vw] gap-[0.25vw] overflow-x-auto">
              {openProducts.map(({ i: realIdx, p }, tabIdx) => (
                <button key={realIdx} onClick={() => setActiveProductIdx(tabIdx)} className={`flex items-center gap-[0.3vw] px-[0.75vw] py-[0.45vw] rounded-t-[0.4vw] border-b-2 text-[0.72vw] font-semibold transition-all flex-wrap ${clampedIdx === tabIdx ? "border-gray-900 text-gray-900 bg-white" : "border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}>
                  <span>P{realIdx + 1}</span>
                  {(p._assignedSegment || p.productSegment) && <span className="text-[0.6vw] bg-blue-100 text-blue-700 px-[0.25vw] py-[0.05vw] rounded">{p._assignedSegment || p.productSegment}</span>}
                </button>
              ))}
            </div>
          )}

          {openProducts.length === 0 ? (
            <div className="p-[1vw] text-center text-[0.8vw] text-gray-400">All products handled in this view.</div>
          ) : activeProd ? (
            <div className="p-[0.8vw] space-y-[0.5vw]">
              <div className="rounded-[0.5vw] border p-[0.7vw] bg-white border-gray-200">
                <div className="flex items-start justify-between mb-[0.4vw]">
                   <div className="text-[0.82vw] font-bold text-gray-800">{activeProd.productModel || activeProd.itemCode}</div>
                </div>
                <div className="grid grid-cols-2 gap-[0.5vw] mb-[0.5vw] text-[0.72vw]">
                  {(activeProd._assignedSegment || activeProd.productSegment) && (
                    <div className="flex items-center gap-[0.3vw]">
                      <span className="font-semibold text-gray-600">Segment:</span>
                      <span className="bg-blue-100 text-blue-700 px-[0.4vw] py-[0.15vw] rounded-full font-semibold text-[0.65vw]">{activeProd._assignedSegment || activeProd.productSegment}</span>
                    </div>
                  )}
                  {activeProd.errorCode && (
                    <div className="flex items-center gap-[0.3vw]">
                      <span className="font-semibold text-gray-600">Error Code:</span>
                      <span className="bg-red-100 text-red-700 px-[0.4vw] py-[0.15vw] rounded-full font-mono font-semibold text-[0.65vw]">{activeProd.errorCode}</span>
                    </div>
                  )}
                </div>
                <IssueDetailsContainer product={activeProd} />
              </div>
              <ProductClosurePanel prod={activeProd} prodIdx={safeActiveIdx} entry={entry} currentUser={currentUser} onAssignFieldVisit={onAssignFieldVisit} onProductClose={onProductClose} onSupportRequest={onSupportRequest} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// ── Tab Components ────────────────────────────────────────────────────────────
const PendingTab = ({ queue, currentUser, onProductClose, onAssignFieldVisit, expandedCall, setExpanded, onSupportRequest }) => {
  // Filter to show only entries where currentUser has products pending closure
  const items = queue.filter(e => {
    const hasUserProducts = (e.products || []).some(p => 
      p._assignedEngineerId === currentUser?.userId && 
      p._productClosure?.status === "Pending"
    );
    return hasUserProducts;
  });
  
  if (items.length === 0) return <div className="bg-white rounded-[0.5vw] p-[3vw] text-center border border-gray-200 text-gray-400">No pending products.</div>;
  return (
    <div className="space-y-[0.8vw]">
      {items.map(e => <EscalationCard key={e.callId} entry={e} currentUser={currentUser} isPendingTab isExpanded={expandedCall === e.callId} onToggle={() => setExpanded(expandedCall === e.callId ? null : e.callId)} onProductClose={(pIdx, d) => onProductClose(e.callId, pIdx, d)} onAssignFieldVisit={(f, p) => onAssignFieldVisit(e.callId, f, p)} onSupportRequest={(p, d) => onSupportRequest(e.callId, p, d)} />)}
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
    <div className="p-[0.6vw] border border-green-200 rounded-[0.4vw] bg-green-50/60 mt-[0.4vw] space-y-[0.5vw]">
       <div className="text-[0.68vw] font-bold text-green-800 tracking-tight uppercase">Resolution Action</div>
       <div className="grid grid-cols-2 gap-[0.3vw]">
         {RESOLUTION_TYPES.map(t => <button key={t} onClick={() => setResType(t)} className={`py-[0.3vw] rounded-[0.3vw] border text-[0.65vw] transition-all font-medium ${resolutionType === t ? "bg-green-600 border-green-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{t}</button>)}
       </div>
       <textarea rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Final notes (what was done?)..." className="w-full border border-gray-300 rounded-[0.3vw] p-[0.45vw] text-[0.75vw] outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none transition-all" />
       <button onClick={handleClose} className="w-full py-[0.45vw] bg-green-600 hover:bg-green-700 text-white rounded-[0.3vw] text-[0.75vw] font-bold transition-all shadow-sm">Confirm & Close Task</button>
    </div>
  ) : (
    <button onClick={() => setAction("close")} className="self-start px-[0.85vw] py-[0.45vw] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-[0.4vw] text-[0.72vw] font-bold flex items-center gap-[0.3vw] transition-all mt-[0.4vw]">
      <CheckCircle className="w-[0.8vw] h-[0.8vw]" /> Resolve Request
    </button>
  ));
};

const SupportRequestsTab = ({ currentUser, reqs, onRefresh }) => {
  const activeReqs = reqs.filter(r => r.status !== "Resolved");

  return (
    <div className="space-y-[0.8vw]">
      <div className="bg-white rounded-[0.6vw] p-[1vw] border border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-[0.5vw]"><HelpCircle className="w-[1.2vw] h-[1.2vw] text-orange-500" /><h2 className="text-[1.1vw] font-bold text-gray-800">Support Requests</h2></div>
        <Badge label={`${activeReqs.length} Active`} color="orange" />
      </div>
      {activeReqs.length === 0 ? <div className="bg-white rounded-[0.5vw] p-[3vw] text-center border border-gray-100 text-gray-400">No open support requests at this time.</div> : (
        <div className="grid gap-[0.8vw]">
          {activeReqs.map(r => (
            <div key={r._id} className="bg-white rounded-[0.5vw] border border-gray-200 p-[0.8vw] shadow-sm flex flex-col gap-[0.5vw] transition-all hover:border-blue-300">
               <div className="flex justify-between items-start">
                 <div>
                   <div className="flex items-center gap-[0.4vw]">
                     <span className="text-[0.9vw] font-bold text-gray-800">{r.callNumber}</span>
                     {r.product && <span className="bg-gray-100 text-gray-700 px-[0.4vw] py-[0.1vw] rounded m-[0] text-[0.65vw] border border-gray-200 font-mono font-medium">{r.product.productModel || r.product.itemCode}</span>}
                   </div>
                 </div>
                 <Badge label={r.status} color="blue" />
               </div>
               <div className="bg-orange-50/50 border border-orange-100 rounded-[0.4vw] p-[0.6vw] text-[0.75vw] text-gray-700">
                 <strong className="text-orange-800">Support Notes:</strong> {r.notes}
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
      <div className="bg-white rounded-[0.6vw] p-[1vw] border border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-[0.5vw]"><MapPin className="w-[1.2vw] h-[1.2vw] text-blue-600" /><h2 className="text-[1.1vw] font-bold text-gray-800">{type} Schedule</h2></div>
        <Badge label={`${activeVisits.length} Scheduled`} color="blue" />
      </div>
      {activeVisits.length === 0 ? <div className="bg-white rounded-[0.5vw] p-[3vw] text-center border border-gray-100 text-gray-500">No upcoming field visits.</div> : (
        <div className="grid gap-[0.8vw]">
          {activeVisits.map(v => (
            <div key={v._id} className="bg-white rounded-[0.5vw] border border-gray-200 p-[0.8vw] shadow-sm flex flex-col gap-[0.6vw] hover:border-blue-300 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[0.95vw] font-bold text-gray-800">{v.callNumber}</span>
                <Badge label={`Scheduled: ${new Date(v.visitDate).toLocaleDateString()}`} color="blue" />
              </div>
              <div className="text-[0.75vw] text-gray-700 bg-blue-50/50 border border-blue-100 p-[0.6vw] rounded-[0.4vw]">
                <strong className="text-blue-800">Diagnosis Summary:</strong> {v.diagnosisSummary || "No summary provided."}
              </div>
              <button 
                onClick={() => handleCloseVisit(v._id)} 
                className="self-start px-[0.85vw] py-[0.45vw] bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-[0.4vw] text-[0.72vw] font-bold flex items-center gap-[0.3vw] transition-all">
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
             color: p._productClosure.status === "Closed" ? "green" : (p._productClosure.status === "Pending" ? "yellow" : "blue")
           });
        }
      });
    });

    // 2. Resolved Support Requests
    const resolvedReqs = supportReqs.filter(r => r.status === "Resolved");
    resolvedReqs.forEach(r => {
      acts.push({
        id: `sup_${r._id}`,
        type: "Support Resolved",
        title: `Call ${r.callNumber} • ${r.product?.productModel || 'Product'}`,
        date: r.resolvedAt,
        details: r.resolutionNotes ? `Resolution: ${r.resolutionNotes} (${r.resolutionType})` : `Resolved via ${r.resolutionType}`,
        status: "Resolved",
        color: "green"
      });
    });

    // 3. Completed Field Visits
    const completedVisits = fieldVisits.filter(v => v.visitStatus === "Closed");
    completedVisits.forEach(v => {
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
    pending: activities.filter(a => a.color === "yellow").length,
  };

  return (
    <div className="space-y-[0.8vw]">
      <div className="bg-white rounded-[0.6vw] border border-gray-200 p-[1vw] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-[0.5vw]">
          <BarChart2 className="w-[1.2vw] h-[1.2vw] text-purple-600" />
          <h2 className="text-[1.1vw] font-bold text-gray-800">My Activity Report</h2>
        </div>
        <div className="flex gap-[0.5vw]">
           <div className="bg-blue-50 text-blue-700 border border-blue-200 px-[0.7vw] py-[0.3vw] rounded-[0.4vw] font-bold text-[0.75vw]">Total: {stats.total}</div>
           <div className="bg-green-50 text-green-700 border border-green-200 px-[0.7vw] py-[0.3vw] rounded-[0.4vw] font-bold text-[0.75vw]">Resolved: {stats.resolved}</div>
           <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-[0.7vw] py-[0.3vw] rounded-[0.4vw] font-bold text-[0.75vw]">Pending: {stats.pending}</div>
        </div>
      </div>

      <div className="bg-white rounded-[0.6vw] border border-gray-200 shadow-sm overflow-hidden">
        {activities.length === 0 ? (
           <div className="p-[4vw] text-center text-gray-400">
              <History className="w-[3vw] h-[3vw] mx-auto mb-[0.6vw] opacity-20" />
              <div className="text-[0.9vw] font-medium">There is no recent activity logged.</div>
           </div>
        ) : (
           <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto pr-[0.2vw]">
             {activities.map((act) => (
               <div key={act.id} className="p-[1vw] hover:bg-gray-50 transition-colors flex items-start gap-[0.8vw]">
                  <div className={`mt-[0.2vw] w-[2.2vw] h-[2.2vw] rounded-[0.5vw] flex items-center justify-center flex-shrink-0
                     ${act.type.includes("Visit") ? "bg-blue-100 text-blue-600 border border-blue-200" :
                       act.type.includes("Support") ? "bg-orange-100 text-orange-600 border border-orange-200" : "bg-purple-100 text-purple-600 border border-purple-200"}`}>
                     {act.type.includes("Visit") ? <MapPin className="w-[1.1vw] h-[1.1vw]" /> :
                      act.type.includes("Support") ? <HelpCircle className="w-[1.1vw] h-[1.1vw]" /> : <CheckCircle className="w-[1.1vw] h-[1.1vw]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-[0.2vw]">
                        <div className="font-bold text-[0.85vw] text-gray-800 tracking-tight">{act.title}</div>
                        <span className="text-[0.68vw] text-gray-400 font-medium bg-gray-50 border border-gray-100 px-[0.4vw] py-[0.1vw] rounded">
                           {act.date ? new Date(act.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown'}
                        </span>
                     </div>
                     <div className="flex items-center gap-[0.5vw] mb-[0.4vw]">
                        <span className="text-[0.65vw] font-bold text-gray-500 uppercase tracking-widest">{act.type}</span>
                        <Badge label={act.status} color={act.color} />
                     </div>
                     {act.details && (
                        <div className="text-[0.75vw] text-gray-600 bg-gray-50/80 p-[0.5vw] rounded-[0.4vw] mt-[0.3vw] border border-gray-100 italic">
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

  const { toast }                   = useNotification();

  const [supportReqs, setSupportReqs] = useState([]);
  const [fieldVisits, setFieldVisits] = useState([]);

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
      } catch (err) {
        console.error("Error fetching data:", err);
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
        // Admin sees all unresolved with open products
        return (e.products || []).some(p => !p._resolved && p._productClosure?.status !== "Closed" && !p._supportRequested && !p._productClosure?.status);
      }
      
      // Regular engineers only see products assigned to them
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
    const isAdmin = loggedInUser?.department === "Admin";
    return {
      escalation: myEscalations.length,
      support:    supportReqs.filter(r => r.status !== "Resolved").length,
      fieldVisit: fieldVisits.filter(r => r.visitStatus !== "Closed").length,
      pending:    queue.filter(e => {
        // Count entries where the user has pending products
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
    { id: "escalation", label: "Escalation", icon: Shield,    count: liveCounts.escalation, color: "bg-blue-600" },
    { id: "pending",    label: "Pending",    icon: AlertCircle,count: liveCounts.pending,    color: "bg-yellow-500" },
    { id: "support",    label: "Support",    icon: HelpCircle, count: liveCounts.support,    color: "bg-orange-500" },
    { id: "fieldvisit", label: "Field Visit",icon: MapPin,     count: liveCounts.fieldVisit, color: "bg-blue-700" },
    { id: "reports",    label: "Reports",    icon: BarChart2,  count: 0,                     color: "bg-gray-600" },
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

  return (
    <div className="flex flex-col h-full text-[0.85vw]">
      <div className="flex gap-[0.4vw] mb-[1vw] bg-white border rounded-[0.6vw] p-[0.3vw] sticky top-0 z-10 shadow-sm">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 flex items-center justify-center gap-[0.5vw] py-[0.5vw] rounded-[0.4vw] font-bold transition-all cursor-pointer ${activeTab === t.id ? `${t.color} text-white shadow` : "text-gray-500 hover:bg-gray-50"}`}>
            <t.icon className="w-[1vw] h-[1vw]" />{t.label}
            {t.count > 0 && <span className={`text-[0.65vw] px-[0.4vw] rounded-full font-bold ${activeTab === t.id ? "bg-white text-gray-900" : "bg-gray-100 text-gray-500"}`}>{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pr-[0.3vw] pb-[5vw]">
        {activeTab === "escalation" && myEscalations.map(e => <EscalationCard key={e.callId} entry={e} currentUser={loggedInUser} timer={timers.find(t => t.callId === e.callId)} isExpanded={expandedCall === e.callId} onToggle={() => setExpanded(expandedCall === e.callId ? null : e.callId)} onSupportRequest={(p, d) => handleSupportRequest(e.callId, p, d)} onAssignFieldVisit={(f, p) => handleAssignVisit(e.callId, "Field Visit", f, p)} onProductClose={(p, d) => handleProductClose(e.callId, p, d)} />)}
        {activeTab === "pending"    && <PendingTab queue={queue} currentUser={loggedInUser} onProductClose={handleProductClose} onAssignFieldVisit={handleAssignVisit} expandedCall={expandedCall} setExpanded={setExpanded} onSupportRequest={handleSupportRequest} />}
        {activeTab === "support"    && <SupportRequestsTab currentUser={loggedInUser} reqs={supportReqs} onRefresh={refreshData} />}
        {activeTab === "fieldvisit" && <VisitsTab type="Field Visit" visits={fieldVisits} onRefresh={refreshData} />}
        {activeTab === "reports"    && <ReportsTab currentUser={loggedInUser} queue={queue} supportReqs={supportReqs} fieldVisits={fieldVisits} />}
      </div>
    </div>
  );
};

export default ServiceCallResponse;