import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Package, Clock, User, CheckCircle, AlertCircle, X, Eye, Send,
  FileText, Calendar, Hash, Tag, Wrench,
  AlertTriangle, Info, ChevronDown, Plus, Search, Check, Edit3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useNotification } from "../components/NotificationContext";

const API_URL = import.meta.env.VITE_API_URL;

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

const todayDateStr = () => new Date().toISOString().slice(0, 10);

// ── Badge ─────────────────────────────────────────────────────────────────────
const Badge = ({ label, color = "gray", size = "sm" }) => {
  const colorMap = {
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    slate:  "bg-slate-100 text-slate-600 border-slate-200",
    gray:   "bg-gray-100 text-gray-600 border-gray-200",
    black:  "bg-gray-900 text-white border-gray-900",
    red:    "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  const sizeMap = {
    xs: "text-[0.58vw] px-[0.35vw] py-[0.08vw]",
    sm: "text-[0.65vw] px-[0.45vw] py-[0.12vw]",
    md: "text-[0.72vw] px-[0.55vw] py-[0.15vw]",
  };
  return (
    <span className={`${sizeMap[size]} rounded-full border font-semibold whitespace-nowrap inline-flex items-center ${colorMap[color] || colorMap.gray}`}>
      {label}
    </span>
  );
};

// ── Status Configuration ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  "Open":               { color: "gray",   icon: AlertCircle,    bg: "bg-gray-100",   border: "border-gray-400",   text: "text-gray-700" },
  "Under Testing":      { color: "blue",   icon: Wrench,         bg: "bg-blue-100",   border: "border-blue-300",   text: "text-blue-800" },
  "Repair in Progress": { color: "orange", icon: Wrench,         bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800" },
  "Pending":            { color: "slate",  icon: Clock,          bg: "bg-slate-100",  border: "border-slate-300",  text: "text-slate-800" },
  "Completed":          { color: "green",  icon: CheckCircle,    bg: "bg-green-100",  border: "border-green-300",  text: "text-green-800" },
  "Not Repairable":     { color: "red",    icon: AlertTriangle,  bg: "bg-red-100",    border: "border-red-300",    text: "text-red-800" },
};

// ── Read-only Input Field ─────────────────────────────────────────────────────
const RefInput = ({ label, value, span = 1 }) => (
  <div className={`flex flex-col gap-[0.25vw] ${span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : span === 4 ? "col-span-4" : ""}`}>
    <label className="text-[0.75vw] font-semibold text-black flex items-start gap-[0.25vw]">
      {label}
    </label>
    <div className="bg-white border border-gray-300 rounded-[0.4vw] py-[0.45vw] px-[0.6vw] text-[0.8vw] text-gray-900 break-words whitespace-normal overflow-hidden min-h-[2.4vw]">
      {value || "—"}
    </div>
  </div>
);

// ── Searchable Select Component ────────────────────────────────────────────────
const SearchableSelect = ({ label, value, options, onSelect, placeholder = "Select...", mandatory = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-[0.3vw]" ref={dropdownRef}>
      <label className="text-[0.8vw] font-semibold text-black">
        {label} {mandatory && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full border border-gray-300 bg-white rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] text-left flex items-center justify-between transition-all cursor-pointer shadow-sm ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}`}
        >
          <span className={selectedOption ? "text-black font-medium" : "text-gray-400"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={`w-[1vw] h-[1vw] text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-[100] w-full mt-[0.2vw] bg-white border border-gray-300 rounded-[0.4vw] shadow-xl overflow-hidden flex flex-col"
            >
              <div className="p-[0.4vw] border-b border-gray-100 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.8vw] h-[0.8vw] text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-[1.8vw] pr-[0.6vw] py-[0.4vw] text-[0.75vw] border border-gray-200 rounded-[0.3vw] outline-none focus:border-blue-400 bg-white"
                  />
                </div>
              </div>
              <div className="max-h-[12vw] overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => {
                        onSelect(opt.value, opt.label);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                      className={`px-[0.8vw] py-[0.5vw] text-[0.78vw] cursor-pointer flex items-center justify-between hover:bg-blue-50 transition-colors ${value === opt.value ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"}`}
                    >
                      <span>{opt.label}</span>
                      {value === opt.value && <Check className="w-[0.9vw] h-[0.9vw]" />}
                    </div>
                  ))
                ) : (
                  <div className="px-[0.8vw] py-[1vw] text-[0.75vw] text-gray-400 text-center italic">No results found</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Production Response Modal ──────────────────────────────────────────────────
const ProductionResponseModal = ({ entry, product, employees, fourMCategories, onSave, onClose, caeHistory }) => {
  const [formData, setFormData] = useState({
    startDate: product.report?.startDate?.split("T")[0] || todayDateStr(),
    fourMCategory: product.report?.fourMCategory || "",
    rootCause: product.report?.rootCause || "",
    correctiveAction: product.report?.correctiveAction || "",
    closedDate: product.report?.closedDate?.split("T")[0] || "",
    assembledBy: product.report?.assembledBy || "",
    assembledByName: product.report?.assembledByName || "",
    testedBy: product.report?.testedBy || "",
    testedByName: product.report?.testedByName || "",
    fiBy: product.report?.fiBy || "",
    fiByName: product.report?.fiByName || "",
    verifiedBy: product.report?.verifiedBy || "",
    verifiedByName: product.report?.verifiedByName || "",
    verifiedDate: product.report?.verifiedDate?.split("T")[0] || "",
    cae: product.report?.cae || "",
    partsReplacement: product.report?.partsReplacement || "",
    status: product.report?.status || "Under Testing",
    currentRemark: ""
  });

  const STATUS_OPTIONS = ["Under Testing", "Repair in Progress", "Pending", "Completed", "Not Repairable"];
  
  const employeeOptions = useMemo(() => 
    employees.map(e => ({ value: e.userId || e.id, label: e.name })), 
  [employees]);

  const sp = (k, v) => setFormData(p => ({ ...p, [k]: v }));

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
    if (!formData.rootCause.trim()) return alert("Root Cause Analysis is mandatory.");
    if (!formData.correctiveAction.trim()) return alert("Corrective Action is mandatory.");
    if (formData.status === "Completed" && !formData.closedDate) return alert("Closed Date is mandatory for 'Completed' status.");

    const historyEntry = {
      status: formData.status,
      remark: formData.currentRemark,
      timestamp: new Date().toISOString()
    };

    const updatedReport = {
      ...formData,
      lastUpdated: new Date().toISOString(),
      history: [...(product.report?.history || []), historyEntry]
    };

    onSave(updatedReport);
  };

  const currentStatus = STATUS_CONFIG[formData.status] || STATUS_CONFIG["Open"];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-[2vw]">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-[60vw] max-h-[95vh] rounded-[0.8vw] shadow-2xl overflow-hidden flex flex-col border border-gray-400"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-[1.5vw] py-[1vw] flex justify-between items-center shadow-md">
          <div className="flex items-center gap-[0.8vw]">
            <div className="w-[2.4vw] h-[2.4vw] rounded-[0.6vw] bg-white/20 backdrop-blur flex items-center justify-center border border-white/20">
              <FileText className="w-[1.2vw] h-[1.2vw] text-white" />
            </div>
            <div>
              <h3 className="text-[1.1vw] font-bold text-white uppercase tracking-tight">Production Technical Resolution</h3>
              <p className="text-[0.75vw] text-blue-100 font-medium">{product.productDescription} · {entry.refNoInternal}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-[2vw] h-[2vw] rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-all">
            <X className="w-[1.1vw] h-[1.1vw]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[1.5vw] space-y-[1.5vw] bg-gray-50/30">
          
          {/* Reference Info */}
          <div className="bg-white rounded-[0.6vw] border border-gray-300 shadow-sm overflow-hidden">
            <div className="bg-blue-50/50 px-[1vw] py-[0.6vw] border-b border-gray-200 flex items-center gap-[0.5vw]">
              <Info className="w-[0.9vw] h-[0.9vw] text-blue-600" />
              <span className="text-[0.75vw] font-bold text-blue-700 uppercase tracking-wider">Inward Details</span>
            </div>
            <div className="p-[1vw] grid grid-cols-4 gap-[1.5vw]">
              <RefInput label="Registration Date" value={fmtDate(entry.date)} />
              <RefInput label="Job Order No" value={entry.jobOrderNo} />
              <RefInput label="Customer Name" value={entry.customerName} />
              <RefInput label="Customer Code" value={entry.customerCode} />
              
              <RefInput label="Product Description" value={product.productDescription} span={2} />
              <RefInput label="Product Code" value={product.productCode} />
              <RefInput label="Category" value={entry.category} />

              <RefInput label="Stage" value={product.stage} />
              <RefInput label="Reported Problem" value={product.problem} span={2} />
              <RefInput label="Qty" value={product.qty} />
            </div>
          </div>

          {/* Technical Resolution Form */}
          <div className="bg-white rounded-[0.6vw] border border-gray-300 shadow-sm overflow-hidden">
            <div className="bg-emerald-50/50 px-[1vw] py-[0.6vw] border-b border-gray-200 flex items-center gap-[0.5vw]">
              <Wrench className="w-[0.9vw] h-[0.9vw] text-emerald-600" />
              <span className="text-[0.75vw] font-bold text-emerald-700 uppercase tracking-wider">Resolution Report</span>
            </div>
            <div className="p-[1.2vw] space-y-[1.2vw]">
              <div className="grid grid-cols-4 gap-[1vw]">
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">Start Date <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.startDate} onChange={e => sp("startDate", e.target.value)} className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 shadow-sm" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">4M Category <span className="text-red-500">*</span></label>
                  <select value={formData.fourMCategory} onChange={e => sp("fourMCategory", e.target.value)} className="border border-gray-300 bg-white rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 shadow-sm cursor-pointer">
                    <option value="">Select Category</option>
                    {fourMCategories?.map(c => <option key={c._id || c.id} value={c.name || c}>{c.name || c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.3vw] col-span-2 relative">
                  <label className="text-[0.8vw] font-semibold text-black">CAE (Corrective Action Execution)</label>
                  <div className="relative">
                    <input 
                      value={formData.cae} 
                      onChange={e => { sp("cae", e.target.value); setShowCaeSuggestions(true); setActiveCaeSuggestion(-1); }}
                      onFocus={() => setShowCaeSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCaeSuggestions(false), 200)}
                      onKeyDown={handleCaeKeyDown}
                      placeholder="Enter or select CAE..."
                      className="w-full border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 shadow-sm"
                    />
                    <AnimatePresence>
                      {showCaeSuggestions && filteredCaeSuggestions.length > 0 && (
                        <motion.ul initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-50 w-full mt-[0.2vw] bg-white border border-gray-300 rounded-[0.4vw] shadow-xl max-h-[10vw] overflow-y-auto">
                          {filteredCaeSuggestions.map((opt, i) => (
                            <li key={i} onClick={() => { sp("cae", opt); setShowCaeSuggestions(false); }} className={`px-[0.8vw] py-[0.5vw] text-[0.78vw] cursor-pointer transition-colors ${i === activeCaeSuggestion ? "bg-blue-100 text-blue-800" : "hover:bg-gray-50 text-gray-700"}`}>{opt}</li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[1vw]">
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">Root Cause(s) <span className="text-red-500">*</span></label>
                  <textarea rows="3" value={formData.rootCause} onChange={e => sp("rootCause", e.target.value)} placeholder="Analyze the problem source..." className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 resize-none shadow-sm" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">Corrective Action <span className="text-red-500">*</span></label>
                  <textarea rows="3" value={formData.correctiveAction} onChange={e => sp("correctiveAction", e.target.value)} placeholder="Action taken to prevent recurrence..." className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 resize-none shadow-sm" />
                </div>
              </div>

              <div className="flex flex-col gap-[0.3vw]">
                <label className="text-[0.8vw] font-semibold text-black">Parts replacement details</label>
                <textarea rows="2" value={formData.partsReplacement} onChange={e => sp("partsReplacement", e.target.value)} placeholder="Enter parts replaced (comma separated)..." className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 resize-none shadow-sm w-full" />
              </div>

              <div className="grid grid-cols-4 gap-[1vw]">
                <SearchableSelect label="Assembled By" value={formData.assembledBy} options={employeeOptions} onSelect={(val, lbl) => { sp("assembledBy", val); sp("assembledByName", lbl); }} placeholder="Search employee..." />
                <SearchableSelect label="Tested By" value={formData.testedBy} options={employeeOptions} onSelect={(val, lbl) => { sp("testedBy", val); sp("testedByName", lbl); }} placeholder="Search employee..." />
                <SearchableSelect label="FI By" value={formData.fiBy} options={employeeOptions} onSelect={(val, lbl) => { sp("fiBy", val); sp("fiByName", lbl); }} placeholder="Search employee..." />
                <SearchableSelect label="Verified By" value={formData.verifiedBy} options={employeeOptions} onSelect={(val, lbl) => { sp("verifiedBy", val); sp("verifiedByName", lbl); }} placeholder="Search employee..." />
              </div>

              <div className="grid grid-cols-4 gap-[1vw]">
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">Closed Date {formData.status === "Completed" && <span className="text-red-500">*</span>}</label>
                  <input type="date" value={formData.closedDate} onChange={e => sp("closedDate", e.target.value)} className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 shadow-sm" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">Verified Date</label>
                  <input type="date" value={formData.verifiedDate} onChange={e => sp("verifiedDate", e.target.value)} className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 shadow-sm" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">Current Status <span className="text-red-500">*</span></label>
                  <select value={formData.status} onChange={e => sp("status", e.target.value)} className={`border-2 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none shadow-sm cursor-pointer ${currentStatus.bg} ${currentStatus.border} ${currentStatus.text} font-bold`}>
                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-blue-600">Action Remark</label>
                  <input value={formData.currentRemark} onChange={e => sp("currentRemark", e.target.value)} placeholder="Quick update note..." className="border border-blue-300 bg-blue-50/20 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 shadow-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-[1.5vw] py-[1vw] border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <p className="text-[0.7vw] text-gray-500 font-medium uppercase tracking-wider">
            Ensuring high-quality production standards
          </p>
          <div className="flex gap-[0.8vw]">
            <button onClick={onClose} className="px-[1.5vw] py-[0.6vw] border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-[0.4vw] text-[0.8vw] cursor-pointer transition-all">Cancel</button>
            <button onClick={handleSave} className="px-[1.8vw] py-[0.6vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.4vw] text-[0.8vw] font-bold cursor-pointer shadow-lg shadow-blue-900/20 flex items-center gap-[0.5vw] transition-all active:scale-95">
              <Send className="w-[1vw] h-[1vw]" />
              Submit Report
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Page Component ────────────────────────────────────────────────────────
export default function ProductionMaterialResponse() {
  const { toast } = useNotification();
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [fourMCategories, setFourMCategories] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [loading, setLoading] = useState(true);

  // Load User
  useEffect(() => {
    const raw = sessionStorage.getItem("loggedInUser") || localStorage.getItem("loggedInUser");
    if (raw) {
      try { setCurrentUser(JSON.parse(raw)); } catch {}
    }
  }, []);

  const fetchData = async () => {
    try {
      const [matRes, empRes, catRes] = await Promise.all([
        axios.get(`${API_URL}/production-material`),
        axios.get(`${API_URL}/auth/employees`),
        axios.get(`${API_URL}/master/four-m-categories`)
      ]);
      setEntries(matRes.data.map(e => ({ ...e, id: e._id })));
      setEmployees(empRes.data);
      setFourMCategories(catRes.data);
    } catch (err) {
      console.error("Data fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const claimProduct = async (id, productId) => {
    if (!currentUser) return toast("Login required", "error");
    try {
      const res = await axios.patch(`${API_URL}/production-material/${id}/claim-product`, {
        productId,
        userId: currentUser.userId || currentUser.id,
        userName: currentUser.name
      });
      setEntries(prev => prev.map(e => e.id === id ? { ...res.data, id: res.data._id } : e));
      toast("Product claimed successfully", "success");
    } catch (err) {
      toast(err.response?.data?.message || "Claim failed", "error");
    }
  };

  const handleSaveReport = async (report) => {
    try {
      const res = await axios.patch(`${API_URL}/production-material/${selected.entry.id}/product/${selected.product._pid}/report`, {
        report
      });
      setEntries(prev => prev.map(e => e.id === selected.entry.id ? { ...res.data, id: res.data._id } : e));
      setSelected(null);
      toast("Technical report updated", "success");
    } catch (err) {
      toast("Update failed", "error");
    }
  };

  const allProducts = useMemo(() => {
    const list = [];
    entries.forEach(entry => {
      entry.products?.forEach(product => {
        const status = product.report?.status || "Open";
        if (filterStatus === "All" || status === filterStatus) {
          list.push({ entry, product });
        }
      });
    });
    return list;
  }, [entries, filterStatus]);

  const caeHistory = useMemo(() => {
    const set = new Set();
    entries.forEach(e => e.products?.forEach(p => p.report?.cae && set.add(p.report.cae)));
    return Array.from(set);
  }, [entries]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-[10vw] gap-[1.5vw]">
      <div className="w-[3vw] h-[3vw] border-[0.35vw] border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      <div className="text-blue-600 font-bold text-[1vw] uppercase tracking-widest animate-pulse">Loading Production Data...</div>
    </div>
  );

  return (
    <div className="w-full font-sans p-[1vw]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[1.5vw] bg-white p-[1vw] rounded-[0.8vw] shadow-sm border border-gray-200">
        <div className="flex items-center gap-[0.8vw]">
          <div className="w-[2.8vw] h-[2.8vw] rounded-[0.7vw] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <Package className="w-[1.4vw] h-[1.4vw] text-white" />
          </div>
          <div>
            <h1 className="text-[1.2vw] font-black text-gray-900 tracking-tight">PRODUCTION RESPONSE PANEL</h1>
            <p className="text-[0.75vw] text-gray-500 font-bold uppercase tracking-widest mt-[0.1vw]">Resolution & Technical Reporting</p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-[0.6vw]">
          {["All", "Open", "Under Testing", "Repair in Progress", "Pending", "Completed", "Not Repairable"].map(label => {
            const count = label === "All" 
              ? entries.reduce((acc, e) => acc + (e.products?.length || 0), 0)
              : entries.reduce((acc, e) => acc + (e.products?.filter(p => (p.report?.status || "Open") === label).length || 0), 0);
            const active = filterStatus === label;
            
            return (
              <button
                key={label}
                onClick={() => setFilterStatus(label)}
                className={`px-[0.8vw] py-[0.4vw] rounded-full text-[0.72vw] font-bold flex items-center gap-[0.4vw] transition-all border-2 cursor-pointer shadow-sm ${active ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-blue-400"}`}
              >
                <span>{label}</span>
                <span className={`px-[0.4vw] py-[0.05vw] rounded-full text-[0.65vw] ${active ? "bg-white/20" : "bg-gray-100"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      {allProducts.length === 0 ? (
        <div className="bg-white rounded-[1vw] border-2 border-dashed border-gray-300 py-[6vw] flex flex-col items-center justify-center">
          <AlertCircle className="w-[3vw] h-[3vw] text-gray-300 mb-[1vw]" />
          <p className="text-[1.1vw] font-bold text-gray-500">No records found for the selected filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[0.8vw] border border-gray-300 shadow-md overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-50/50 border-b-2 border-blue-100">
                <th className="px-[1vw] py-[1vw] text-[0.8vw] font-bold text-blue-900 uppercase text-center border-r border-gray-200">SNo</th>
                <th className="px-[1vw] py-[1vw] text-[0.8vw] font-bold text-blue-900 uppercase text-left border-r border-gray-200">Registration</th>
                <th className="px-[1vw] py-[1vw] text-[0.8vw] font-bold text-blue-900 uppercase text-left border-r border-gray-200">Customer</th>
                <th className="px-[1vw] py-[1vw] text-[0.8vw] font-bold text-blue-900 uppercase text-left border-r border-gray-200">Product Details</th>
                <th className="px-[1vw] py-[1vw] text-[0.8vw] font-bold text-blue-900 uppercase text-center border-r border-gray-200">Status</th>
                <th className="px-[1vw] py-[1vw] text-[0.8vw] font-bold text-blue-900 uppercase text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allProducts.map(({ entry, product }, idx) => {
                const status = product.report?.status || "Open";
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Open"];
                const isMyClaim = product.assignedTo === (currentUser?.userId || currentUser?.id);
                
                return (
                  <tr key={`${entry.id}-${product._pid}`} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-[1vw] py-[1vw] text-center border-r border-gray-200">
                      <span className="w-[1.8vw] h-[1.8vw] rounded-full bg-gray-100 flex items-center justify-center text-[0.75vw] font-bold text-gray-600 mx-auto group-hover:bg-blue-100 group-hover:text-blue-700 transition-all">{idx + 1}</span>
                    </td>
                    <td className="px-[1vw] py-[1vw] border-r border-gray-200">
                      <div className="flex flex-col gap-[0.2vw]">
                        <div className="text-[0.8vw] font-bold text-gray-900 flex items-center gap-[0.3vw]"><Hash className="w-[0.7vw] h-[0.7vw] text-blue-600" />{entry.refNoInternal}</div>
                        <div className="text-[0.7vw] font-medium text-gray-500 flex items-center gap-[0.3vw]"><Calendar className="w-[0.7vw] h-[0.7vw]" />{fmtDate(entry.date)}</div>
                        <div className="text-[0.7vw] font-bold text-blue-600 mt-[0.1vw]">JO: {entry.jobOrderNo}</div>
                      </div>
                    </td>
                    <td className="px-[1vw] py-[1vw] border-r border-gray-200">
                      <div className="text-[0.8vw] font-bold text-gray-900 truncate max-w-[12vw]">{entry.customerName}</div>
                      <div className="text-[0.7vw] font-medium text-gray-500 mt-[0.1vw]">Code: {entry.customerCode}</div>
                    </td>
                    <td className="px-[1vw] py-[1vw] border-r border-gray-200">
                      <div className="text-[0.8vw] font-bold text-blue-700 leading-tight">{product.productDescription}</div>
                      <div className="flex items-center gap-[0.8vw] mt-[0.3vw]">
                        <span className="text-[0.68vw] bg-gray-100 px-[0.4vw] py-[0.1vw] rounded font-bold">Qty: {product.qty}</span>
                        <span className="text-[0.68vw] text-gray-500 font-bold">S/N: {product.serialNumber}</span>
                      </div>
                    </td>
                    <td className="px-[1vw] py-[1vw] text-center border-r border-gray-200">
                      <span className={`inline-flex items-center gap-[0.3vw] px-[0.6vw] py-[0.25vw] rounded-full border text-[0.7vw] font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                        <cfg.icon className="w-[0.8vw] h-[0.8vw]" />
                        {status}
                      </span>
                    </td>
                    <td className="px-[1vw] py-[1vw] text-center">
                      {!product.assignedTo ? (
                        <button onClick={() => claimProduct(entry.id, product._pid)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-[1vw] py-[0.5vw] rounded-[0.4vw] text-[0.75vw] font-bold shadow-md shadow-emerald-100 transition-all active:scale-95 flex items-center gap-[0.4vw] mx-auto cursor-pointer">
                          <Plus className="w-[0.9vw] h-[0.9vw]" /> Claim Item
                        </button>
                      ) : isMyClaim ? (
                        <button onClick={() => setSelected({ entry, product })} className="bg-blue-600 hover:bg-blue-700 text-white px-[1vw] py-[0.5vw] rounded-[0.4vw] text-[0.75vw] font-bold shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center gap-[0.4vw] mx-auto cursor-pointer">
                          <Edit3 className="w-[0.9vw] h-[0.9vw]" /> Update Report
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-[0.2vw]">
                          <Badge label="Assigned" color="slate" size="xs" />
                          <span className="text-[0.65vw] font-bold text-gray-500 truncate max-w-[6vw]">{product.assignedToName}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Response Modal */}
      <AnimatePresence>
        {selected && (
          <ProductionResponseModal
            entry={selected.entry}
            product={selected.product}
            employees={employees}
            fourMCategories={fourMCategories}
            onClose={() => setSelected(null)}
            onSave={handleSaveReport}
            caeHistory={caeHistory}
          />
        )}
      </AnimatePresence>
    </div>
  );
}