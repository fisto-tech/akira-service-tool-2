// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, Trash2, Save, ArrowLeft, Plus, User, Package, ChevronDown,
  ChevronUp, Eye, Target, ClipboardList, Edit3, Clock, History
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotification } from "../components/NotificationContext";

// Storage Keys
const PM_INWARD_KEY = "production_material_nc_v2";
const CUSTOMER_DB_KEY = "customer_db_grouped_v5";
const EMPLOYEES_KEY = "employees";

// Options
const STAGE_OPTIONS = ["Assembly", "Testing", "Final Inspection", "Dispatch"];
const FINAL_STATUS_OPTIONS = ["Pending", "Delivered", "Hold", "Not Repairable"];
const FINAL_STATUS_COLORS = {
  Pending: "bg-orange-100 text-orange-700 border-orange-300",
  Delivered: "bg-green-100 text-green-700 border-green-300",
  Hold: "bg-red-100 text-red-700 border-red-300",
  "Not Repairable": "bg-gray-200 text-gray-700 border-gray-400",
};

// Helpers
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
  jobOrderNo: "", customerName: "", customerCode: "", productCode: "", productDescription: "", category: "",
  quantity: "1", identification: "", assembledBy: "", assembledByName: "", testedBy: "", testedByName: "", fiBy: "", fiByName: "",
  responses: { assembledBy: null, testedBy: null, fiBy: null },
  finalStatus: "Pending", finalStatusRemarks: "", finalStatusDate: todayDateStr(), finalStatusHistory: []
});

const initials = (name = "") => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

// --- Reports Modal ---
const ReportsModal = ({ row, onClose }) => {
  const products = row.products || [];
  const [expandedIndex, setExpandedIndex] = useState(0);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[100] flex items-center justify-center p-[2vw]">
      <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-[55vw] max-h-[85vh] rounded-[0.4vw] shadow-2xl overflow-hidden flex flex-col border border-slate-300">
        <div className="bg-slate-900 px-[1.2vw] py-[0.8vw] flex justify-between items-center text-white">
          <div className="flex items-center gap-[0.8vw]"><ClipboardList className="w-[1.2vw] h-[1.2vw]" /><h3 className="text-[0.9vw] font-bold uppercase">QA Verification History — {row.refNoInternal}</h3></div>
          <button onClick={onClose} className="cursor-pointer hover:opacity-70"><X className="w-[1.1vw] h-[1.1vw]" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-[1vw] space-y-[0.8vw]">
          {products.map((prod, idx) => (
             <div key={prod._pid} className="border border-slate-200 rounded-[0.3vw]">
                <div onClick={() => setExpandedIndex(idx)} className={`px-[1vw] py-[0.6vw] flex justify-between items-center cursor-pointer ${expandedIndex === idx ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                   <span className="text-[0.8vw] font-bold text-black">{prod.productDescription} <span className="text-[0.65vw] text-slate-400 font-normal ml-[0.5vw]">({prod.jobOrderNo})</span></span>
                   {expandedIndex === idx ? <ChevronUp className="w-[1vw] h-[1vw] text-black" /> : <ChevronDown className="w-[1vw] h-[1vw] text-black" />}
                </div>
                {expandedIndex === idx && (
                   <div className="p-[1vw] space-y-[1vw] bg-white border-t border-slate-100">
                      {["assembledBy", "testedBy", "fiBy"].map(role => {
                         const res = prod.responses?.[role];
                         const label = role === "assembledBy" ? "Assembler" : role === "testedBy" ? "Tester" : "Final Inspector";
                         return (
                            <div key={role} className="border-b border-slate-50 pb-[0.8vw] last:border-0 last:pb-0">
                               <div className="flex justify-between items-center mb-[0.4vw]">
                                  <span className="text-[0.7vw] font-bold text-black uppercase">{label}: <span className="font-medium text-slate-700">{prod[`${role}Name`] || "Not Assigned"}</span></span>
                                  {res && <span className="text-[0.62vw] bg-emerald-50 text-emerald-700 px-[0.4vw] py-[0.05vw] rounded border border-emerald-100 font-bold uppercase">{res.status}</span>}
                               </div>
                               {res ? <div className="grid grid-cols-2 gap-x-[1.5vw] gap-y-[0.6vw] text-[0.72vw]">
                                  <div className="flex flex-col"><span className="text-[0.6vw] font-bold text-slate-400 uppercase">Problem Identification</span> <p className="text-black font-medium">{res.problem}</p></div>
                                  <div className="flex flex-col"><span className="text-[0.6vw] font-bold text-slate-400 uppercase">Root Cause Analysis</span> <p className="text-black font-medium">{res.rootCause}</p></div>
                                  <div className="flex flex-col"><span className="text-[0.6vw] font-bold text-slate-400 uppercase">Correction Details</span> <p className="text-black font-medium">{res.correction}</p></div>
                                  <div className="flex flex-col"><span className="text-[0.6vw] font-bold text-slate-400 uppercase">Completion Date</span> <p className="text-black font-medium">{fmtDate(res.completionDate)}</p></div>
                               </div> : <div className="text-[0.65vw] text-slate-400">Response Awaiting Submission</div>}
                            </div>
                         );
                      })}
                   </div>
                )}
             </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

// --- Custom Components ---
const EmpSelect = ({ label, val, employees, onSelect, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => { const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const sel = employees.find(e => e.userId === val);
  return (
    <div className="flex flex-col gap-[0.1vw] relative" ref={ref}>
       <label className="text-[0.65vw] font-bold text-black uppercase">{label}</label>
       <div onClick={() => !disabled && setOpen(!open)} className={`flex items-center gap-[0.4vw] bg-white border rounded-[0.25vw] px-[0.6vw] py-[0.35vw] transition-all ${!disabled ? "cursor-pointer border-slate-300 hover:border-black" : "border-slate-100 bg-slate-50"}`}>
          <div className={`w-[1.2vw] h-[1.2vw] flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[0.55vw] ${sel ? "bg-slate-900" : "bg-slate-100"}`}>
             {sel ? initials(sel.name) : <User className="w-[0.7vw] h-[0.7vw] text-slate-300" />}
          </div>
          <span className={`text-[0.72vw] font-medium flex-1 truncate ${val ? "text-black" : "text-slate-400"}`}>{sel ? sel.name : "Select..."}</span>
          {!disabled && <ChevronDown className={`w-[0.8vw] h-[0.8vw] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />}
       </div>
       {open && (
         <div className="absolute top-full left-0 w-full mt-[0.1vw] bg-white border border-slate-300 shadow-xl rounded-[0.3vw] max-h-[12vw] overflow-y-auto z-[200] py-[0.1vw]">
            {employees.map(u => (
               <div key={u.userId} onClick={() => { onSelect(u); setOpen(false); }} className={`px-[0.6vw] py-[0.4vw] flex items-center gap-[0.6vw] hover:bg-slate-50 cursor-pointer ${val === u.userId ? "bg-slate-50" : ""}`}>
                  <div className="w-[1.4vw] h-[1.4vw] rounded-full bg-slate-900 flex items-center justify-center text-white text-[0.6vw] font-bold">{initials(u.name)}</div>
                  <div className="flex-1 min-w-0">
                     <div className="text-[0.72vw] font-bold text-black leading-tight truncate">{u.name}</div>
                     <div className="text-[0.55vw] text-slate-500 font-bold uppercase leading-none">{u.department}</div>
                  </div>
               </div>
            ))}
         </div>
       )}
    </div>
  );
};

const EmpSelectCell = ({ val, employees, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => { const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const sel = employees.find(e => e.userId === val);
  return (
    <div className="relative" ref={ref}>
       <div onClick={() => setOpen(!open)} className={`flex items-center gap-[0.3vw] bg-white border rounded-[0.2vw] px-[0.4vw] py-[0.2vw] transition-all cursor-pointer hover:border-black ${val ? "border-slate-300" : "border-dashed border-slate-300"}`}>
          <div className={`w-[1vw] h-[1vw] flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[0.5vw] ${sel ? "bg-slate-900" : "bg-slate-100 shadow-inner"}`}>
             {sel ? initials(sel.name) : <User className="w-[0.6vw] h-[0.6vw] text-slate-300" />}
          </div>
          <span className={`text-[0.68vw] font-bold flex-1 truncate ${val ? "text-slate-900" : "text-slate-300 uppercase"}`}>{sel ? sel.name : "Assign"}</span>
       </div>
       {open && (
         <div className="absolute top-full left-0 w-[12vw] mt-[0.1vw] bg-white border border-slate-300 shadow-2xl rounded-[0.3vw] max-h-[10vw] overflow-y-auto z-[200] py-[0.1vw]">
            {employees.map(u => (
               <div key={u.userId} onClick={() => { onSelect(u); setOpen(false); }} className={`px-[0.5vw] py-[0.3vw] flex items-center gap-[0.5vw] hover:bg-slate-50 cursor-pointer ${val === u.userId ? "bg-slate-50" : ""}`}>
                  <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-slate-900 flex items-center justify-center text-white text-[0.55vw] font-bold">{initials(u.name)}</div>
                  <div className="flex-1 min-w-0">
                     <div className="text-[0.68vw] font-bold text-black leading-tight truncate">{u.name}</div>
                     <div className="text-[0.5vw] text-slate-400 font-bold uppercase leading-none">{u.department}</div>
                  </div>
               </div>
            ))}
         </div>
       )}
    </div>
  );
};

const FinalStatusCell = ({ row, prod, onUpdateProduct }) => {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [remarks, setRemarks] = useState(prod.finalStatusRemarks || row.finalStatusRemarks || "");
  const [status, setStatus] = useState(prod.finalStatus || row.finalStatus || "Pending");
  const [statusDate, setStatusDate] = useState(prod.finalStatusDate || todayDateStr());
  const ref = useRef(null);
  const historyRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (historyRef.current && !historyRef.current.contains(e.target)) setShowHistory(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
    <div className="flex items-center gap-[0.4vw]">
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(!open)} className={`text-[0.65vw] px-[0.5vw] py-[0.15vw] rounded-full border font-bold flex items-center gap-[0.2vw] cursor-pointer transition-all ${cls}`}>
           {status} <ChevronDown className="w-[0.7vw] h-[0.7vw]" />
        </button>
        <AnimatePresence>
           {open && (
             <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full right-0 mt-[0.3vw] bg-white border border-slate-300 shadow-2xl rounded-[0.4vw] z-[100] w-[16vw] p-[0.8vw]">
                <div className="text-[0.7vw] font-bold text-black uppercase mb-[0.6vw]">Final Status</div>
                <div className="grid grid-cols-2 gap-[0.4vw] mb-[0.8vw]">
                   {FINAL_STATUS_OPTIONS.map(opt => (
                     <button key={opt} onClick={() => setStatus(opt)} className={`py-[0.35vw] rounded-[0.25vw] border text-[0.65vw] font-bold transition-all ${status === opt ? FINAL_STATUS_COLORS[opt] + " ring-1 ring-offset-1 ring-slate-400" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
                        {opt}
                     </button>
                   ))}
                </div>
                <div className="mb-[0.6vw]">
                   <label className="text-[0.6vw] font-bold text-slate-400 uppercase block mb-[0.2vw]">Status Date</label>
                   <input type="date" value={statusDate} onChange={e => setStatusDate(e.target.value)} className="w-full border border-slate-200 rounded-[0.2vw] px-[0.4vw] py-[0.35vw] text-[0.72vw] outline-none focus:border-black text-black font-medium" />
                </div>
                <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add remarks..." className="w-full border border-slate-200 rounded-[0.2vw] p-[0.4vw] text-[0.72vw] outline-none focus:border-black resize-none mb-[0.8vw] text-black font-medium" />
                <div className="flex justify-end gap-[0.4vw]">
                   <button onClick={() => setOpen(false)} className="px-[0.8vw] py-[0.3vw] text-[0.65vw] font-bold border border-slate-200 rounded-[0.25vw] hover:bg-slate-50 uppercase">Cancel</button>
                   <button onClick={handleSave} className="px-[0.8vw] py-[0.3vw] text-[0.65vw] bg-blue-600 text-white rounded-[0.25vw] font-bold uppercase hover:bg-blue-700 flex items-center gap-[0.3vw] shadow-md transition-all active:scale-95"><Save className="w-[0.7vw] h-[0.7vw]" /> Save</button>
                </div>
             </motion.div>
           )}
        </AnimatePresence>
      </div>
      <div className="relative" ref={historyRef}>
         <button onClick={() => setShowHistory(!showHistory)} title="Status History" className="p-[0.2vw] text-slate-300 hover:text-slate-900 transition-colors cursor-pointer"><Clock className="w-[0.9vw] h-[0.9vw]" /></button>
         <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full right-0 mt-[0.3vw] bg-white border border-slate-300 shadow-2xl rounded-[0.4vw] z-[100] w-[18vw] p-[0.8vw] overflow-hidden">
                 <div className="flex items-center justify-between mb-[0.8vw] pb-[0.4vw] border-b border-slate-100">
                    <div className="text-[0.7vw] font-bold text-black uppercase flex items-center gap-[0.3vw]"><Clock className="w-[0.8vw] h-[0.8vw]" /> Status History</div>
                    <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-black transition-colors"><X className="w-[0.8vw] h-[0.8vw]" /></button>
                 </div>
                 <div className="max-h-[12vw] overflow-y-auto space-y-[0.6vw] pr-[0.2vw]">
                    {(prod.finalStatusHistory || []).length > 0 ? [...prod.finalStatusHistory].reverse().map((h, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-[0.3vw] p-[0.5vw]">
                         <div className="flex justify-between items-start mb-[0.2vw]">
                            <span className={`text-[0.6vw] px-[0.35vw] py-[0.05vw] rounded font-bold border uppercase ${FINAL_STATUS_COLORS[h.status] || "bg-slate-100 text-slate-500"}`}>{h.status}</span>
                            <div className="text-right"><div className="text-[0.6vw] font-bold text-blue-600 leading-none">{h.date ? fmtDate(h.date) : "—"}</div><div className="text-[0.5vw] text-slate-400 font-bold mt-[0.1vw]">{new Date(h.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div>
                         </div>
                         <div className="text-[0.65vw] font-medium text-slate-700 italic">"{h.remarks || "No remarks"}"</div>
                      </div>
                    )) : <div className="py-[1vw] text-center text-[0.65vw] text-slate-300 font-bold uppercase">No history found</div>}
                 </div>
              </motion.div>
            )}
         </AnimatePresence>
      </div>
    </div>
  );
};

const ProductRow = ({ prod, idx, employees, onUpdate, onRemove, isReadOnly }) => {
  const [expanded, setExpanded] = useState(true);
  const sp = (k, v) => onUpdate({ ...prod, [k]: v });
  return (
    <div className="border border-slate-200 rounded-[0.3vw] bg-white shadow-sm mb-[0.8vw]">
      <div className="flex items-center gap-[0.8vw] px-[0.8vw] py-[0.4vw] bg-slate-50 border-b border-slate-100 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="w-[1.4vw] h-[1.4vw] bg-slate-900 text-white rounded-full flex items-center justify-center text-[0.6vw] font-bold">{idx + 1}</span>
        <div className="flex-1 min-w-0">
           <div className="text-[0.8vw] font-bold text-black truncate uppercase">{prod.productDescription || "Job Product Selection Required"}</div>
           <div className="text-[0.6vw] text-slate-400 font-bold uppercase">{prod.jobOrderNo || "Awaiting Fetch"}</div>
        </div>
        <div className="flex items-center gap-[0.8vw]" onClick={e => e.stopPropagation()}>
           {!isReadOnly && <button type="button" onClick={() => onRemove(prod._pid)} className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-[0.9vw] h-[0.9vw]" /></button>}
           {expanded ? <ChevronUp className="w-[1vw] h-[1vw] text-slate-400" /> : <ChevronDown className="w-[1vw] h-[1vw] text-slate-400" />}
        </div>
      </div>
      <AnimatePresence>
         {expanded && (
           <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-visible">
              <div className="p-[0.8vw] space-y-[0.8vw]">
                 <div className="grid grid-cols-5 gap-[0.6vw]">
                    <ReadCell label="Customer Name" val={prod.customerName} />
                    <ReadCell label="Cust Code" val={prod.customerCode} />
                    <ReadCell label="Prod Code" val={prod.productCode} />
                    <ReadCell label="Category" val={prod.category} />
                    <ReadCell label="Description" val={prod.productDescription} />
                 </div>
                 <div className="grid grid-cols-2 gap-[0.8vw]">
                    <div className="flex flex-col gap-[0.1vw]">
                       <label className="text-[0.65vw] font-bold text-black uppercase">Quantity (Mandatory)</label>
                       <input type="number" value={prod.quantity} onChange={e => sp("quantity", e.target.value)} disabled={isReadOnly} className="border border-slate-300 rounded-[0.2vw] py-[0.4vw] px-[0.6vw] text-[0.75vw] text-black font-medium outline-none focus:border-black" />
                    </div>
                    <div className="flex flex-col gap-[0.1vw]">
                       <label className="text-[0.65vw] font-bold text-black uppercase">Batch no / Serial number (Mandatory)</label>
                       <input value={prod.identification} onChange={e => sp("identification", e.target.value)} disabled={isReadOnly} placeholder="Enter Batch/SN..." className="border border-slate-300 rounded-[0.2vw] py-[0.4vw] px-[0.6vw] text-[0.75vw] text-black font-medium outline-none focus:border-black" />
                    </div>
                 </div>
                 <div className="grid grid-cols-3 gap-[1vw] pt-[0.4vw] border-t border-slate-50">
                    <EmpSelect label="Assembled By" val={prod.assembledBy} employees={employees} onSelect={u => onUpdate({...prod, assembledBy: u.userId, assembledByName: u.name})} disabled={isReadOnly} />
                    <EmpSelect label="Tested By" val={prod.testedBy} employees={employees} onSelect={u => onUpdate({...prod, testedBy: u.userId, testedByName: u.name})} disabled={isReadOnly} />
                    <EmpSelect label="FI (Final Inspection) By" val={prod.fiBy} employees={employees} onSelect={u => onUpdate({...prod, fiBy: u.userId, fiByName: u.name})} disabled={isReadOnly} />
                 </div>
              </div>
           </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

const ReadCell = ({ label, val }) => (
  <div className="flex flex-col gap-[0.1vw]">
    <label className="text-[0.6vw] font-bold text-black uppercase">{label}</label>
    <div className="bg-slate-50 border border-slate-100 rounded-[0.2vw] py-[0.35vw] px-[0.5vw] text-[0.72vw] font-medium text-slate-800 truncate">{val || "—"}</div>
  </div>
);

// --- JOSearchModal ---
const JOSearchModal = ({ onSelect, onClose, customerDb }) => {
  const [q, setQ] = useState("");
  const items = useMemo(() => Object.values(customerDb).flat(), [customerDb]);
  const res = useMemo(() => items.filter(it => !q || (it.itemDescription||"").toLowerCase().includes(q.toLowerCase()) || (it.partyDescription||"").toLowerCase().includes(q.toLowerCase()) || (it.itemCode||"").toLowerCase().includes(q.toLowerCase())).slice(0, 50), [items, q]);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-[2vw]">
      <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[0.4vw] shadow-2xl w-[35vw] max-h-[65vh] flex flex-col border border-slate-300 overflow-hidden">
        <div className="p-[0.8vw] bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
           <h3 className="font-bold text-[0.85vw] uppercase">Job Order Search Catalog</h3>
           <button onClick={onClose} className="cursor-pointer hover:opacity-70"><X className="w-[1vw] h-[1vw]" /></button>
        </div>
        <div className="p-[0.8vw] border-b border-slate-100 relative bg-slate-50">
           <Search className="absolute left-[1.4vw] top-1/2 -translate-y-1/2 w-[0.9vw] h-[0.9vw] text-slate-400" />
           <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type product name or Job Order code..." className="w-full pl-[2.2vw] pr-[0.8vw] py-[0.5vw] border border-slate-200 rounded-[0.25vw] text-[0.78vw] text-black outline-none focus:border-black font-medium" />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
           {res.map((it, i) => (
              <div key={i} onClick={() => onSelect(it)} className="px-[1vw] py-[0.6vw] flex justify-between items-center cursor-pointer hover:bg-slate-50 group">
                 <div className="min-w-0">
                    <div className="text-[0.78vw] font-bold text-slate-800 uppercase truncate">{it.itemDescription}</div>
                    <div className="text-[0.6vw] text-slate-400 font-bold uppercase">{it.partyDescription} · {it.itemCode}</div>
                 </div>
                 <button className="bg-slate-900 text-white px-[0.75vw] py-[0.35vw] rounded-[0.2vw] text-[0.6vw] font-bold active:scale-95 cursor-pointer uppercase">Select</button>
              </div>
           ))}
        </div>
      </motion.div>
    </div>
  );
}

// --- Inward Form Page ---
const InwardForm = ({ initialData, customerDb, employees, onSave, onBack }) => {
  const { toast } = useNotification();
  const [base, setBase] = useState(() => ({ date: initialData.date || todayDateStr(), stage: initialData.stage || "Assembly", refNoInternal: initialData.refNoInternal || genRef() }));
  const [products, setProducts] = useState(() => initialData.products || [emptyProduct()]);
  const [showJO, setShowJO] = useState(false);
  const isReadOnly = !!initialData._readonly;

  const handleJO = it => {
    const r = Math.floor(100 + Math.random() * 900);
    const np = { ...emptyProduct(), jobOrderNo: `JO-${it.itemCode}-${r}`, customerName: it.partyDescription, customerCode: it.partyCode, productCode: it.itemCode, productDescription: it.itemDescription, category: it.productSegment || "" };
    if (products.length === 1 && !products[0].jobOrderNo) setProducts([np]); else setProducts([...products, np]);
    setShowJO(false);
  };

  const submit = () => {
    if (products.some(p => !p.jobOrderNo)) return toast("Please select a Product via JO Fetch", "error");
    if (products.some(p => !p.quantity || !p.identification)) return toast("Quantity and Batch/Serial are mandatory fields", "warning");
    onSave({ ...base, products });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      <div className="px-[1.2vw] py-[0.8vw] flex justify-between items-center border-b border-slate-200 bg-white z-[20]">
         <div className="flex items-center gap-[1vw]">
            <button onClick={onBack} className="w-[2vw] h-[2vw] rounded-full hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"><ArrowLeft className="w-[1.1vw] h-[1.1vw] text-black" /></button>
            <h2 className="text-[1.1vw] font-bold text-black uppercase tracking-tight">{initialData.id ? "Edit NC Registration" : "Register New Production NC"}</h2>
         </div>
         <div className="text-[0.65vw] font-bold font-mono text-slate-400 border border-slate-200 px-[0.65vw] py-[0.15vw] rounded uppercase">{base.refNoInternal}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-[1.5vw]">
         <div className="max-w-[75vw] mx-auto space-y-[1.2vw]">
            <section className="bg-white p-[1.2vw] rounded-[0.4vw] shadow-sm border border-slate-300">
               <div className="flex items-center gap-[0.5vw] border-b border-slate-50 pb-[0.8vw] mb-[1vw]">
                  <ClipboardList className="w-[1.1vw] h-[1.1vw] text-slate-300" />
                  <h3 className="text-[0.8vw] font-bold text-black uppercase">Core Registration Details</h3>
               </div>
               <div className="grid grid-cols-3 gap-[1.5vw]">
                  <div className="flex flex-col gap-[0.2vw]">
                     <label className="text-[0.65vw] font-bold text-black uppercase">Date</label>
                     <input type="date" value={base.date} onChange={e => setBase({...base, date: e.target.value})} disabled={isReadOnly} className="border border-slate-300 rounded-[0.25vw] py-[0.45vw] px-[0.6vw] text-[0.78vw] text-black font-medium outline-none focus:border-black" />
                  </div>
                  <div className="flex flex-col gap-[0.2vw]">
                     <label className="text-[0.65vw] font-bold text-black uppercase">Stage</label>
                     <select value={base.stage} onChange={e => setBase({...base, stage: e.target.value})} disabled={isReadOnly} className="border border-slate-300 rounded-[0.25vw] py-[0.45vw] px-[0.6vw] text-[0.78vw] text-black font-medium focus:border-black outline-none bg-white">
                        {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  </div>
                  <div className="flex flex-col justify-end">
                     {!isReadOnly && <button onClick={() => setShowJO(true)} className="flex items-center justify-center gap-[0.6vw] bg-slate-900 text-white py-[0.6vw] rounded-[0.3vw] text-[0.7vw] font-bold uppercase shadow-lg hover:bg-black transition-all active:scale-95 cursor-pointer"><Target className="w-[1vw] h-[1vw]" /> Add Product via Auto-Fetch</button>}
                  </div>
               </div>
            </section>
            
            <div className="space-y-[1vw]">
               {products.map((p, i) => (
                 <ProductRow key={p._pid} prod={p} idx={i} employees={employees} isReadOnly={isReadOnly} onUpdate={np => setProducts(products.map(x => x._pid === p._pid ? np : x))} onRemove={id => setProducts(products.filter(x => x._pid !== id))} />
               ))}
            </div>

            {!isReadOnly && (
               <div className="flex justify-end pt-[0.5vw]">
                  <button onClick={submit} className="flex items-center gap-[0.8vw] bg-blue-600 hover:bg-blue-700 text-white px-[2.5vw] py-[0.75vw] rounded-[0.4vw] font-bold text-[0.82vw] shadow-xl active:scale-95 transition-all uppercase cursor-pointer">
                     <Save className="w-[1.2vw] h-[1.2vw]" /> Complete Registration
                  </button>
               </div>
            )}
         </div>
      </div>
      {showJO && <JOSearchModal customerDb={customerDb} onSelect={handleJO} onClose={() => setShowJO(false)} />}
    </div>
  );
};

// --- Main List Screen ---
export default function ProductionMaterial() {
  const { toast } = useNotification();
  const [data, setData] = useState(() => lsLoad(PM_INWARD_KEY, []));
  const [view, setView] = useState("list");
  const [sel, setSel] = useState(null);
  const [shRep, setShRep] = useState(null);
  const [q, setQ] = useState("");
  const customerDb = useMemo(() => lsLoad(CUSTOMER_DB_KEY, []), []);
  const employees = useMemo(() => lsLoad(EMPLOYEES_KEY, []), []);

  const save = en => {
    let nd = sel?.id ? data.map(d => d.id === sel.id ? { ...en, id: d.id, updatedAt: new Date().toISOString() } : d) : [{ ...en, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...data];
    setData(nd); lsSave(PM_INWARD_KEY, nd); setView("list"); setSel(null); toast("Inward Registration Completed", "success");
  };

  const onUpdateProduct = (rowId, productId, updates) => {
    const nd = data.map(d => d.id === rowId ? {
      ...d,
      products: (d.products || []).map(p => p._pid === productId ? { ...p, ...updates } : p),
      updatedAt: new Date().toISOString()
    } : d);
    setData(nd); lsSave(PM_INWARD_KEY, nd);
  };

  if (view === "form") return <InwardForm initialData={sel || {}} customerDb={customerDb} employees={employees} onBack={() => { setView("list"); setSel(null); }} onSave={save} />;

  const filteredData = data.filter(d => !q || (d.refNoInternal||"").toLowerCase().includes(q.toLowerCase()) || d.products?.some(p => (p.customerName||"").toLowerCase().includes(q.toLowerCase()) || (p.productDescription||"").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="w-full h-full flex flex-col bg-white p-[1.2vw] gap-[0.8vw]">
       <div className="flex justify-between items-end border-b border-slate-100 pb-[0.6vw]">
          <div><h1 className="text-[1.2vw] font-bold text-black uppercase tracking-tight flex items-center gap-[0.5vw]"><Package className="w-[1.5vw] h-[1.5vw]" /> Production Material Inward Register</h1></div>
          <button onClick={() => { setSel(null); setView("form"); }} className="bg-slate-900 text-white rounded-[0.3vw] py-[0.65vw] px-[1.5vw] font-bold text-[0.75vw] flex items-center gap-[0.6vw] shadow-md hover:bg-black active:scale-95 transition-all cursor-pointer uppercase"><Plus className="w-[1vw] h-[1vw]" /> New Inward Entry</button>
       </div>

       <div className="flex items-center gap-[1vw] bg-slate-50 p-[0.6vw] rounded-[0.3vw] border border-slate-200">
          <div className="flex-1 relative">
             <Search className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 w-[0.9vw] h-[0.9vw] text-slate-400" />
             <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by Ref No, Product Name or Customer..." className="w-full pl-[2.2vw] pr-[0.8vw] py-[0.5vw] bg-white border border-slate-300 rounded-[0.25vw] text-[0.75vw] font-medium text-black outline-none focus:border-black" />
          </div>
       </div>

       <div className="border border-slate-200 rounded-[0.3vw] flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse text-[0.72vw]">
             <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[0.68vw] text-black font-bold uppercase">
                   <th rowSpan={2} className="px-[1vw] py-[0.8vw] border-r border-slate-200">Date / Ref No</th>
                   <th rowSpan={2} className="px-[1vw] py-[0.8vw] border-r border-slate-200">Stage</th>
                   <th colSpan={6} className="px-[1vw] py-[0.5vw] border-r border-slate-200 text-center bg-slate-100/50">Production Unit Details</th>
                   <th rowSpan={2} className="px-[1vw] py-[0.8vw] border-r border-slate-200">Status</th>
                   <th rowSpan={2} className="px-[1vw] py-[0.8vw] border-r border-slate-200">Remarks</th>
                   <th rowSpan={2} className="px-[1vw] py-[0.8vw] border-r border-slate-200 text-center">Control</th>
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200 text-[0.6vw] text-slate-500 font-bold uppercase">
                   <th className="px-[0.8vw] py-[0.4vw] border-r border-slate-200">Product / JO No</th>
                   <th className="px-[0.8vw] py-[0.4vw] border-r border-slate-200">Qty / SN</th>
                   <th className="px-[0.8vw] py-[0.4vw] border-r border-slate-200">Customer</th>
                   <th className="px-[0.8vw] py-[0.4vw] border-r border-slate-200">Assembled</th>
                   <th className="px-[0.8vw] py-[0.4vw] border-r border-slate-200">Tested</th>
                   <th className="px-[0.8vw] py-[0.4vw] border-r border-slate-200">FI By</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {filteredData.flatMap(row => {
                   const products = row.products || [];
                   const span = products.length;
                   return products.map((prod, pi) => (
                      <tr key={`${row.id}-${pi}`} className={`hover:bg-slate-50/50 transition-colors ${pi === 0 ? "border-t border-slate-200" : "border-t border-slate-100 border-dashed"}`}>
                         {pi === 0 && (
                            <>
                               <td rowSpan={span} className="px-[1vw] py-[0.8vw] border-r border-slate-200 align-top">
                                  <div className="text-black font-bold">{fmtDate(row.date)}</div>
                                  <div className="text-[0.6vw] text-slate-400 font-bold uppercase">{row.refNoInternal}</div>
                               </td>
                               <td rowSpan={span} className="px-[1vw] py-[0.8vw] border-r border-slate-200 align-top">
                                  <span className="text-slate-700 font-bold uppercase border border-slate-200 bg-white px-[0.4vw] py-[0.1vw] rounded text-[0.65vw]">{row.stage}</span>
                               </td>
                            </>
                         )}
                         <td className="px-[0.8vw] py-[0.6vw] border-r border-slate-200">
                            <div className="text-black font-bold text-[0.72vw] uppercase truncate max-w-[12vw]" title={prod.productDescription}>{prod.productDescription}</div>
                            <div className="text-[0.6vw] text-slate-400 font-bold uppercase">{prod.jobOrderNo}</div>
                         </td>
                         <td className="px-[0.8vw] py-[0.6vw] border-r border-slate-200 font-medium whitespace-nowrap">
                            <div className="text-black font-bold text-[0.72vw]">{prod.quantity} Units</div>
                            <div className="text-[0.6vw] text-slate-400 font-bold uppercase truncate max-w-[7vw]" title={prod.identification}>{prod.identification || "—"}</div>
                         </td>
                         <td className="px-[0.8vw] py-[0.6vw] border-r border-slate-200 text-slate-600 font-medium text-[0.7vw] uppercase max-w-[10vw] truncate" title={prod.customerName}>
                           {prod.customerName}
                         </td>
                         <td className="px-[0.8vw] py-[0.6vw] border-r border-slate-200">
                            <EmpSelectCell val={prod.assembledBy} employees={employees} onSelect={u => onUpdateProduct(row.id, prod._pid, {assembledBy: u.userId, assembledByName: u.name})} />
                         </td>
                         <td className="px-[0.8vw] py-[0.6vw] border-r border-slate-200">
                            <EmpSelectCell val={prod.testedBy} employees={employees} onSelect={u => onUpdateProduct(row.id, prod._pid, {testedBy: u.userId, testedByName: u.name})} />
                         </td>
                         <td className="px-[0.8vw] py-[0.6vw] border-r border-slate-200">
                            <EmpSelectCell val={prod.fiBy} employees={employees} onSelect={u => onUpdateProduct(row.id, prod._pid, {fiBy: u.userId, fiByName: u.name})} />
                         </td>
                         
                         <td className="px-[1vw] py-[0.8vw] border-r border-slate-200">
                            <FinalStatusCell row={row} prod={prod} onUpdateProduct={onUpdateProduct} />
                         </td>
                         <td className="px-[1vw] py-[0.8vw] border-r border-slate-200">
                            <div className="text-[0.7vw] text-slate-700 font-medium italic max-w-[10vw] truncate" title={prod.finalStatusRemarks || row.finalStatusRemarks}>
                               {prod.finalStatusRemarks || (pi === 0 ? row.finalStatusRemarks : "") || "—"}
                            </div>
                            {prod.finalStatusDate && <div className="text-[0.55vw] text-blue-500 font-bold mt-[0.1vw]">{fmtDate(prod.finalStatusDate)}</div>}
                         </td>

                         {pi === 0 && (
                           <td rowSpan={span} className="px-[1vw] py-[0.8vw] flex flex-wrap justify-center gap-[0.4vw] items-center border-l border-slate-200">
                              <button onClick={() => setShRep(row)} title="View Reports" className="p-[0.4vw] border border-slate-200 text-slate-400 rounded-[0.3vw] font-bold hover:bg-slate-900 hover:text-white transition-all cursor-pointer"><Eye className="w-[1vw] h-[1vw]" /></button>
                              <button onClick={() => { setSel(row); setView("form"); }} title="Edit Entry" className="p-[0.4vw] text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"><Edit3 className="w-[1vw] h-[1vw]" /></button>
                           </td>
                         )}
                      </tr>
                   ))
                })}
                {data.length === 0 && <tr><td colSpan={11} className="py-[10vh] text-center text-slate-300 font-bold uppercase text-[0.9vw]">No records found in the Inward Register</td></tr>}
             </tbody>
          </table>
       </div>
       {shRep && <ReportsModal row={shRep} onClose={() => setShRep(null)} />}
    </div>
  );
}