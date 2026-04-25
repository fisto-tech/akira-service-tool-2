// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, Trash2, Save, ArrowLeft, Plus, User, Package, ChevronDown, Wrench,
  ChevronUp, Eye, Target, ClipboardList, Edit3, Clock, History, FileText, AlertCircle, CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotification } from "../components/NotificationContext";

// Storage Keys
const PM_INWARD_KEY = "production_material_nc_v2";
const CUSTOMER_DB_KEY = "customer_db_grouped_v5";
const EMPLOYEES_KEY = "employees";
const STAGE_MASTER_KEY = "production_material_stage_options_v1";
const DISPOSITION_MASTER_KEY = "production_material_disposition_options_v1";

const DEFAULT_STAGE_OPTIONS = ["SMD", "WS", "MS", "SRV-Testing", "SRV-FI", "STA-Testing", "STA-FI", "MPR-CVR", "MPR-Testing", "MPR-FI", "Panel-WA", "Panel-Integration", "Panel-Testing", "Panel-FI"];
const DEFAULT_DISPOSITION_OPTIONS = ["Spare Replacement", "Rework Required", "Client Approval Pending", "No Change", "Accepted"];
const STAGE_OPTIONS = DEFAULT_STAGE_OPTIONS;
const FINAL_STATUS_OPTIONS = ["Pending", "Rejected", "Completed"];
const FINAL_STATUS_COLORS = {
  Pending: "bg-slate-100 text-slate-700 border-slate-300",
  "Under Testing": "bg-blue-100 text-blue-800 border-blue-300",
  "Repair in Progress": "bg-orange-100 text-orange-800 border-orange-300",
  "Not Repairable": "bg-red-100 text-red-700 border-red-300",
  Completed: "bg-green-100 text-green-700 border-green-300",
};

// Helpers (unchanged)
const lsLoad = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSave = (key, v) => localStorage.setItem(key, JSON.stringify(v));
const genRef = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `PMC-${d}-${Math.floor(1000 + Math.random() * 9000)}`;
};
const todayDateStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s) => {
  if (!s) return "—";
  if (s.includes("T")) {
    const d = new Date(s); if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0"), yy = d.getFullYear();
    return `${dd}-${mm}-${yy}`;
  }
  if (s.includes("-") && s.split("-")[0].length === 4) {
    const [y, m, d] = s.split("-"); return `${d}-${m}-${y}`;
  }
  return s;
};

const emptyProduct = () => ({
  _pid: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  customerName: "", customerCode: "", productCode: "", productDescription: "", category: "",
  stage: STAGE_OPTIONS[0] || "Assembly", quantity: "1", identification: "", assembledBy: "", assembledByName: "", testedBy: "", testedByName: "", fiBy: "", fiByName: "",
  problem: "", rootCause: "", partsDetails: "", correction: "", disposition: DEFAULT_DISPOSITION_OPTIONS[0], delayTime: "",
  responses: { assembledBy: null, testedBy: null, fiBy: null },
  finalStatus: "Pending", finalStatusRemarks: "", finalStatusDate: todayDateStr(), finalStatusHistory: []
});

// Avatar (new UI)
const AVATAR_COLORS = [
  "from-blue-400 to-blue-600",
  "from-purple-400 to-purple-600",
  "from-green-400 to-green-600",
  "from-orange-400 to-orange-600",
  "from-pink-400 to-pink-600",
  "from-teal-400 to-teal-600",
];
const avatarColor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const initials = (name = "") =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

const Avatar = ({ name, size = "md" }) => {
  const sz = {
    sm: "w-[1.4vw] h-[1.4vw] text-[0.52vw]",
    md: "w-[1.8vw] h-[1.8vw] text-[0.65vw]",
    lg: "w-[2.4vw] h-[2.4vw] text-[0.82vw]",
  };
  return (
    <div title={name} className={`rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center font-bold text-white flex-shrink-0 ${sz[size]}`}>
      {initials(name)}
    </div>
  );
};

// --- Read-only Input Field ---
const RefInput = ({ label, value, span = 1 }) => (
  <div className={`flex flex-col gap-[0.25vw] ${span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : span === 4 ? "col-span-4" : ""}`}>
    <label className="text-[0.75vw] font-semibold text-black flex items-start gap-[0.25vw] text-black">
      {label}
    </label>
    <div className="bg-white border border-gray-300 rounded-[0.4vw] py-[0.45vw] px-[0.6vw] text-[0.8vw] text-gray-900 break-words whitespace-normal overflow-hidden min-h-[2.4vw]">
      {value || "—"}
    </div>
  </div>
);

// --- Production Response Modal ---
const ProductionResponseModal = ({ entry, product, employees, fourMCategories, onSave, onClose, caeHistory, rootCauseHistory }) => {
  const loggedUser = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("loggedInUser") || "{}"); } catch { return {}; }
  }, []);

  const [formData, setFormData] = useState({
    startDate: product.report?.startDate || todayDateStr(),
    fourMCategory: product.report?.fourMCategory || "",
    rootCause: product.report?.rootCause || "",
    correctiveAction: product.report?.correctiveAction || "",
    closedDate: product.report?.closedDate || "",
    verifiedBy: product.report?.verifiedBy || loggedUser.userId || "",
    verifiedDate: product.report?.verifiedDate || "",
    cae: product.report?.cae || "",
    status: product.report?.status || "Under Testing",
    currentRemark: ""
  });

  const STATUS_OPTIONS = ["Under Testing", "Repair in Progress", "Pending", "Completed", "Not Repairable"];
  const sp = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  // Autocomplete state for CAE
  const [showCaeSuggestions, setShowCaeSuggestions] = useState(false);
  const [activeCaeSuggestion, setActiveCaeSuggestion] = useState(-1);

  const filteredCaeSuggestions = useMemo(() => {
    const query = formData.cae?.toLowerCase() || "";
    if (!query) return caeHistory || [];
    return (caeHistory || []).filter(opt => opt.toLowerCase().includes(query));
  }, [formData.cae, caeHistory]);

  const handleCaeKeyDown = (e) => {
    if (!showCaeSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCaeSuggestion(prev => (prev < filteredCaeSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCaeSuggestion(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && activeCaeSuggestion >= 0) {
      e.preventDefault();
      sp("cae", filteredCaeSuggestions[activeCaeSuggestion]);
      setShowCaeSuggestions(false);
    } else if (e.key === "Escape") {
      setShowCaeSuggestions(false);
    }
  };

  const handleSave = () => {
    if (!formData.startDate) return alert("Start Date is mandatory.");
    if (!formData.fourMCategory) return alert("4M Category is mandatory.");
    if (!formData.rootCause.trim()) return alert("Root Cause is mandatory.");
    if (!formData.correctiveAction.trim()) return alert("Corrective Action is mandatory.");
    
    onSave(entry.id, product._pid, formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-[2vw]">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-[75vw] max-h-[90vh] rounded-[0.8vw] shadow-2xl overflow-hidden flex flex-col border border-gray-300">
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-[1.5vw] py-[1.2vw] flex justify-between items-center shadow-md">
          <div className="flex items-center gap-[0.9vw]">
            <div className="bg-white/20 p-[0.4vw] rounded-full"><FileText className="w-[1.4vw] h-[1.4vw] text-white" /></div>
            <div>
              <h3 className="text-[1.1vw] font-bold text-white uppercase tracking-wide">Production Resolution Panel</h3>
              <p className="text-[0.75vw] text-blue-100 font-medium">{entry.refNoInternal} · {product.productDescription}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors hover:bg-white/10 p-[0.4vw] rounded-full"><X className="w-[1.3vw] h-[1.3vw]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-[1.5vw] bg-gray-50/50">
          {/* Reference Info */}
          <div className="bg-white rounded-[0.6vw] border border-gray-200 shadow-sm p-[1.2vw] mb-[1.2vw]">
            <div className="text-[0.7vw] font-black text-gray-400 uppercase tracking-wider mb-[0.8vw] flex items-center gap-[0.5vw]"><Target className="w-[0.9vw] h-[0.9vw]" /> Primary Complaint Details</div>
            <div className="grid grid-cols-4 gap-[1vw]">
              <RefInput label="Customer Name" value={entry.customerName} />
              <RefInput label="Customer Code" value={entry.customerCode} />
              <RefInput label="Job Order" value={entry.jobOrderNo} />
              <RefInput label="Registration Date" value={fmtDate(entry.date)} />
              
              <RefInput label="Product Description" value={product.productDescription} span={2} />
              <RefInput label="Product Code" value={product.productCode} />
              <RefInput label="Board Type" value={product.boardType} />

              <RefInput label="Reported Problem" value={product.problem} span={3} />
              <RefInput label="Qty" value={product.qty} />
            </div>
          </div>

          {/* Technical Resolution */}
          <div className="bg-white rounded-[0.6vw] border border-blue-200 shadow-sm p-[1.2vw] mb-[1.2vw]">
            <div className="text-[0.7vw] font-black text-blue-500 uppercase tracking-wider mb-[0.8vw] flex items-center gap-[0.5vw]"><Wrench className="w-[0.9vw] h-[0.9vw]" /> Technical Resolution & Reporting</div>
            
            <div className="grid grid-cols-4 gap-[1.2vw] mb-[1vw]">
              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">Start Date <span className="text-red-500">*</span></label>
                <input type="date" value={formData.startDate} onChange={e => sp("startDate", e.target.value)} className="border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-semibold" />
              </div>

              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">4M Category <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={formData.fourMCategory} onChange={e => sp("fourMCategory", e.target.value)} className="w-full border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-semibold appearance-none bg-white">
                    <option value="">Select 4M Category</option>
                    {fourMCategories?.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="w-[0.8vw] h-[0.8vw] text-gray-500 absolute right-[0.6vw] top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-[0.4vw] col-span-2 relative">
                <label className="text-[0.72vw] font-bold text-gray-700">CAE (Corrective Action Execution)</label>
                <input
                  type="text"
                  value={formData.cae}
                  onChange={e => { sp("cae", e.target.value); setShowCaeSuggestions(true); setActiveCaeSuggestion(-1); }}
                  onFocus={() => setShowCaeSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCaeSuggestions(false), 200)}
                  onKeyDown={handleCaeKeyDown}
                  placeholder="Enter or select CAE..."
                  className="w-full border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-semibold"
                />
                <AnimatePresence>
                  {showCaeSuggestions && filteredCaeSuggestions.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full left-0 w-full mt-[0.2vw] bg-white border border-gray-300 shadow-xl rounded-[0.4vw] max-h-[12vw] overflow-y-auto z-50 py-[0.2vw]">
                      {filteredCaeSuggestions.map((opt, i) => (
                        <div key={i} onMouseDown={(e) => { e.preventDefault(); sp("cae", opt); setShowCaeSuggestions(false); }} className={`px-[0.8vw] py-[0.5vw] text-[0.75vw] font-semibold cursor-pointer transition-colors ${i === activeCaeSuggestion ? "bg-blue-100 text-blue-900" : "text-gray-800 hover:bg-gray-100"}`}>{opt}</div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[1.2vw] mb-[1vw]">
              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">Root Cause <span className="text-red-500">*</span></label>
                <textarea rows={2} value={formData.rootCause} onChange={e => sp("rootCause", e.target.value)} placeholder="Describe the root cause..." className="w-full border border-gray-300 rounded-[0.4vw] p-[0.6vw] text-[0.8vw] outline-none focus:border-blue-500 resize-none font-medium" />
              </div>
              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">Corrective Action <span className="text-red-500">*</span></label>
                <textarea rows={2} value={formData.correctiveAction} onChange={e => sp("correctiveAction", e.target.value)} placeholder="Action taken to fix..." className="w-full border border-gray-300 rounded-[0.4vw] p-[0.6vw] text-[0.8vw] outline-none focus:border-blue-500 resize-none font-medium" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-[1.2vw]">
              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">Closed Date</label>
                <input type="date" value={formData.closedDate} onChange={e => sp("closedDate", e.target.value)} className="border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-semibold" />
              </div>

              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">Verified By</label>
                <div className="relative">
                  <select value={formData.verifiedBy} onChange={e => sp("verifiedBy", e.target.value)} className="w-full border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-semibold appearance-none bg-white">
                    <option value="">Select Verifier</option>
                    {employees?.map(e => <option key={e.userId} value={e.userId}>{e.name}</option>)}
                  </select>
                  <ChevronDown className="w-[0.8vw] h-[0.8vw] text-gray-500 absolute right-[0.6vw] top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">Verified Date</label>
                <input type="date" value={formData.verifiedDate} onChange={e => sp("verifiedDate", e.target.value)} className="border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-semibold" />
              </div>

              <div className="flex flex-col gap-[0.4vw]">
                <label className="text-[0.72vw] font-bold text-gray-700">Resolution Status <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={formData.status} onChange={e => sp("status", e.target.value)} className={`w-full border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-bold appearance-none bg-white ${formData.status === "Completed" ? "text-green-700" : formData.status === "Not Repairable" ? "text-red-700" : "text-blue-700"}`}>
                    {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown className="w-[0.8vw] h-[0.8vw] text-gray-500 absolute right-[0.6vw] top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-[0.4vw] mt-[1vw]">
               <label className="text-[0.72vw] font-bold text-gray-700">Additional Remarks (Optional)</label>
               <input type="text" value={formData.currentRemark} onChange={e => sp("currentRemark", e.target.value)} placeholder="Add any remarks for this update..." className="w-full border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-500 font-medium" />
            </div>
          </div>
        </div>

        <div className="px-[1.5vw] py-[1vw] border-t border-gray-300 bg-gray-50 flex items-center justify-between">
          <div className="text-[0.7vw] text-gray-500">Ensure all mandatory (<span className="text-red-500">*</span>) fields are completed.</div>
          <div className="flex gap-[0.8vw]">
            <button onClick={onClose} className="px-[1.5vw] py-[0.6vw] border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 rounded-[0.4vw] text-[0.8vw] font-bold transition-all shadow-sm">Cancel</button>
            <button onClick={handleSave} className="px-[1.5vw] py-[0.6vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.4vw] text-[0.8vw] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-[0.5vw]"><CheckCircle className="w-[1vw] h-[1vw]" /> Submit Report</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Employee Select (styled, logic unchanged) ---
const EmpSelect = ({ label, val, employees, onSelect, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const selected = employees.find(e => e.userId === val);
  useEffect(() => { const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, []);
  return (
    <div className="flex flex-col gap-[0.3vw] relative" ref={ref}>
      <label className="text-[0.72vw] font-semibold text-black">{label}</label>
      <div onClick={() => !disabled && setOpen(!open)} className={`flex items-center gap-[0.6vw] bg-white border rounded-[0.4vw] px-[0.8vw] py-[0.5vw] transition-all cursor-pointer ${!disabled ? "border-gray-300 hover:border-blue-400" : "border-gray-200 bg-gray-50 cursor-not-allowed"}`}>
        {selected ? <Avatar name={selected.name} size="sm" /> : <div className="w-[1.4vw] h-[1.4vw] rounded-full bg-gray-100 flex items-center justify-center"><User className="w-[0.8vw] h-[0.8vw] text-gray-400" /></div>}
        <span className={`text-[0.78vw] font-medium flex-1 truncate ${val ? "text-black" : "text-gray-400"}`}>{selected ? selected.name : "Select..."}</span>
        {!disabled && <ChevronDown className={`w-[0.9vw] h-[0.9vw] text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full left-0 w-full mt-[0.2vw] bg-white border border-gray-300 shadow-xl rounded-[0.5vw] max-h-[14vw] overflow-y-auto z-[200] py-[0.3vw]">
            {employees.map(u => (
              <div key={u.userId} onClick={() => { onSelect(u); setOpen(false); }} className={`px-[0.8vw] py-[0.5vw] flex items-center gap-[0.6vw] hover:bg-blue-50 cursor-pointer transition-colors ${val === u.userId ? "bg-blue-50" : ""}`}>
                <Avatar name={u.name} size="sm" /><div className="flex-1 min-w-0"><div className="text-[0.78vw] font-bold text-black truncate">{u.name}</div><div className="text-[0.62vw] text-gray-500 font-medium">{u.department}</div></div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Employee Select Cell for Table (styled, logic unchanged) ---
const EmpSelectCell = ({ val, employees, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const selected = employees.find(e => e.userId === val);
  useEffect(() => { const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, []);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)} className={`flex items-center justify-center gap-[0.4vw] bg-white border rounded-[0.3vw] px-[0.5vw] py-[0.25vw] transition-all cursor-pointer hover:border-blue-400 mx-auto w-max ${val ? "border-gray-300" : "border-dashed border-gray-400"}`}>
        {selected ? <Avatar name={selected.name} size="sm" /> : <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-gray-100 flex items-center justify-center"><User className="w-[0.7vw] h-[0.7vw] text-gray-400" /></div>}
        <span className={`text-[0.7vw] font-semibold truncate max-w-[6vw] ${val ? "text-black" : "text-gray-400"}`}>{selected ? selected.name : "Assign"}</span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full left-0 mt-[0.2vw] bg-white border border-gray-300 shadow-xl rounded-[0.4vw] w-[14vw] max-h-[12vw] overflow-y-auto z-[200] py-[0.2vw]">
            {employees.map(u => (
              <div key={u.userId} onClick={() => { onSelect(u); setOpen(false); }} className="px-[0.6vw] py-[0.4vw] flex items-center gap-[0.5vw] hover:bg-blue-50 cursor-pointer">
                <Avatar name={u.name} size="sm" /><div className="flex-1 min-w-0"><div className="text-[0.7vw] font-bold text-black truncate">{u.name}</div><div className="text-[0.55vw] text-gray-400 font-medium truncate">{u.department}</div></div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Final Status Cell (styled, logic unchanged from original) ---
const FinalStatusCell = ({ row, prod, onUpdateProduct }) => {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [remarks, setRemarks] = useState(prod.finalStatusRemarks || row.finalStatusRemarks || "");
  const [status, setStatus] = useState(prod.finalStatus || row.finalStatus || "Pending");
  const [statusDate, setStatusDate] = useState(prod.finalStatusDate || todayDateStr());
  const ref = useRef(null);
  const historyRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setStatus(prod.finalStatus || row.finalStatus || "Pending");
    setRemarks(prod.finalStatusRemarks || row.finalStatusRemarks || "");
    setStatusDate(prod.finalStatusDate || todayDateStr());
  }, [prod.finalStatus, prod.finalStatusRemarks, prod.finalStatusDate, row.finalStatus, row.finalStatusRemarks]);

  const handleSave = () => {
    const newHistoryEntry = { status, remarks, date: statusDate, timestamp: new Date().toISOString() };
    const updatedHistory = [...(prod.finalStatusHistory || []), newHistoryEntry];
    onUpdateProduct(row.id, prod._pid, {
      finalStatus: status,
      finalStatusRemarks: remarks,
      finalStatusDate: statusDate,
      finalStatusHistory: updatedHistory,
    });
    setOpen(false);
  };

  const cls = FINAL_STATUS_COLORS[status] || "bg-gray-100 text-black/80 border-gray-300";

  return (
    <div className="flex items-center justify-center gap-[0.4vw]">
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(!open)} className={`text-[0.68vw] px-[0.5vw] py-[0.2vw] rounded-full border font-semibold flex items-center gap-[0.3vw] cursor-pointer transition-all ${cls}`}>
          {status} <ChevronDown className="w-[0.7vw] h-[0.7vw]" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full right-0 mt-[0.3vw] bg-white border border-gray-300 shadow-xl rounded-[0.5vw] z-40 w-[17vw] p-[0.8vw]">
              <div className="text-[0.72vw] font-semibold text-black/80 mb-[0.5vw]">Final Status</div>
              <div className="grid grid-cols-2 gap-[0.35vw] mb-[0.7vw]">
                {FINAL_STATUS_OPTIONS.map((opt) => {
                  const optCls = FINAL_STATUS_COLORS[opt];
                  return (
                    <button key={opt} onClick={() => setStatus(opt)} className={`py-[0.3vw] rounded-[0.3vw] border text-[0.66vw] font-semibold cursor-pointer transition-all ${status === opt ? optCls + " ring-2 ring-offset-1 ring-blue-300" : "bg-gray-50 text-black/70 border-gray-300 hover:bg-gray-100"}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              <div className="mb-[0.6vw]"><label className="text-[0.65vw] font-semibold text-black/70 block mb-[0.25vw]">Status Date</label><input type="date" value={statusDate} onChange={e => setStatusDate(e.target.value)} className="w-full border border-gray-300 rounded-[0.3vw] px-[0.4vw] py-[0.35vw] text-[0.72vw] outline-none focus:border-blue-400" /></div>
              <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add remarks…" className="w-full border border-gray-300 rounded-[0.3vw] p-[0.4vw] text-[0.72vw] outline-none focus:border-blue-400 resize-none mb-[0.6vw]" />
              <div className="flex justify-end gap-[0.4vw]"><button onClick={() => setOpen(false)} className="px-[0.8vw] py-[0.3vw] text-[0.68vw] border border-gray-300 rounded-[0.3vw] text-black/80 hover:bg-gray-50 cursor-pointer">Cancel</button><button onClick={handleSave} className="px-[0.8vw] py-[0.3vw] text-[0.68vw] bg-blue-600 text-white rounded-[0.3vw] hover:bg-blue-700 cursor-pointer font-semibold flex items-center gap-[0.3vw]"><Save className="w-[0.7vw] h-[0.7vw]" />Save</button></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="relative" ref={historyRef}>
        <button onClick={() => setShowHistory(!showHistory)} title="Status History" className="p-[0.3vw] text-black/50 hover:text-blue-600 hover:bg-blue-50 rounded-[0.3vw] transition-colors cursor-pointer"><Clock className="w-[0.9vw] h-[0.9vw]" /></button>
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full right-0 mt-[0.3vw] bg-white border border-gray-300 shadow-2xl rounded-[0.5vw] z-40 w-[22vw] p-[1vw]">
              <div className="flex items-center justify-between mb-[0.8vw] pb-[0.4vw] border-b border-gray-300"><div className="text-[0.8vw] font-bold text-black flex items-center gap-[0.4vw]"><Clock className="w-[0.9vw] h-[0.9vw] text-blue-500" />Status History</div><button onClick={() => setShowHistory(false)} className="text-black/40 hover:text-black"><X className="w-[0.8vw] h-[0.8vw]" /></button></div>
              <div className="max-h-[15vw] overflow-y-auto space-y-[0.6vw] pr-[0.3vw]">
                {(prod.finalStatusHistory || []).length > 0 ? [...(prod.finalStatusHistory || [])].reverse().map((h, i) => (
                  <div key={i} className="bg-gray-50/50 rounded-[0.4vw] p-[0.6vw] border border-gray-200"><div className="flex items-center justify-between mb-[0.2vw]"><span className={`text-[0.65vw] px-[0.4vw] py-[0.05vw] rounded-full font-bold border ${FINAL_STATUS_COLORS[h.status] || "bg-gray-100 text-black/80"}`}>{h.status}</span><div className="text-right">{h.date && <div className="text-[0.62vw] font-bold text-blue-600">{fmtDate(h.date)}</div>}<div className="text-[0.6vw] text-black/50">{fmtDate(h.timestamp)}</div></div></div><div className="text-[0.72vw] text-black/90 italic leading-tight">"{h.remarks || <span className="text-black/30">No remarks</span>}"</div></div>
                )) : <div className="py-[2vw] text-center text-[0.72vw] text-black/40">No history available yet.</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Search Dropdown for Product/Customer ---
const ProductSearchSelect = ({ onSelect, customerDb, disabled }) => {
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const ref = useRef();

  const items = useMemo(() => Object.values(customerDb).flat(), [customerDb]);
  const results = useMemo(() => {
    if (!q) return items.slice(0, 15);
    const s = q.toLowerCase();
    return items.filter(it =>
      (it.itemDescription || "").toLowerCase().includes(s) ||
      (it.partyDescription || "").toLowerCase().includes(s) ||
      (it.itemCode || "").toLowerCase().includes(s)
    ).slice(0, 15);
  }, [items, q]);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-[0.7vw] top-1/2 -translate-y-1/2 w-[0.9vw] h-[0.9vw] text-gray-400" />
        <input
          disabled={disabled}
          value={q}
          onChange={e => { setQ(e.target.value); setShow(true); }}
          onFocus={() => setShow(true)}
          placeholder="Search by Product or Customer..."
          className="w-full pl-[2.2vw] pr-[0.8vw] py-[0.55vw] border border-gray-300 rounded-[0.4vw] text-[0.78vw] outline-none focus:border-blue-400 disabled:bg-gray-50 bg-white"
        />
      </div>
      <AnimatePresence>
        {show && results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="absolute z-50 top-full left-0 w-full mt-[0.2vw] bg-white border border-gray-300 shadow-xl rounded-[0.5vw] max-h-[15vw] overflow-y-auto py-[0.3vw]">
            {results.map((it, i) => (
              <div
                key={i}
                onClick={() => { onSelect(it); setQ(""); setShow(false); }}
                className="px-[0.8vw] py-[0.5vw] hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-200 last:border-0"
              >
                <div className="text-[0.8vw] font-semibold text-black truncate">{it.itemDescription}</div>
                <div className="text-[0.65vw] text-gray-700 font-medium mt-[0.15vw]">{it.partyDescription} · {it.itemCode}</div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Product Row in Form ---
const ProductRow = ({ prod, idx, employees, customerDb, onUpdate, onRemove, isReadOnly, stageOptions, dispositionOptions }) => {
  const [expanded, setExpanded] = useState(true);
  const sp = (k, v) => onUpdate({ ...prod, [k]: v });

  const handleSelect = (item) => {
    onUpdate({
      ...prod,
      customerName: item.partyDescription,
      customerCode: item.partyCode,
      productCode: item.itemCode,
      productDescription: item.itemDescription,
      category: item.productSegment || ""
    });
  };

  return (
    <div className="border rounded-[0.5vw] transition-all bg-white border-gray-300 overflow-visible">
      <div className="flex items-center gap-[0.8vw] px-[1vw] py-[0.65vw] cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-center w-[1.8vw] h-[1.8vw] rounded-full bg-blue-600 text-white text-[0.7vw] font-bold flex-shrink-0">{idx + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.82vw] font-semibold text-black truncate">
            {prod.productDescription ? (
              <div className="flex items-center gap-[0.6vw]">
                <span>{prod.productDescription}</span>
                <span className="text-gray-400 text-[0.7vw] font-normal">| {prod.customerName}</span>
              </div>
            ) : (
              <span className="text-black/50 font-normal italic">Click to expand and select product details...</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-[0.5vw]" onClick={e => e.stopPropagation()}>
          {!isReadOnly && <button onClick={() => onRemove(prod._pid)} className="p-[0.3vw] hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-[0.3vw] cursor-pointer"><Trash2 className="w-[0.9vw] h-[0.9vw]" /></button>}
          {expanded ? <ChevronUp className="w-[1vw] h-[1vw] text-black/50" /> : <ChevronDown className="w-[1vw] h-[1vw] text-black/50" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-visible">
            <div className="border-t border-gray-300 px-[1.2vw] pt-[1.2vw] pb-[1.5vw] space-y-[1.2vw]">

              {/* Product Selection (Auto-fetch Trigger) */}
              {!isReadOnly && (
                <div className="flex flex-col gap-[0.3vw] pb-[0.4vw]">
                  <label className="text-[0.72vw] font-bold text-blue-600 uppercase  flex items-center gap-[.4vw]">
                    <Target className="w-[0.8vw] h-[0.8vw]" /> Search & Fetch Product Info
                  </label>
                  <ProductSearchSelect customerDb={customerDb} onSelect={handleSelect} disabled={isReadOnly} />
                </div>
              )}

              {/* Read-only Fetched Fields */}
              <div className="grid grid-cols-4 gap-[1vw]">
                <div className="flex flex-col gap-[0.3vw] col-span-2">
                  <label className="text-[0.72vw] font-semibold text-gray-900">Customer Name</label>
                  <input readOnly value={prod.customerName} placeholder="Auto-filled..." className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] bg-gray-50 text-gray-600" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.72vw] font-semibold text-gray-900">Customer Code</label>
                  <input readOnly value={prod.customerCode} placeholder="—" className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] bg-gray-50 text-gray-600" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.72vw] font-semibold text-gray-900">Category</label>
                  <input readOnly value={prod.category} placeholder="—" className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] bg-gray-50 text-gray-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[1vw]">
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.72vw] font-semibold text-gray-900">Product Code</label>
                  <input readOnly value={prod.productCode} placeholder="Auto-filled..." className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] bg-gray-50 text-gray-600" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.72vw] font-semibold text-gray-900">Product Description</label>
                  <input readOnly value={prod.productDescription} placeholder="Auto-filled..." className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] bg-gray-50 text-gray-600" />
                </div>
              </div>

              <div className="h-px bg-gray-200" />

              {/* Manual Entry Fields */}
              <div className="grid grid-cols-4 gap-[1vw]">
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Stage <span className="text-red-500">*</span></label>
                  <select value={prod.stage} onChange={e => sp("stage", e.target.value)} disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-400 bg-white">
                    {stageOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Quantity <span className="text-red-500">*</span></label>
                  <input type="number" min="1" value={prod.quantity} onChange={e => sp("quantity", e.target.value)} disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-400" />
                </div>
                <div className="flex flex-col gap-[0.3vw] col-span-2">
                  <label className="text-[0.72vw] font-semibold text-black">Batch / Serial No <span className="text-red-500">*</span></label>
                  <input value={prod.identification} onChange={e => sp("identification", e.target.value)} placeholder="Enter Batch/SN..." disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-[1vw] pt-[0.4vw]">
                <EmpSelect label="Assembled By" val={prod.assembledBy} employees={employees} onSelect={u => onUpdate({ ...prod, assembledBy: u.userId, assembledByName: u.name })} disabled={isReadOnly} />
                <EmpSelect label="Tested By" val={prod.testedBy} employees={employees} onSelect={u => onUpdate({ ...prod, testedBy: u.userId, testedByName: u.name })} disabled={isReadOnly} />
                <EmpSelect label="FI By" val={prod.fiBy} employees={employees} onSelect={u => onUpdate({ ...prod, fiBy: u.userId, fiByName: u.name })} disabled={isReadOnly} />
              </div>

              <div className="grid grid-cols-2 gap-[1vw] mt-[1vw]">
                <div className="flex flex-col gap-[0.4vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Problem Description <span className="text-red-500">*</span></label>
                  <textarea rows={3} value={prod.problem} onChange={e => sp("problem", e.target.value)} placeholder="Describe the problem encountered..." disabled={isReadOnly} className="w-full border border-gray-300 rounded-[0.4vw] p-[0.7vw] text-[0.78vw] outline-none focus:border-blue-400 resize-none" />
                </div>
                <div className="flex flex-col gap-[0.4vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Possible Root Cause(s) <span className="text-red-500">*</span></label>
                  <textarea rows={3} value={prod.rootCause} onChange={e => sp("rootCause", e.target.value)} placeholder="Enter root cause details..." disabled={isReadOnly} className="w-full border border-gray-300 rounded-[0.4vw] p-[0.7vw] text-[0.78vw] outline-none focus:border-blue-400 resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[1vw] mt-[1vw]">
                <div className="flex flex-col gap-[0.4vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Parts Replacement Details</label>
                  <textarea rows={3} value={prod.partsDetails} onChange={e => sp("partsDetails", e.target.value)} placeholder="Parts, spares or materials used..." disabled={isReadOnly} className="w-full border border-gray-300 rounded-[0.4vw] p-[0.7vw] text-[0.78vw] outline-none focus:border-blue-400 resize-none" />
                </div>
                <div className="flex flex-col gap-[0.4vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Corrective Action</label>
                  <textarea rows={3} value={prod.correction} onChange={e => sp("correction", e.target.value)} placeholder="Describe corrective action taken..." disabled={isReadOnly} className="w-full border border-gray-300 rounded-[0.4vw] p-[0.7vw] text-[0.78vw] outline-none focus:border-blue-400 resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-[1vw] mt-[1vw]">
                <div className="flex flex-col gap-[0.4vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Disposition</label>
                  <select value={prod.disposition} onChange={e => sp("disposition", e.target.value)} disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.55vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-400 bg-white">
                    {dispositionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.4vw]">
                  <label className="text-[0.72vw] font-semibold text-black">Completed Date</label>
                  <input type="date" value={prod.finalStatusDate} onChange={e => sp("finalStatusDate", e.target.value)} disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.55vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Inward Form Page ---
const InwardForm = ({ initialData, customerDb, employees, onSave, onBack, stageOptions, dispositionOptions }) => {
  const { toast } = useNotification();
  const [base, setBase] = useState(() => ({
    date: initialData.date || todayDateStr(),
    jobOrderNo: initialData.jobOrderNo || "",
    refNoInternal: initialData.refNoInternal || genRef()
  }));
  const [products, setProducts] = useState(() => initialData.products || [emptyProduct()]);
  const isReadOnly = !!initialData._readonly;

  const updateProduct = (updated) => setProducts(prev => prev.map(p => p._pid === updated._pid ? updated : p));
  const removeProduct = (pid) => setProducts(prev => prev.filter(p => p._pid !== pid));
  const addProduct = () => setProducts(prev => [...prev, emptyProduct()]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!base.jobOrderNo) { toast("Job Order Number is mandatory", "error"); return; }
    if (products.length === 0) { toast("At least one product item is required for registration", "warning"); return; }
    if (products.some(p => !p.productDescription)) { toast("Please select a Product for all rows", "error"); return; }
    if (products.some(p => !p.quantity || !p.identification)) { toast("Quantity and Batch/Serial are mandatory fields", "warning"); return; }
    if (products.some(p => !p.problem.trim())) { toast("Problem Description is required for all products", "error"); return; }
    if (products.some(p => !p.rootCause.trim())) { toast("Possible Root Cause(s) is required for all products", "error"); return; }
    onSave({ ...base, products });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full font-sans text-[0.85vw] max-h-[90vh] overflow-y-auto pr-[0.4vw]">
      <div className="flex items-center justify-between bg-white px-[1.2vw] py-[0.8vw] rounded-[0.6vw] shadow-sm border border-gray-300 mb-[1vw] sticky top-0 z-[60]">
        <div className="flex items-center gap-[1vw]">
          <button onClick={onBack} className="flex items-center gap-[0.4vw] text-black/70 hover:text-black border border-gray-300 bg-gray-50 px-[0.8vw] py-[0.4vw] rounded-[0.4vw] cursor-pointer shadow-sm transition-all hover:shadow">
            <ArrowLeft className="w-[1vw] h-[1vw]" />
            <span className="font-medium">Back</span>
          </button>
          <div>
            <h2 className="text-[1vw] font-bold text-black">{initialData.id ? "Edit Production NC" : "New Production NC Registration"}</h2>
            <div className="text-[0.6vw] text-gray-400  mt-[.1vw] uppercase ">Reference: {base.refNoInternal}</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[1.2vw] pb-[2vw]">
        {/* Base Info Section */}
        <div className="bg-white rounded-[0.6vw] shadow-sm border border-gray-300 p-[1.5vw]">
          <h3 className="text-[0.85vw] font-bold text-black uppercase  mb-[1.2vw] pb-[0.6vw] border-b border-gray-200 flex items-center gap-[0.5vw]">
            <ClipboardList className="w-[1.1vw] h-[1.1vw] text-blue-500" />
            Primary Order Identification
          </h3>
          <div className="grid grid-cols-2 gap-[2vw]">
            <div className="flex flex-col gap-[0.4vw]">
              <label className="font-bold text-black text-[0.72vw] uppercase  opacity-70">Registration Date</label>
              <input type="date" value={base.date} onChange={e => setBase({ ...base, date: e.target.value })} disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.6vw] px-[0.8vw] text-[0.8vw] font-semibold outline-none focus:border-blue-500 shadow-sm transition-all text-gray-800" />
            </div>
            <div className="flex flex-col gap-[0.4vw]">
              <label className="font-bold text-black text-[0.72vw] uppercase  opacity-70">Job Order Number <span className="text-red-500">*</span></label>
              <input value={base.jobOrderNo} onChange={e => setBase({ ...base, jobOrderNo: e.target.value })} placeholder="Enter official Job Order Reference..." disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.6vw] px-[0.8vw] text-[0.8vw] font-semibold outline-none focus:border-blue-500 shadow-sm transition-all text-gray-800" />
            </div>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="bg-blue-50/30 rounded-[0.6vw] shadow-sm border border-blue-200 p-[1.5vw]">
          <div className="flex items-center justify-between mb-[1.2vw] pb-[0.6vw] border-b border-blue-200">
            <h3 className="text-[0.85vw] font-bold text-blue-800 uppercase  flex items-center gap-[0.5vw]">
              <Package className="w-[1.1vw] h-[1.1vw] text-blue-600" />
              Manifest & Assembly Specs
              <span className="ml-[0.8vw] text-[0.65vw] bg-blue-600 text-white px-[0.6vw] py-[0.15vw] rounded-full font-bold shadow-sm">
                {products.length} {products.length === 1 ? 'Item' : 'Items'}
              </span>
            </h3>
            {!isReadOnly && (
              <button type="button" onClick={addProduct} className="flex items-center gap-[0.4vw] text-[0.75vw] font-bold text-white bg-blue-600 hover:bg-blue-700 px-[1vw] py-[0.5vw] rounded-[0.4vw] cursor-pointer shadow-md transition-all active:scale-95">
                <Plus className="w-[1vw] h-[1vw]" /> Add Item Row
              </button>
            )}
          </div>
          <div className="space-y-[1vw]">
            {products.map((prod, idx) => (
              <ProductRow
                key={prod._pid}
                prod={prod}
                idx={idx}
                employees={employees}
                customerDb={customerDb}
                stageOptions={stageOptions}
                dispositionOptions={dispositionOptions}
                onUpdate={updateProduct}
                onRemove={removeProduct}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-[1vw] pt-[1vw] border-t border-gray-200 mt-[0.5vw]">
          <button type="button" onClick={onBack} className="px-[1.8vw] py-[0.75vw] border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-[0.5vw] cursor-pointer flex items-center gap-[0.5vw] font-bold shadow-sm transition-all">
            <X className="w-[1vw] h-[1vw]" /> Cancel
          </button>
          {!isReadOnly && (
            <button type="submit" className="px-[2.2vw] py-[0.75vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.5vw] flex items-center gap-[0.5vw] cursor-pointer font-bold shadow-lg transition-all active:scale-95">
              <Save className="w-[1.1vw] h-[1.1vw]" /> Register Inward
            </button>
          )}
        </div>
      </form>
    </motion.div>
  );
};

// --- Main List Screen ---
export default function ProductionMaterialResponse() {
  const { toast } = useNotification();
  const [data, setData] = useState(() => lsLoad(PM_INWARD_KEY, []));
  const [view, setView] = useState("list");
  const [selectedRow, setSelectedRow] = useState(null);
  const [reportsRow, setReportsRow] = useState(null);
  const [activeReportProduct, setActiveReportProduct] = useState(null);
  const [fourMCategories, setFourMCategories] = useState([]);
  const [caeHistory, setCaeHistory] = useState([]);
  const [rootCauseHistory, setRootCauseHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Fetch 4M categories
    fetch(`${import.meta.env.VITE_API_URL}/master/4m-categories`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setFourMCategories(data.map(d => d.name));
      })
      .catch(err => console.error(err));
  }, []);
  const [stageOptions, setStageOptions] = useState(() => lsLoad(STAGE_MASTER_KEY, DEFAULT_STAGE_OPTIONS));
  const [dispositionOptions, setDispositionOptions] = useState(() => lsLoad(DISPOSITION_MASTER_KEY, DEFAULT_DISPOSITION_OPTIONS));
  const [activeFilter, setActiveFilter] = useState("All");
  const [categoryFilterType, setCategoryFilterType] = useState("Stage");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const customerDb = useMemo(() => lsLoad(CUSTOMER_DB_KEY, []), []);
  const employees = useMemo(() => lsLoad(EMPLOYEES_KEY, []), []);
  const ITEMS_PER_PAGE = 10;

  const saveData = (newData) => { setData(newData); lsSave(PM_INWARD_KEY, newData); };
  
  const handleSave = (formData) => {
    let updatedData;
    const loggedUser = JSON.parse(sessionStorage.getItem("loggedInUser") || "{}");
    
    const entryData = { 
      ...formData, 
      creatorUserId: loggedUser.userId || "Admin",
      creatorName: loggedUser.name || "Admin"
    };

    if (selectedRow?.id) {
      updatedData = data.map(d => d.id === selectedRow.id ? { ...entryData, id: d.id, updatedAt: new Date().toISOString() } : d);
    } else {
      updatedData = [{ ...entryData, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...data];
    }
    saveData(updatedData); setView("list"); setSelectedRow(null); toast("Inward Registration Completed", "success");
  };
  const onUpdateProduct = (rowId, productId, updates) => {
    const updatedData = data.map(d => d.id === rowId ? { ...d, products: (d.products || []).map(p => p._pid === productId ? { ...p, ...updates } : p), updatedAt: new Date().toISOString() } : d);
    saveData(updatedData);
  };
  const goToForm = () => { setSelectedRow(null); setView("form"); };
  const goToEdit = (row) => { setSelectedRow(row); setView("form"); };
  const goToTable = () => { setView("list"); setSelectedRow(null); };

  const getRowStatusMatch = (row, status) => {
    const products = row.products || [];
    if (products.length > 0) {
      return products.some(p => (p.finalStatus || "Pending") === status);
    }
    return (row.finalStatus || "Pending") === status;
  };

  const filteredData = useMemo(() => {
    const loggedUser = JSON.parse(sessionStorage.getItem("loggedInUser") || "{}");
    const uid = loggedUser.userId;

    let filtered = data.filter(row => row.creatorUserId === uid);
    
    if (activeFilter !== "All") filtered = filtered.filter(row => getRowStatusMatch(row, activeFilter));
    
    if (selectedCategory !== "All" && categoryFilterType === "Stage") {
      filtered = filtered.filter(row => (row.products || []).some(p => p.stage === selectedCategory));
    } else if (selectedCategory !== "All" && categoryFilterType === "Disposition") {
      filtered = filtered.filter(row => (row.products || []).some(p => p.disposition === selectedCategory));
    }
    
    if (searchTerm) { const s = searchTerm.toLowerCase(); filtered = filtered.filter(row => (row.refNoInternal || "").toLowerCase().includes(s) || (row.products || []).some(p => (p.customerName || "").toLowerCase().includes(s) || (p.productDescription || "").toLowerCase().includes(s))); }
    return filtered;
  }, [data, searchTerm, activeFilter, selectedCategory, categoryFilterType]);

  useEffect(() => setCurrentPage(1), [searchTerm, activeFilter]);
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const counts = useMemo(() => {
    const c = { All: data.length };
    FINAL_STATUS_OPTIONS.forEach(s => {
      c[s] = data.filter(row => getRowStatusMatch(row, s)).length;
    });
    return c;
  }, [data]);

  const STATUS_CHIPS = [
    { label: "All", activeColor: "bg-gray-700 text-white border-gray-700", inactiveColor: "bg-gray-100 text-black/90 border-gray-300 hover:bg-gray-200", dot: "bg-gray-400", activeDot: "bg-white" },
    { label: "Pending", activeColor: "bg-orange-500 text-white border-orange-500", inactiveColor: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", dot: "bg-orange-500", activeDot: "bg-white" },
    { label: "Rejected", activeColor: "bg-gray-600 text-white border-gray-600", inactiveColor: "bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300", dot: "bg-gray-500", activeDot: "bg-white" },
    { label: "Completed", activeColor: "bg-green-600 text-white border-green-600", inactiveColor: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", dot: "bg-green-500", activeDot: "bg-white" },
  ];

  if (view === "form") return <InwardForm initialData={selectedRow || {}} customerDb={customerDb} employees={employees} onSave={handleSave} onBack={goToTable} stageOptions={stageOptions} dispositionOptions={dispositionOptions} />;

  return (
    <>
      <div className="w-full h-full font-sans text-[0.85vw]">
        <AnimatePresence>
          {reportsRow && activeReportProduct && (
            <ProductionResponseModal 
              entry={reportsRow}
              product={activeReportProduct} 
              employees={employees}
              fourMCategories={fourMCategories}
              caeHistory={caeHistory}
              rootCauseHistory={rootCauseHistory}
              onClose={() => { setReportsRow(null); setActiveReportProduct(null); }}
              onSave={(entryId, productId, data) => {
                const newHistoryEntry = {
                  status: data.status,
                  remarks: data.currentRemark || "Report Updated",
                  date: todayDateStr(),
                  timestamp: new Date().toISOString()
                };
                onUpdateProduct(entryId, productId, {
                  report: data,
                  finalStatus: data.status,
                  finalStatusRemarks: data.currentRemark || "Report Updated",
                  finalStatusDate: todayDateStr(),
                  finalStatusHistory: [
                    ...(activeReportProduct.finalStatusHistory || []),
                    newHistoryEntry
                  ]
                });
                
                // Update local autocomplete histories
                if (data.cae && !caeHistory.includes(data.cae)) setCaeHistory(prev => [...prev, data.cae]);
                if (data.rootCause && !rootCauseHistory.includes(data.rootCause)) setRootCauseHistory(prev => [...prev, data.rootCause]);
                
                setReportsRow(null);
                setActiveReportProduct(null);
                toast("Response recorded successfully", "success");
              }}
            />
          )}
        </AnimatePresence>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
          <div className="flex items-center justify-between bg-white p-[0.7vw] rounded-[0.6vw] shadow-sm border border-gray-300 mb-[0.9vw]">
            <div className="relative w-[30vw]"><Search className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 text-black/50 w-[1vw] h-[1vw]" /><input type="text" placeholder="Search by ref, customer, product…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-[2.5vw] pr-[1vw] h-[2.5vw] border border-gray-300 rounded-[0.8vw] focus:outline-none focus:border-blue-500" /></div>
            <div className="flex gap-[0.8vw] items-center">
              <button onClick={goToForm} className="cursor-pointer flex items-center gap-[0.5vw] bg-blue-600 hover:bg-blue-700 text-white px-[1.2vw] h-[2.4vw] rounded-[0.4vw] font-semibold shadow-sm transition-all"><Plus className="w-[1.1vw] h-[1.1vw]" />New Entry</button>
            </div>
          </div>
          <div className="flex gap-[1vw] mb-[0.9vw] flex-wrap">{STATUS_CHIPS.map(({ label, activeColor, inactiveColor, dot, activeDot }) => { const isActive = activeFilter === label; return (<button key={label} onClick={() => setActiveFilter(label)} className={`flex items-center gap-[0.5vw] px-[1vw] py-[0.55vw] rounded-[0.5vw] border font-medium text-[0.8vw] cursor-pointer transition-all duration-150 select-none ${isActive ? activeColor : inactiveColor} ${isActive ? "ring-2 ring-offset-1 ring-blue-300/60 scale-[1.03]" : ""}`}><span className={`w-[0.6vw] h-[0.6vw] rounded-full flex-shrink-0 ${isActive ? activeDot : dot}`} />{label} <span className="font-bold">{counts[label] ?? 0}</span></button>); })}</div>
          
          <div className="bg-white rounded-[0.6vw] shadow-sm border border-gray-300 flex flex-col">
            <div className="overflow-auto max-h-[65vh] min-h-[65vh] w-full rounded-t-[0.6vw]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-blue-50 sticky top-0 z-10">
                  <tr className="bg-blue-50">
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center min-w-[8vw]">Date/Ref</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Job Order No</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Customer Name</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Raised By</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Product Description</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Board Type</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Problem</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Qty</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Raised To</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Response</th>
                    <th className="px-[0.8vw] py-[0.8vw] font-semibold text-gray-900 border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.82vw] align-middle text-center">Final Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length > 0 ? (
                    paginatedData.flatMap((row, i) => {
                      const products = row.products || [];
                      const span = products.length;
                      return products.map((prod, pi) => {
                        const latestRemark = (prod.finalStatusHistory || []).slice(-1)[0]?.remarks || prod.finalStatusRemarks || "—";
                        return (
                          <tr key={`${row.id}-${pi}`} className={`transition-colors hover:bg-gray-50/60 ${pi > 0 ? "border-t border-dashed border-gray-300" : "border-t border-gray-300"}`}>
                            {pi === 0 && (
                              <>
                                <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 align-middle text-center">
                                  <div className="text-black font-semibold text-[0.78vw] mx-auto text-center">{fmtDate(row.date)}</div>
                                  <div className="text-[0.6vw] text-gray-700 mt-[0.2vw] uppercase mx-auto text-center">{row.refNoInternal}</div>
                                </td>
                                <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 align-middle text-center text-[0.78vw] font-semibold text-blue-700">
                                  <div className=" px-[0.4vw] py-[0.2vw]" title={row.jobOrderNo}>
                                    {row.jobOrderNo || "—"}
                                  </div>
                                </td>
                                <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 align-middle text-center">
                                  <div className="text-[0.75vw] font-semibold text-gray-800 truncate max-w-[10vw] mx-auto text-center" title={row.customerName}>{row.customerName || "—"}</div>
                                </td>
                                <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 align-middle text-center">
                                  <div className="text-[0.75vw] font-semibold text-gray-800 truncate max-w-[8vw] mx-auto text-center" title={row.raisedBy}>{employees.find(e => e.userId === row.raisedBy)?.name || "—"}</div>
                                </td>
                              </>
                            )}
                            <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 align-middle text-center">
                              <div className="text-[0.72vw] font-semibold text-gray-800 truncate max-w-[10vw] mx-auto text-center" title={prod.productDescription}>{prod.productDescription || "—"}</div>
                            </td>
                            <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 text-center align-middle">
                              <div className="text-[0.72vw] font-medium text-gray-900 mx-auto text-center">{prod.boardType || "—"}</div>
                            </td>
                            <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 align-middle text-center">
                              <div className="text-[0.72vw] font-regular text-black mx-auto text-center truncate max-w-[12vw]">{prod.problem || "—"}</div>
                            </td>
                            <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 text-center align-middle font-bold text-black text-[0.75vw]">{prod.qty}</td>
                            <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 align-middle text-center">
                              <div className="text-[0.72vw] font-semibold text-gray-800 truncate max-w-[8vw] mx-auto text-center" title={prod.raisedTo}>{employees.find(e => e.userId === prod.raisedTo)?.name || "—"}</div>
                            </td>
                            
                            <td className="px-[0.8vw] py-[0.7vw] text-center border-r border-gray-300 align-middle">
                              <button onClick={() => { setReportsRow(row); setActiveReportProduct(prod); }} title="Submit/View Response" className={`px-[0.7vw] py-[0.4vw] border rounded-[0.4vw] shadow-sm cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-[0.4vw] text-[0.68vw] font-semibold mx-auto ${prod.report ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100" : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:text-blue-600"}`}>
                                {prod.report ? <CheckCircle className="w-[0.9vw] h-[0.9vw]" /> : <Eye className="w-[0.9vw] h-[0.9vw]" />}
                                {prod.report ? "Reported" : "Submit Report"}
                              </button>
                            </td>

                            <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-300 text-center align-middle">
                              <div className={`px-[0.6vw] py-[0.2vw] inline-flex items-center justify-center rounded-full text-[0.7vw] font-bold border ${FINAL_STATUS_COLORS[prod.finalStatus || "Pending"]}`}>
                                {prod.finalStatus || "Pending"}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })
                  ) : (
                    <tr>
                      <td colSpan={19} className="py-[6vw] text-center text-gray-400 text-[0.9vw] font-medium italic bg-gray-50/30">
                        No production records found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-blue-100 p-[0.6vw] bg-blue-50 flex justify-between items-center rounded-b-[0.6vw]">
              <div className="text-[0.8vw] text-black/70">Showing <strong>{paginatedData.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> to <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</strong> of <strong>{filteredData.length}</strong> entries</div>
              <div className="flex items-center gap-[1.2vw]">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-[0.4vw] border border-gray-300 rounded-[0.3vw] hover:bg-white disabled:opacity-50 bg-white shadow-sm cursor-pointer"><ChevronDown className="w-[1vw] h-[1vw] rotate-90 text-black/80" /></button>
                <div className="flex gap-[0.7vw]">{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { let pNum = i + 1; if (totalPages > 5 && currentPage > 3) pNum = currentPage - 2 + i; if (pNum > totalPages) return null; return (<button key={pNum} onClick={() => setCurrentPage(pNum)} className={`w-[1.8vw] h-[1.8vw] flex items-center justify-center rounded-[0.3vw] text-[0.8vw] font-medium cursor-pointer ${currentPage === pNum ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-black/80 hover:bg-gray-50"}`}>{pNum}</button>); })}</div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-[0.4vw] border border-gray-300 rounded-[0.3vw] hover:bg-white disabled:opacity-50 bg-white shadow-sm cursor-pointer"><ChevronUp className="w-[1vw] h-[1vw] rotate-90 text-black/80" /></button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}