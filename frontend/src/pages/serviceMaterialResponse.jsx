import React, { useState, useEffect, useMemo } from "react";
import {
  Package, Clock, User, CheckCircle, AlertCircle, X, Eye, Send,
  Phone, Mail, MapPin, FileText, Calendar, Hash, Tag, Wrench,
  AlertTriangle, Info, ChevronRight, Shield, Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

// ── Storage Keys ───────────────────────────────────────────────────────────────
const INWARD_KEY    = "service_material_inward_v2";
const EMPLOYEES_KEY = "employees";

// ── Helpers ────────────────────────────────────────────────────────────────────
const lsLoad = (key, fb = []) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const lsSave = (key, v) => localStorage.setItem(key, JSON.stringify(v));
const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

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
const RefInput = ({ label, value, icon: Icon, span = 1 }) => (
  <div className={`flex flex-col gap-[0.25vw] ${span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : span === 4 ? "col-span-4" : ""}`}>
    <label className="text-[0.75vw] font-semibold text-black flex items-start gap-[0.25vw] text-black">
      {/* {Icon && <Icon className="w-[0.8vw] h-[0.8vw]" />} */}
      {label}
    </label>
    <div className="bg-white border border-gray-300 rounded-[0.4vw] py-[0.45vw] px-[0.6vw] text-[0.8vw] text-gray-900 break-words whitespace-normal overflow-hidden">
      {value || "—"}
    </div>
  </div>
);

// ── Service Response Modal ────────────────────────────────────────────────────
const ServiceResponseModal = ({ entry, product, employees, fourMCategories, onSave, onClose, errorCodeHistory, problemDescHistory }) => {
  const [formData, setFormData] = useState({
    testedBy: product.report?.testedBy || "",
    disposition: product.report?.disposition || "",
    fourMCategory: product.report?.fourMCategory || "",
    errorCode: product.report?.errorCode || "",
    problemDescription: product.report?.problemDescription || "",
    rootCause: product.report?.rootCause || "",
    partsReplacement: product.report?.partsReplacement || "",
    correctiveAction: product.report?.correctiveAction || "",
    completedDate: product.report?.completedDate || "",
    status: product.report?.status || "Under Testing",
    currentRemark: ""
  });

  const STATUS_OPTIONS = ["Under Testing", "Repair in Progress", "Pending", "Completed", "Not Repairable"];
  const DISPOSITION_OPTIONS = ["Repaired", "Replaced", "Scrap", "Return As Is"];

  const sp = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const [showErrorCodeSuggestions, setShowErrorCodeSuggestions] = useState(false);
  const [activeErrorCodeSuggestion, setActiveErrorCodeSuggestion] = useState(-1);

  const filteredErrorCodeSuggestions = useMemo(() => {
    const query = formData.errorCode?.toLowerCase() || "";
    if (!query) return errorCodeHistory || [];
    return (errorCodeHistory || []).filter(opt => opt.toLowerCase().includes(query));
  }, [formData.errorCode, errorCodeHistory]);

  const handleErrorCodeKeyDown = (e) => {
    if (!showErrorCodeSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveErrorCodeSuggestion(prev => (prev < filteredErrorCodeSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveErrorCodeSuggestion(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && activeErrorCodeSuggestion >= 0) {
      e.preventDefault();
      sp("errorCode", filteredErrorCodeSuggestions[activeErrorCodeSuggestion]);
      setShowErrorCodeSuggestions(false);
    } else if (e.key === "Escape") {
      setShowErrorCodeSuggestions(false);
    }
  };

  const filteredSuggestions = useMemo(() => {
    const query = formData.problemDescription?.toLowerCase() || "";
    if (!query) return problemDescHistory || [];
    return (problemDescHistory || []).filter(opt => opt.toLowerCase().includes(query));
  }, [formData.problemDescription, problemDescHistory]);

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      sp("problemDescription", filteredSuggestions[activeSuggestion]);
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSave = () => {
    if (!formData.fourMCategory.trim()) return alert("4M Category is mandatory.");
    if (!formData.problemDescription.trim()) return alert("Problem Identification is mandatory.");
    if (!formData.rootCause.trim()) return alert("Root Cause Analysis is mandatory.");
    if (!formData.correctiveAction.trim()) return alert("Corrective Action is mandatory.");
    if (formData.status === "Completed" && !formData.completedDate) return alert("Completed Date is mandatory for 'Completed' status.");

    const historyEntry = {
      status: formData.status,
      disposition: formData.disposition,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-[2vw]">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-[52vw] max-h-[90vh] rounded-[0.8vw] shadow-2xl overflow-hidden flex flex-col border border-gray-400"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-[1.5vw] py-[1vw] flex justify-between items-center">
          <div className="flex items-center gap-[0.8vw]">
            <div className="w-[2.2vw] h-[2.2vw] rounded-[0.5vw] bg-white/20 backdrop-blur flex items-center justify-center">
              <FileText className="w-[1.1vw] h-[1.1vw] text-white" />
            </div>
            <div>
              <h3 className="text-[1vw] font-bold text-white uppercase tracking-tight">Service Report</h3>
              <p className="text-[0.75vw] text-blue-50 font-medium">{product.productDescription} · {entry.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-[1.8vw] h-[1.8vw] rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-all">
            <X className="w-[1vw] h-[1vw]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[1.5vw] space-y-[1.5vw] text-black bg-gray-50/20">
          
          {/* Reference Information Section */}
          <div className="bg-white rounded-[0.6vw] border border-gray-300 shadow-sm overflow-hidden">
            <div className="bg-blue-50 px-[1vw] py-[0.6vw] border-b border-blue-100 flex items-center gap-[0.5vw]">
              <Info className="w-[0.9vw] h-[0.9vw] text-blue-600" />
              <span className="text-[0.75vw] font-bold text-blue-700 uppercase tracking-wider">Reference Information</span>
            </div>
            <div className="p-[1vw] space-y-[1vw]">
              {/* Date, Ref Customer, Ref Internal, Customer Name */}
              <div className="grid grid-cols-4 gap-[2.5vw]">
                <RefInput label="Date" value={fmtDate(entry.date)} icon={Calendar} />
                <RefInput label="Reference No (Customer)" value={entry.refNoCustomer || entry.refNo} icon={Hash} />
                <RefInput label="Reference No (Internal)" value={entry.refNo || entry.refNoInternal} icon={Hash} />
                <RefInput label="Customer Name" value={entry.customerName} icon={User} />
              </div>

              {/* Customer Code, Category, Product Code, Product Description */}
              <div className="grid grid-cols-4 gap-[2.5vw]">
                <RefInput label="Customer Code" value={entry.customerCode} icon={Hash} />
                <RefInput label="Category" value={entry.category || "—"} icon={Tag} />
                <RefInput label="Product Code" value={product.productCode} icon={Tag} />
                <div className="col-span-1">
                  <RefInput label="Product Description" value={product.productDescription} icon={Package} />
                </div>
              </div>

              {/* Qty, Board Type, Serial Number, Type(W/PW) */}
              <div className="grid grid-cols-4 gap-[2.5vw]">
                <RefInput label="Qty" value={product.qty || "1"} icon={Hash} />
                <RefInput label="Board Type" value={product.boardType} icon={Tag} />
                <RefInput label="Serial Number" value={product.serialNumber} icon={Hash} />
                <RefInput label="Type (W/PW)" value={product.type === "W" ? "Warranty" : "Paid"} icon={Shield} />
              </div>
            </div>
          </div>

          {/* Service Report Section */}
          <div className="bg-white rounded-[0.6vw] border border-gray-300 shadow-sm overflow-hidden">
            <div className="bg-blue-50 px-[1vw] py-[0.6vw] border-b border-blue-100 flex items-center gap-[0.5vw]">
              <Wrench className="w-[0.9vw] h-[0.9vw] text-blue-600" />
              <span className="text-[0.75vw] font-bold text-blue-700 uppercase tracking-wider">Service Report Details</span>
            </div>
            <div className="p-[1vw] space-y-[1.2vw]">
              {/* Tested by & Problem Description */}
              <div className="grid grid-cols-4 gap-[1vw]">
                <div className="col-span-2 flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black flex items-center gap-[0.3vw]">
                    <User className="w-[0.8vw] h-[0.8vw] text-blue-600" />
                    Tested by
                  </label>
                  <select value={formData.testedBy} onChange={e => sp("testedBy", e.target.value)}
                    className="border border-gray-300 bg-white rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer shadow-sm">
                    <option value="">Select Employee</option>
                    {employees.map(e => <option key={e.userId} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">
                    4M Category <span className="text-red-500">*</span>
                  </label>
                  <select value={formData.fourMCategory} onChange={e => sp("fourMCategory", e.target.value)}
                    className="border border-gray-300 bg-white rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm cursor-pointer">
                    <option value="">Select 4M Category</option>
                    {fourMCategories?.map(opt => <option key={opt._id || opt.id} value={opt.name}>{opt.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.3vw] relative">
                  <label className="text-[0.8vw] font-semibold text-black">
                    Error Code
                  </label>
                  <input 
                    value={formData.errorCode} 
                    onChange={e => {
                      sp("errorCode", e.target.value);
                      setShowErrorCodeSuggestions(true);
                      setActiveErrorCodeSuggestion(-1);
                    }}
                    onFocus={() => setShowErrorCodeSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowErrorCodeSuggestions(false), 200)}
                    onKeyDown={handleErrorCodeKeyDown}
                    placeholder="Enter error code..."
                    className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm w-full" 
                  />
                  {showErrorCodeSuggestions && filteredErrorCodeSuggestions.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-[0.4vw] shadow-xl max-h-[12vw] overflow-y-auto top-[100%] mt-[0.2vw]">
                      {filteredErrorCodeSuggestions.map((opt, i) => (
                        <li 
                          key={i} 
                          onClick={() => {
                            sp("errorCode", opt);
                            setShowErrorCodeSuggestions(false);
                          }}
                          className={`px-[0.6vw] py-[0.4vw] text-[0.78vw] cursor-pointer transition-colors ${i === activeErrorCodeSuggestion ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50 text-gray-800'}`}
                        >
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="col-span-4 flex flex-col gap-[0.3vw] relative">
                  <label className="text-[0.8vw] font-semibold text-black">
                    Problem Description <span className="text-red-500">*</span>
                  </label>
                  <input 
                    value={formData.problemDescription} 
                    onChange={e => {
                      sp("problemDescription", e.target.value);
                      setShowSuggestions(true);
                      setActiveSuggestion(-1);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter problem identification..."
                    className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm w-full" 
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-[0.4vw] shadow-xl max-h-[12vw] overflow-y-auto top-[100%] mt-[0.2vw]">
                      {filteredSuggestions.map((opt, i) => (
                        <li 
                          key={i} 
                          onClick={() => {
                            sp("problemDescription", opt);
                            setShowSuggestions(false);
                          }}
                          className={`px-[0.6vw] py-[0.4vw] text-[0.78vw] cursor-pointer transition-colors ${i === activeSuggestion ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50 text-gray-800'}`}
                        >
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Possible Root Cause(s) & Parts replacement details */}
              <div className="grid grid-cols-2 gap-[1vw]">
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">
                    Possible Root Cause(s) <span className="text-red-500">*</span>
                  </label>
                  <textarea rows="2" value={formData.rootCause} onChange={e => sp("rootCause", e.target.value)}
                    placeholder="Enter root cause analysis..."
                    className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all shadow-sm" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black">
                    Parts replacement details
                  </label>
                  <textarea rows="2" value={formData.partsReplacement} onChange={e => sp("partsReplacement", e.target.value)}
                    placeholder="Enter parts replaced..."
                    className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all shadow-sm" />
                </div>
              </div>

              {/* Corrective Action */}
              <div className="flex flex-col gap-[0.3vw]">
                <label className="text-[0.8vw] font-semibold text-black">
                  Corrective Action <span className="text-red-500">*</span>
                </label>
                <textarea rows="2" value={formData.correctiveAction} onChange={e => sp("correctiveAction", e.target.value)}
                  placeholder="Describe corrective action taken..."
                  className="border border-gray-300 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all shadow-sm w-full" />
              </div>

              {/* Disposition, Completion date, Status, Remark */}
              <div className="grid grid-cols-2 gap-x-[4vw] gap-y-[1.5vw]">
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black flex items-center gap-[0.3vw]">
                    <Tag className="w-[0.8vw] h-[0.8vw] text-blue-600" />
                    Disposition
                  </label>
                  <select value={formData.disposition} onChange={e => sp("disposition", e.target.value)}
                    className="border border-gray-300 bg-white rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer shadow-sm font-medium">
                    <option value="">Select Disposition</option>
                    {DISPOSITION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black flex items-center gap-[0.3vw]">
                    <Calendar className="w-[0.8vw] h-[0.8vw] text-blue-600" />
                    Completion date {formData.status === "Completed" && <span className="text-red-500">*</span>}
                  </label>
                  <input type="date" value={formData.completedDate} onChange={e => sp("completedDate", e.target.value)}
                    className="border border-gray-300 bg-white rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm" />
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-black flex items-center gap-[0.3vw]">
                    {React.createElement(currentStatus.icon, { className: "w-[0.8vw] h-[0.8vw] text-blue-600" })}
                    Status
                  </label>
                  <select value={formData.status} onChange={e => sp("status", e.target.value)}
                    className={`border-2 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none transition-all cursor-pointer shadow-sm ${currentStatus.bg} ${currentStatus.border} focus:border-blue-500 focus:ring-1 focus:ring-blue-500`}>
                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-[0.3vw]">
                  <label className="text-[0.8vw] font-semibold text-blue-600 flex items-center gap-[0.3vw]">
                    <FileText className="w-[0.8vw] h-[0.8vw]" />
                    Action Remark
                  </label>
                  <input value={formData.currentRemark} onChange={e => sp("currentRemark", e.target.value)}
                    placeholder="Brief remark..."
                    className="border border-blue-300 bg-blue-50/30 rounded-[0.4vw] py-[0.5vw] px-[0.6vw] text-[0.78vw] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* History Preview */}
          {product.report?.history?.length > 0 && (
            <div className="bg-white rounded-[0.6vw] border border-gray-300 p-[0.8vw] shadow-sm overflow-hidden">
              <div className="flex items-center gap-[0.3vw] mb-[0.6vw] pb-[0.4vw] border-b border-gray-100">
                <Clock className="w-[0.9vw] h-[0.9vw] text-blue-600" />
                <span className="text-[0.7vw] font-bold text-gray-700 uppercase tracking-widest">Recent Activity Log</span>
              </div>
              <div className="space-y-[0.4vw]">
                {product.report.history.slice(-3).reverse().map((h, i) => {
                  const cfg = STATUS_CONFIG[h.status] || STATUS_CONFIG["Open"];
                  return (
                    <div key={i} className={`flex items-center justify-between border ${cfg.border} p-[0.5vw] rounded-[0.4vw] transition-all hover:bg-opacity-80`}>
                      <div className="flex items-center gap-[0.6vw]">
                        <Badge label={h.status} color={cfg.color} size="xs" />
                        <span className="text-[0.72vw] font-medium text-gray-700 truncate max-w-[25vw]">{h.remark || "Status updated"}</span>
                      </div>
                      <span className="text-[0.6vw] text-gray-400 font-medium">{new Date(h.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-[1.5vw] py-[1vw] border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <p className="text-[0.68vw] text-gray-800">
            <span className="text-red-500">*</span> Required fields
          </p>
          <div className="flex gap-[0.6vw]">
            <button onClick={onClose} className="px-[1.2vw] py-[0.5vw] border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-[0.4vw] text-[0.78vw] cursor-pointer transition-all">
              Cancel
            </button>
            <button onClick={handleSave} className="px-[1.5vw] py-[0.5vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.4vw] text-[0.78vw] font-bold cursor-pointer shadow-lg shadow-blue-900/20 flex items-center gap-[0.5vw] transition-all">
              <Send className="w-[0.9vw] h-[0.9vw]" />
              Save Report
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Status Chips Configuration ─────────────────────────────────────────────
const STATUS_CHIPS = [
  { label: "All",                color: "bg-blue-600",   inactive: "text-gray-500 bg-gray-100", active: "bg-blue-600 text-white" },
  { label: "Open",               color: "bg-gray-400",   inactive: "text-gray-600 bg-gray-100", active: "bg-gray-600 text-white" },
  { label: "Under Testing",      color: "bg-blue-400",   inactive: "text-blue-700 bg-blue-50",  active: "bg-blue-500 text-white" },
  { label: "Repair in Progress", color: "bg-orange-500", inactive: "text-orange-700 bg-orange-50", active: "bg-orange-500 text-white" },
  { label: "Pending",            color: "bg-slate-500",  inactive: "text-slate-700 bg-slate-50", active: "bg-slate-500 text-white" },
  { label: "Completed",          color: "bg-emerald-500", inactive: "text-emerald-700 bg-emerald-50", active: "bg-emerald-500 text-white" },
  { label: "Not Repairable",     color: "bg-red-500",    inactive: "text-red-700 bg-red-50",    active: "bg-red-500 text-white" },
];

const StatsBar = ({ items, activeFilter, onFilterChange }) => {
  const counts = useMemo(() => {
    const c = { All: items.length };
    items.forEach(({ product }) => {
      const s = product.status || product.report?.status || "Open";
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [items]);

  return (
    <div className="flex items-center gap-[0.75vw] flex-wrap">
      {STATUS_CHIPS.map(chip => {
        const isActive = activeFilter === chip.label;
        const count = chip.label === "All" ? counts.All : (counts[chip.label] || 0);
        
        return (
          <button
            key={chip.label}
            onClick={() => onFilterChange(chip.label)}
            className={`flex items-center gap-[0.4vw] px-[0.8vw] py-[0.4vw] rounded-full border border-[0.15vw] transition-all text-[0.72vw] font-semibold cursor-pointer ${
              isActive ? chip.active + " border-gray-100" : chip.inactive + " border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className={`w-[0.5vw] h-[0.5vw] rounded-full ${isActive ? "bg-white" : chip.color}`} />
            <span>{chip.label}</span>
            <span className={`px-[0.35vw] py-[0.05vw] rounded-full text-[0.65vw] ${isActive ? "bg-white/20 text-white" : "bg-black/10 text-gray-700"}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-[6vw] bg-white rounded-[0.6vw] border border-gray-400"
  >
    <div className="w-[4vw] h-[4vw] rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-[1vw]">
      <Package className="w-[2vw] h-[2vw] text-gray-800" />
    </div>
    <h3 className="text-[1vw] font-bold text-gray-700 mb-[0.3vw]">No Products Assigned</h3>
    <p className="text-[0.75vw] text-gray-800 text-center max-w-[18vw]">
      You don't have any inward products assigned to you at the moment.
    </p>
  </motion.div>
);

const ClaimButton = ({ onClaim }) => (
  <button
    onClick={onClaim}
    className="inline-flex items-center gap-[0.25vw] px-[0.7vw] py-[0.35vw] rounded-[0.35vw] text-[0.85vw] font-semibold cursor-pointer transition-all bg-emerald-600 text-white shadow-md shadow-emerald-900/10 hover:bg-emerald-700 hover:scale-105 active:scale-95"
  >
    <Plus className="w-[0.75vw] h-[0.75vw]" />
    Claim Item
  </button>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function ServiceMaterialInwardResponse({ currentUser: propUser }) {
  const [entries,     setEntries]     = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [fourMCategories, setFourMCategories] = useState([]);
  const [currentUser, setCurrentUser] = useState(propUser || null);
  const [selected,    setSelected]    = useState(null);
  const [hoveredRow,  setHoveredRow]  = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");

  // Load current user from storage if not provided
  useEffect(() => { if (propUser) setCurrentUser(propUser); }, [propUser]);

  useEffect(() => {
    if (propUser) return;
    const KEYS = ["loggedInUser", "currentUser", "user", "akira_user", "auth_user"];
    for (const k of KEYS) {
      const raw = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.userId || parsed?.id) { setCurrentUser(parsed); return; }
        } catch {}
      }
    }
  }, [propUser]);

  // Reload data periodically
  const fetchData = async () => {
    try {
      const [materialRes, employeeRes, fourMRes] = await Promise.all([
        axios.get(`${API_URL}/service-material`),
        axios.get(`${API_URL}/auth/employees`),
        axios.get(`${API_URL}/master/four-m-categories`)
      ]);
      const mappedEntries = materialRes.data.map(item => ({
        ...item,
        id: item._id
      }));
      setEntries(mappedEntries);
      setEmployees(employeeRes.data);
      setFourMCategories(fourMRes.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(iv);
  }, []);

  // Get products assigned to current user
  const myItems = useMemo(() => {
    const res = [];
    entries.forEach(e => {
      e.products?.forEach(p => {
        const s = p.status || p.report?.status || "Open";
        if (filterStatus === "All" || s === filterStatus) {
          res.push({ entry: e, product: p });
        }
      });
    });
    return res;
  }, [entries, filterStatus]);

  const { errorCodeHistory, problemDescHistory } = useMemo(() => {
    const codes = new Set();
    const descs = new Set();
    entries.forEach(e => {
        e.products?.forEach(p => {
            if (p.report?.errorCode) codes.add(p.report.errorCode);
            if (p.report?.problemDescription) descs.add(p.report.problemDescription);
        });
    });
    return { 
        errorCodeHistory: Array.from(codes),
        problemDescHistory: Array.from(descs)
    };
  }, [entries]);

  // Update handler
  const updateEntry = async (id, productId, report) => {
    try {
      const res = await axios.patch(`${API_URL}/service-material/${id}/report`, {
        productId,
        report
      });
      const updatedRow = { ...res.data, id: res.data._id };
      setEntries(prev => prev.map(e => e.id === id ? updatedRow : e));
    } catch (err) {
      alert("Failed to update report: " + (err.response?.data?.message || err.message));
    }
  };

  const claimProduct = async (id, productId) => {
    if (!currentUser) return alert("You must be logged in to claim products.");
    try {
      const res = await axios.patch(`${API_URL}/service-material/${id}/claim-product`, {
        productId,
        userId: currentUser.userId || currentUser.id,
        userName: currentUser.name
      });
      const updatedRow = { ...res.data, id: res.data._id };
      setEntries(prev => prev.map(e => e.id === id ? updatedRow : e));
    } catch (err) {
      alert("Failed to claim product: " + (err.response?.data?.message || err.message));
    }
  };

  // Table columns configuration
  const columns = [
    { key: "sno",      label: "S.No",        width: "w-[3vw]",   align: "text-center" },
    { key: "date",     label: "Date",        width: "w-[7vw]",   align: "text-left" },
    { key: "ref",      label: "Ref No",      width: "w-[7vw]",   align: "text-left" },
    { key: "customer", label: "Customer",    width: "w-[12vw]",  align: "text-left" },
    { key: "product",  label: "Product",     width: "w-[12vw]",  align: "text-left" },
    { key: "board",    label: "Board Type",  width: "w-[8vw]",   align: "text-left" },
    { key: "serial",   label: "Serial No",   width: "w-[8vw]",   align: "text-left" },
    { key: "status",   label: "Status",      width: "w-[10vw]",  align: "text-center" },
    { key: "remarks",   label: "Remarks",      width: "w-[10vw]",  align: "text-center" },
    { key: "action",   label: "Action",      width: "w-[6vw]",   align: "text-center" },
  ];

  return (
    <div className="w-full font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-[1vw]">
        <div className="flex items-center gap-[0.6vw]">
          <div className="w-[2.2vw] h-[2.2vw] rounded-[0.5vw] bg-gradient-to-br from-blue-700 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-800/20">
            <Package className="w-[1.1vw] h-[1.1vw] text-white" />
          </div>
          <div>
            <h1 className="text-[1.1vw] font-bold text-blue-700 uppercase tracking-tight">SERVICE MATERIAL MANAGEMENT</h1>
            <p className="text-[0.68vw] text-gray-500 font-medium italic">Service material inward items and reporting</p>
          </div>
        </div>
        {myItems.length >= 0 && (
          <StatsBar 
            items={entries.flatMap(e => e.products?.map(p => ({ product: p })) || [])} 
            activeFilter={filterStatus} 
            onFilterChange={setFilterStatus} 
          />
        )}
      </div>

      {/* Content */}
      {myItems.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-[0.6vw] border border-gray-300 overflow-hidden shadow-sm">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              {/* Table Header */}
              <thead>
                <tr className="bg-blue-50/50 border-b-2 border-blue-100">
                  {columns.map((col) => (
                    <th 
                      key={col.key}
                      className={`${col.width} ${col.align} px-[0.8vw] py-[0.8vw] text-[0.82vw] font-semibold text-black uppercase whitespace-nowrap opacity-90 border border-gray-300`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-100">
                {myItems.map(({ entry, product }, idx) => {
                  const pStatus = product.status || product.report?.status || "Open";
                  const pRemark = product.remark || product.report?.currentRemark || "—";
                  const statusCfg = STATUS_CONFIG[pStatus] || STATUS_CONFIG["Open"];
                  const StatusIcon = statusCfg.icon;
                  const isHovered = hoveredRow === idx;

                  return (
                    <motion.tr
                      key={`${entry.id}-${product._pid}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className={`transition-all duration-150 ${isHovered ? "bg-gray-50" : "bg-white"}`}
                    >
                      {/* S.No */}
                      <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300">
                        <span className="inline-flex items-center justify-center w-[1.5vw] h-[1.5vw] rounded-full bg-gray-100 text-[0.68vw] font-bold text-gray-600">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                        <div className="flex items-center gap-[0.3vw]">
                          <Calendar className="w-[0.75vw] h-[0.75vw] text-blue-600" />
                          <span className="text-[0.75vw] text-gray-700 font-medium">
                            {entry.date ? fmtDate(entry.date) : "—"}
                          </span>
                        </div>
                      </td>

                      {/* Ref No */}
                      <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                        <span className="text-[0.75vw] font-bold text-gray-800 ">
                          {entry.refNoCustomer || entry.refNo || "—"}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                        <div className="flex items-center gap-[0.5vw]">
                          <div className="w-[1.6vw] h-[1.6vw] rounded-full bg-gradient-to-br from-blue-700 to-blue-600 flex items-center justify-center text-white text-[0.55vw] font-bold flex-shrink-0">
                            {entry.customerName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[0.75vw] font-semibold text-gray-800 break-words whitespace-normal">{entry.customerName}</div>
                            <div className="text-[0.65vw] text-gray-600 mt-[.2vw]">CUS: {entry.customerCode || "—"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Product */}
                      <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                        <div className="min-w-0">
                          <div className="text-[0.75vw] font-semibold text-gray-800 break-words whitespace-normal" title={product.productDescription}>
                            {product.productDescription}
                          </div>
                          <div className="text-[0.65vw] text-gray-600 mt-[.2vw]">{product.productCode || "—"}</div>
                        </div>
                      </td>

                      {/* Board Type */}
                      <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                        <span className="text-[0.75vw] font-semibold text-gray-700">
                          {product.boardType || "—"}
                        </span>
                      </td>

                      {/* Serial No */}
                      <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                        <span className="text-[0.75vw]  font-semibold text-gray-700">
                          {product.serialNumber || "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300">
                        <span className={`inline-flex items-center gap-[0.3vw] px-[0.6vw] py-[0.25vw] rounded-full border text-[0.68vw] font-semibold ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                          <StatusIcon className="w-[0.8vw] h-[0.8vw]" />
                          {pStatus}
                        </span>
                      </td>
                      
                      {/* Remarks */}
                      <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300 text-[0.75vw] text-gray-700 font-medium">
                        {pRemark}
                      </td>

                      {/* Action */}
                      <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300">
                        {product.assignedTo ? (
                          product.assignedTo === (currentUser?.userId || currentUser?.id) ? (
                            <button
                                onClick={() => setSelected({ entry, product })}
                                className={`inline-flex items-center gap-[0.25vw] px-[0.7vw] py-[0.35vw] rounded-[0.35vw] text-[0.85vw] font-semibold cursor-pointer transition-all ${
                                    isHovered 
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/10 scale-105" 
                                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100"
                                }`}
                            >
                                <Eye className="w-[0.75vw] h-[0.75vw]" />
                                Report
                            </button>
                          ) : (
                            <div className="flex flex-col items-center gap-[0.2vw]">
                                <Badge label="Claimed" color="slate" size="xs" />
                                <span className="text-[0.6vw] text-gray-800 font-bold">{product.assignedToName}</span>
                            </div>
                          )
                        ) : (
                          <ClaimButton onClaim={() => claimProduct(entry.id, product._pid)} />
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-[1vw] py-[0.5vw] flex items-center justify-between">
            <span className="text-[0.72vw] text-gray-500">
              Showing <strong className="text-gray-700">{myItems.length}</strong> assigned {myItems.length === 1 ? "product" : "products"}
            </span>
            <div className="flex items-center gap-[0.3vw] text-[0.68vw] text-gray-800">
              <Clock className="w-[0.85vw] h-[0.85vw]" />
              Auto-refreshes every 3 seconds
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <ServiceResponseModal
            entry={selected.entry}
            product={selected.product}
            employees={employees}
            onSave={(report) => {
              updateEntry(selected.entry.id, selected.product._pid, report);
              setSelected(null);
            }}
            onClose={() => setSelected(null)}
            fourMCategories={fourMCategories}
            errorCodeHistory={errorCodeHistory}
            problemDescHistory={problemDescHistory}
          />
        )}
      </AnimatePresence>
    </div>
  );
}