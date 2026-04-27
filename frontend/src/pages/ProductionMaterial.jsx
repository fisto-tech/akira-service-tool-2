// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, Trash2, Save, ArrowLeft, Plus, User, Package, ChevronDown,
  ChevronUp, Eye, Target, ClipboardList, Edit3, Clock, History, FileText, AlertCircle, CheckCircle, Wrench
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useNotification } from "../components/NotificationContext";
import ProductionEditableProductTable from "../components/ProductionEditableProductTable";

const API_URL = import.meta.env.VITE_API_URL;

// Storage Keys (Legacy)
const CUSTOMER_DB_KEY = "customer_db_grouped_v5";
const EMPLOYEES_KEY = "employees";
const STAGE_MASTER_KEY = "production_material_stage_options_v1";
const DISPOSITION_MASTER_KEY = "production_material_disposition_options_v1";

const DEFAULT_STAGE_OPTIONS = ["SMD", "WS", "MS", "SRV-Testing", "SRV-FI", "STA-Testing", "STA-FI", "MPR-CVR", "MPR-Testing", "MPR-FI", "Panel-WA", "Panel-Integration", "Panel-Testing", "Panel-FI"];
const DEFAULT_DISPOSITION_OPTIONS = ["Spare Replacement", "Rework Required", "Client Approval Pending", "No Change", "Accepted"];
const FINAL_STATUS_OPTIONS = ["Pending", "Rejected", "Completed"];
const FINAL_STATUS_COLORS = {
  Pending: "bg-orange-100 text-orange-700 border-orange-300",
  "Rejected": "bg-gray-200 text-gray-700 border-gray-400",
  Completed: "bg-green-100 text-green-700 border-green-300",
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
  productCode: "", productDescription: "", category: "", boardType: "", problem: "", qty: "1", stage: DEFAULT_STAGE_OPTIONS[0],
  serialNumber: "", assembledBy: "", assembledByName: "", testedBy: "", testedByName: "", fiBy: "", fiByName: "",
  disposition: DEFAULT_DISPOSITION_OPTIONS[0],
  report: null, finalStatus: "Pending", finalStatusRemarks: "", finalStatusDate: todayDateStr(), finalStatusHistory: []
});

// --- Reports Modal (admin full data view) ---
const ReportsModal = ({ row, onClose }) => {
  const products = row.products || [];
  const [expanded, setExpanded] = useState(new Set([products[0]?._pid]));
  
  const toggleExpand = (pid) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const parseParts = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-[2vw]">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-[75vw] max-h-[90vh] rounded-[0.8vw] shadow-2xl overflow-hidden flex flex-col border border-blue-300">
        <div className="bg-blue-600 px-[1.5vw] py-[1.2vw] flex justify-between items-center shadow-md">
          <div className="flex items-center gap-[0.9vw]">
            <div className="bg-white/20 p-[0.4vw] rounded-full"><FileText className="w-[1.4vw] h-[1.4vw] text-white" /></div>
            <div>
              <h3 className="text-[1.1vw] font-bold text-white uppercase">Full Production Report</h3>
              <p className="text-[0.75vw] text-white/90 font-medium">{row.refNoInternal} · {row.jobOrderNo || "No Job Order"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer transition-all hover:bg-white/10 p-[0.4vw] rounded-full"><X className="w-[1.3vw] h-[1.3vw]" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-[1.5vw] space-y-[1.5vw]">
          <div className="grid grid-cols-3 gap-[1vw] mb-[1vw]">
            <div className="bg-white rounded-[0.6vw] p-[1vw] border border-blue-200">
              <div className="text-[0.7vw] uppercase font-bold text-blue-600 mb-[0.6vw]">Entry Details</div>
              <div className="space-y-[0.45vw]">
                <div className="text-[0.78vw] text-black"><span className="font-bold text-blue-600">Date:</span> {fmtDate(row.date)}</div>
                <div className="text-[0.78vw] text-black"><span className="font-bold text-blue-600">Job Order:</span> {row.jobOrderNo || "—"}</div>
                <div className="text-[0.78vw] text-black"><span className="font-bold text-blue-600">Products:</span> {products.length}</div>
              </div>
            </div>
            <div className="bg-white rounded-[0.6vw] p-[1vw] border border-blue-200">
              <div className="text-[0.7vw] uppercase font-bold text-blue-600 mb-[0.6vw]">Customer</div>
              <div className="text-[0.78vw] text-black"><span className="font-bold text-blue-600">Name:</span> {row.customerName || "—"}</div>
              <div className="text-[0.78vw] text-black"><span className="font-bold text-blue-600">Code:</span> {row.customerCode || "—"}</div>
            </div>
            <div className="bg-white rounded-[0.6vw] p-[1vw] border border-blue-200">
              <div className="text-[0.7vw] uppercase font-bold text-blue-600 mb-[0.6vw]">Report Summary</div>
              <div className="text-[0.78vw] text-black"><span className="font-bold text-blue-600">Created By:</span> {row.creatorName || "Admin"}</div>
              <div className="text-[0.78vw] text-black"><span className="font-bold text-blue-600">Last updated:</span> {fmtDate(row.updatedAt || row.createdAt)}</div>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-[4vw] text-[0.9vw] text-blue-500">No product records available for this entry.</div>
          ) : products.map((prod, idx) => (
            <div key={prod._pid} className="border border-blue-200 rounded-[0.6vw] overflow-hidden shadow-sm transition-all duration-300">
              <div 
                onClick={() => toggleExpand(prod._pid)}
                className="bg-blue-50 px-[1.2vw] py-[1vw] flex items-center justify-between gap-[1vw] cursor-pointer hover:bg-blue-100/50 transition-colors"
              >
                <div>
                  <div className="text-[0.95vw] font-bold text-black">{prod.productDescription || "Unnamed Product"}</div>
                  <div className="text-[0.72vw] text-black mt-[0.3vw] flex flex-wrap gap-[0.8vw]"><span>JO: {row.jobOrderNo || "—"}</span><span>Code: {prod.productCode || "—"}</span><span>Qty: {prod.qty || "—"}</span><span>S/N: {prod.serialNumber || "—"}</span></div>
                </div>
                <div className="flex items-center gap-[1vw]">
                  <div className="text-[0.72vw] text-black uppercase font-bold">Item {idx + 1}</div>
                  <ChevronDown className={`w-[1.2vw] h-[1.2vw] text-blue-600 transition-transform duration-300 ${expanded.has(prod._pid) ? "rotate-180" : ""}`} />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {expanded.has(prod._pid) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-blue-100">
                      {/* Registration Info */}
                      <div className="p-[1.2vw] bg-white border-b border-blue-100">
                        <div className="text-[0.7vw] font-bold text-blue-600 uppercase mb-[1vw] flex items-center gap-[0.5vw] border-b border-blue-50 pb-[0.4vw]">
                          <Target className="w-[0.9vw] h-[0.9vw]" /> Registration Information
                        </div>
                        <div className="grid grid-cols-4 gap-[1.5vw] mb-[1vw]">
                          <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Stage</div><div className="font-bold text-black text-[0.8vw]">{prod.stage || "—"}</div></div>
                          <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Category</div><div className="font-bold text-black text-[0.8vw]">{row.category || prod.category || "—"}</div></div>
                          <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Assembled By</div><div className="font-bold text-black text-[0.8vw]">{prod.report?.assembledByName || prod.assembledByName || "—"}</div></div>
                          <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Tested By</div><div className="font-bold text-black text-[0.8vw]">{prod.report?.testedByName || prod.testedByName || "—"}</div></div>
                        </div>
                        <div className="bg-gray-50/50 p-[1vw] rounded-[0.5vw] border border-gray-100 mb-[1vw]">
                            <div className="text-[0.65vw] text-blue-600 font-bold uppercase mb-[0.4vw]">Initial Problem Description</div>
                            <div className="text-[0.8vw] text-black font-bold leading-relaxed">{prod.problem || "No description provided."}</div>
                        </div>
                      </div>

                      {/* Technical Resolution Report */}
                      <div className="p-[1.2vw] bg-blue-50/30">
                        <div className="text-[0.7vw] font-bold text-blue-600 uppercase mb-[1vw] flex items-center gap-[0.5vw] border-b border-blue-100 pb-[0.4vw]">
                          <Wrench className="w-[0.9vw] h-[0.9vw]" /> Technical Resolution Report
                        </div>
                        {prod.report ? (
                          <div className="space-y-[1.2vw]">
                            <div className="grid grid-cols-4 gap-[1.5vw]">
                              <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Start Date</div><div className="font-bold text-black text-[0.8vw]">{fmtDate(prod.report.startDate)}</div></div>
                              <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">4M Category</div><div className="font-bold text-black text-[0.8vw]">{prod.report.fourMCategory || "—"}</div></div>
                              <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">CAE</div><div className="font-bold text-black text-[0.8vw]">{prod.report.cae || "—"}</div></div>
                              <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Status</div><div className="font-black text-blue-700 text-[0.8vw]">{prod.report.status || "—"}</div></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-[1vw]">
                              <div className="bg-white p-[0.8vw] rounded-[0.5vw] border border-blue-100">
                                <div className="text-[0.65vw] text-blue-600 font-bold uppercase mb-[0.4vw]">Root Cause Analysis</div>
                                <div className="text-[0.8vw] text-black font-bold leading-relaxed">{prod.report.rootCause || "—"}</div>
                              </div>
                              <div className="bg-white p-[0.8vw] rounded-[0.5vw] border border-blue-100">
                                <div className="text-[0.65vw] text-blue-600 font-bold uppercase mb-[0.4vw]">Corrective Action Taken</div>
                                <div className="text-[0.8vw] text-black font-bold leading-relaxed">{prod.report.correctiveAction || "—"}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-[1vw]">
                                <div className="bg-white p-[0.8vw] rounded-[0.5vw] border border-blue-100">
                                    <div className="text-[0.65vw] text-blue-600 font-bold uppercase mb-[0.6vw]">Parts Replaced</div>
                                    {prod.report && prod.report.partsReplacement && prod.report.partsReplacement.trim() ? (
                                        <ul className="list-disc list-inside space-y-[0.3vw]">
                                            {parseParts(prod.report.partsReplacement).map((part, pidx) => (
                                                <li key={pidx} className="text-[0.78vw] text-black font-bold leading-tight">{part}</li>
                                            ))}
                                        </ul>
                                    ) : <div className="text-[0.78vw] text-black/40 italic font-medium">No parts replaced.</div>}
                                </div>
                                <div className="grid grid-cols-2 gap-[1vw]">
                                    <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Closed Date</div><div className="font-bold text-black text-[0.8vw]">{fmtDate(prod.report.closedDate)}</div></div>
                                    <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Verified Date</div><div className="font-bold text-black text-[0.8vw]">{fmtDate(prod.report.verifiedDate)}</div></div>
                                    <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Verified By</div><div className="font-bold text-black text-[0.8vw]">{prod.report.verifiedByName || "—"}</div></div>
                                    <div><div className="text-blue-600 mb-[0.3vw] uppercase text-[0.65vw] font-bold">Disposition</div><div className="font-bold text-black text-[0.8vw]">{prod.disposition || "—"}</div></div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-[1vw]">
                                <div className="bg-white p-[0.6vw] rounded-[0.4vw] border border-blue-100 text-center"><div className="text-[0.55vw] font-bold text-blue-500 uppercase">Assembler</div><div className="text-[0.75vw] font-bold text-black">{prod.report.assembledByName || "—"}</div></div>
                                <div className="bg-white p-[0.6vw] rounded-[0.4vw] border border-blue-100 text-center"><div className="text-[0.55vw] font-bold text-blue-500 uppercase">Tester</div><div className="text-[0.75vw] font-bold text-black">{prod.report.testedByName || "—"}</div></div>
                                <div className="bg-white p-[0.6vw] rounded-[0.4vw] border border-blue-100 text-center"><div className="text-[0.55vw] font-bold text-blue-500 uppercase">FI By</div><div className="text-[0.75vw] font-bold text-black">{prod.report.fiByName || "—"}</div></div>
                                <div className="bg-white p-[0.6vw] rounded-[0.4vw] border border-blue-100 text-center"><div className="text-[0.55vw] font-bold text-blue-500 uppercase">Final Status</div><div className="text-[0.75vw] font-black text-black uppercase">{prod.finalStatus || "Pending"}</div></div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-[3vw] text-center">
                            <Clock className="w-[2vw] h-[2vw] text-gray-300 mx-auto mb-[0.8vw]" />
                            <div className="text-[0.9vw] text-gray-400 font-bold italic">No technical report submitted yet.</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        <div className="px-[1.5vw] py-[1vw] border-t border-blue-200 bg-white flex justify-end">
          <button onClick={onClose} className="px-[2.5vw] py-[0.6vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.5vw] text-[0.85vw] font-bold cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-[0.5vw]">Close Panel</button>
        </div>
      </motion.div>
    </div>
  );
};

const MasterDataModal = ({ open, onClose, stageOptions, dispositionOptions, onSave }) => {
  const [activeTab, setActiveTab] = useState("stages");
  const [stages, setStages] = useState(stageOptions);
  const [dispositions, setDispositions] = useState(dispositionOptions);
  const [newStage, setNewStage] = useState("");
  const [newDisposition, setNewDisposition] = useState("");

  useEffect(() => {
    setStages(stageOptions);
    setDispositions(dispositionOptions);
  }, [stageOptions, dispositionOptions]);

  const addStage = () => {
    const trimmed = newStage.trim();
    if (!trimmed) return;
    setStages(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setNewStage("");
  };

  const addDisposition = () => {
    const trimmed = newDisposition.trim();
    if (!trimmed) return;
    setDispositions(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setNewDisposition("");
  };

  const removeStage = (value) => setStages(prev => prev.filter(item => item !== value));
  const removeDisposition = (value) => setDispositions(prev => prev.filter(item => item !== value));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-[1.5vw]">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-[1.2vw] w-[50vw] max-h-[85vh] overflow-hidden shadow-2xl border border-gray-300 flex flex-col">
        <div className="bg-blue-600 px-[1.5vw] py-[1.2vw] flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-[1.1vw] font-bold text-white uppercase ">Master Data Configuration</h3>
            <p className="text-[0.75vw] text-white/90 mt-[0.2vw]">Manage system-wide stage and disposition values.</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-[0.4vw] rounded-full hover:bg-white/10 transition-all"><X className="w-[1.4vw] h-[1.4vw]" /></button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-50 border-b border-gray-200 p-[0.4vw] gap-[0.4vw] shrink-0">
          {[
            { id: "stages", label: "Stage Options", icon: Target },
            { id: "dispositions", label: "Disposition Options", icon: ClipboardList }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-[0.6vw] py-[0.8vw] rounded-[0.8vw] text-[0.85vw] font-bold transition-all ${
                  isActive 
                    ? "bg-white text-blue-600 shadow-md border border-blue-100" 
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <Icon className={`w-[1.1vw] h-[1.1vw] ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-[2vw] overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {activeTab === "stages" ? (
              <motion.div 
                key="stages"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-[1.5vw]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[1vw] font-bold text-gray-900">Work Stages</h4>
                    <p className="text-[0.75vw] text-gray-500">Define the sequence of operations for production NC registration.</p>
                  </div>
                </div>

                <div className="flex gap-[0.8vw] bg-blue-50/50 p-[1vw] rounded-[1vw] border border-blue-100">
                  <div className="relative flex-1">
                    <Target className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 w-[1vw] h-[1vw] text-blue-400" />
                    <input 
                      value={newStage} 
                      onChange={e => setNewStage(e.target.value)} 
                      onKeyPress={e => e.key === 'Enter' && addStage()}
                      placeholder="Add new stage (e.g., Quality Control)" 
                      className="w-full border border-gray-300 rounded-[0.6vw] py-[0.7vw] pl-[2.4vw] pr-[0.8vw] text-[0.85vw] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 bg-white" 
                    />
                  </div>
                  <button onClick={addStage} className="bg-blue-600 text-white px-[1.5vw] rounded-[0.6vw] text-[0.85vw] font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center gap-[0.5vw]">
                    <Plus className="w-[1vw] h-[1vw]" /> Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-[0.8vw] pt-[0.5vw]">
                  {stages.map(stage => (
                    <motion.span 
                      key={stage} 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-[0.6vw] px-[1vw] py-[0.6vw] bg-white border border-gray-200 rounded-[0.8vw] text-[0.85vw] text-gray-800 font-medium shadow-sm hover:border-blue-300 transition-colors group"
                    >
                      {stage}
                      <button 
                        onClick={() => removeStage(stage)} 
                        className="w-[1.1vw] h-[1.1vw] rounded-full bg-gray-100 group-hover:bg-red-500 text-gray-400 group-hover:text-white flex items-center justify-center transition-all text-[0.7vw]"
                      >
                        <X className="w-[0.7vw] h-[0.7vw]" />
                      </button>
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="dispositions"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-[1.5vw]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[1vw] font-bold text-gray-900">Disposition Outcomes</h4>
                    <p className="text-[0.75vw] text-gray-500">List possible final actions for identified material issues.</p>
                  </div>
                </div>

                <div className="flex gap-[0.8vw] bg-slate-50 p-[1vw] rounded-[1vw] border border-slate-200">
                  <div className="relative flex-1">
                    <ClipboardList className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 w-[1vw] h-[1vw] text-gray-400" />
                    <input 
                      value={newDisposition} 
                      onChange={e => setNewDisposition(e.target.value)} 
                      onKeyPress={e => e.key === 'Enter' && addDisposition()}
                      placeholder="Add new disposition (e.g., Scrapped)" 
                      className="w-full border border-gray-300 rounded-[0.6vw] py-[0.7vw] pl-[2.4vw] pr-[0.8vw] text-[0.85vw] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 bg-white" 
                    />
                  </div>
                  <button onClick={addDisposition} className="bg-blue-600 text-white px-[1.5vw] rounded-[0.6vw] text-[0.85vw] font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center gap-[0.5vw]">
                    <Plus className="w-[1vw] h-[1vw]" /> Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-[0.8vw] pt-[0.5vw]">
                  {dispositions.map(value => (
                    <motion.span 
                      key={value} 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-[0.6vw] px-[1vw] py-[0.6vw] bg-white border border-gray-200 rounded-[0.8vw] text-[0.85vw] text-gray-800 font-medium shadow-sm hover:border-blue-300 transition-colors group"
                    >
                      {value}
                      <button 
                        onClick={() => removeDisposition(value)} 
                        className="w-[1.1vw] h-[1.1vw] rounded-full bg-gray-100 group-hover:bg-red-500 text-gray-400 group-hover:text-white flex items-center justify-center transition-all text-[0.7vw]"
                      >
                        <X className="w-[0.7vw] h-[0.7vw]" />
                      </button>
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-end gap-[0.8vw] p-[1.1vw] border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="px-[1.2vw] py-[0.6vw] rounded-[0.4vw] border border-gray-300 text-[0.82vw] text-black font-bold hover:bg-gray-100">Cancel</button>
          <button onClick={() => onSave(stages, dispositions)} className="px-[1.4vw] py-[0.6vw] rounded-[0.4vw] bg-blue-600 text-white text-[0.82vw] font-bold hover:bg-blue-700">Save Master Data</button>
        </div>
      </motion.div>
    </div>
  );
};

const EmpSelectCell = ({ val, employees, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const selected = employees.find(e => e.userId === val);
  useEffect(() => { const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, []);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)} className={`flex items-center justify-center gap-[0.4vw] bg-white border rounded-[0.3vw] px-[0.5vw] py-[0.25vw] transition-all cursor-pointer hover:border-blue-400 mx-auto w-max ${val ? "border-gray-300" : "border-dashed border-gray-400"}`}>
        <span className={`text-[0.7vw] font-bold truncate max-w-[6vw] ${val ? "text-black" : "text-gray-400"}`}>{selected ? selected.name : "Assign"}</span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full left-0 mt-[0.2vw] bg-white border border-gray-300 shadow-xl rounded-[0.4vw] w-[14vw] max-h-[12vw] overflow-y-auto z-[200] py-[0.2vw]">
            {employees.map(u => (
              <div key={u.userId} onClick={() => { onSelect(u); setOpen(false); }} className="px-[0.6vw] py-[0.4vw] flex items-center gap-[0.5vw] hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0"><div className="text-[0.7vw] font-bold text-black truncate">{u.name}</div><div className="text-[0.55vw] text-gray-400 font-bold truncate">{u.department}</div></div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Final Status Cell ---
const FinalStatusCell = ({ row, prod, onUpdateProduct }) => {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [remarks, setRemarks] = useState(prod.finalStatusRemarks || "");
  const [status, setStatus] = useState(prod.finalStatus || "Pending");
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
        <button onClick={() => setOpen(!open)} className={`text-[0.68vw] px-[0.5vw] py-[0.2vw] rounded-full border font-bold flex items-center gap-[0.3vw] cursor-pointer transition-all ${cls}`}>
          {status} <ChevronDown className="w-[0.7vw] h-[0.7vw]" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full right-0 mt-[0.3vw] bg-white border border-gray-300 shadow-xl rounded-[0.5vw] z-40 w-[17vw] p-[0.8vw]">
              <div className="text-[0.72vw] font-bold text-gray-900 mb-[0.5vw]">Update Final Status</div>
              <div className="grid grid-cols-2 gap-[0.35vw] mb-[0.7vw]">
                {FINAL_STATUS_OPTIONS.map((opt) => (
                  <button key={opt} onClick={() => setStatus(opt)} className={`py-[0.3vw] rounded-[0.3vw] border text-[0.66vw] font-bold cursor-pointer transition-all ${status === opt ? FINAL_STATUS_COLORS[opt] + " ring-2 ring-offset-1 ring-blue-300" : "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100"}`}>
                    {opt}
                  </button>
                ))}
              </div>
              <div className="mb-[0.6vw]"><label className="text-[0.65vw] font-bold text-gray-700 block mb-[0.25vw]">Status Date</label><input type="date" value={statusDate} onChange={e => setStatusDate(e.target.value)} className="w-full border border-gray-300 rounded-[0.3vw] px-[0.4vw] py-[0.35vw] text-[0.72vw] outline-none focus:border-blue-400" /></div>
              <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add remarks…" className="w-full border border-gray-300 rounded-[0.3vw] p-[0.4vw] text-[0.72vw] outline-none focus:border-blue-400 resize-none mb-[0.6vw]" />
              <div className="flex justify-end gap-[0.4vw]"><button onClick={() => setOpen(false)} className="px-[0.8vw] py-[0.3vw] text-[0.68vw] border border-gray-300 rounded-[0.3vw] text-gray-700 hover:bg-gray-50 font-bold">Cancel</button><button onClick={handleSave} className="px-[0.8vw] py-[0.3vw] text-[0.68vw] bg-blue-600 text-white rounded-[0.3vw] hover:bg-blue-700 font-bold flex items-center gap-[0.3vw]"><Save className="w-[0.7vw] h-[0.7vw]" />Save</button></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="relative" ref={historyRef}>
        <button onClick={() => setShowHistory(!showHistory)} title="Status History" className="p-[0.3vw] text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-[0.3vw] transition-colors cursor-pointer"><Clock className="w-[0.9vw] h-[0.9vw]" /></button>
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full right-0 mt-[0.3vw] bg-white border border-gray-300 shadow-2xl rounded-[0.5vw] z-40 w-[22vw] p-[1vw]">
              <div className="flex items-center justify-between mb-[0.8vw] pb-[0.4vw] border-b border-gray-300"><div className="text-[0.8vw] font-bold text-gray-900 flex items-center gap-[0.4vw]"><Clock className="w-[0.9vw] h-[0.9vw] text-blue-500" />Status History</div><button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-900"><X className="w-[0.8vw] h-[0.8vw]" /></button></div>
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

// --- Inward Form Page ---
const InwardForm = ({ initialData, employees, onSave, onBack, stageOptions, dispositionOptions }) => {
  const { toast } = useNotification();
  const [base, setBase] = useState(() => ({
    date: initialData.date?.split("T")[0] || todayDateStr(),
    jobOrderNo: initialData.jobOrderNo || "",
    refNoInternal: initialData.refNoInternal || genRef(),
    customerName: initialData.customerName || "",
    customerCode: initialData.customerCode || "",
    category: initialData.category || ""
  }));
  const [products, setProducts] = useState(() => initialData.products || [emptyProduct()]);
  const isReadOnly = !!initialData._readonly;

  const [customerDb, setCustomerDb] = useState([]);
  const [boardTypes, setBoardTypes] = useState([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [custSearch, setCustSearch] = useState(initialData.customerName || "");
  const custRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, boardRes] = await Promise.all([
          axios.get(`${API_URL}/master/customers`),
          axios.get(`${API_URL}/master/board-types`)
        ]);
        setCustomerDb(custRes.data);
        setBoardTypes(boardRes.data);
      } catch (err) {
        console.error("Master data fetch failed:", err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (custRef.current && !custRef.current.contains(e.target))
        setShowCustDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const customerDbFlat = useMemo(
    () => Array.isArray(customerDb) ? customerDb : Object.values(customerDb).flat(),
    [customerDb]
  );

  const uniqueCustomers = useMemo(() => {
    const map = new Map();
    customerDbFlat.forEach((item) => {
      if (!map.has(item.partyCode))
        map.set(item.partyCode, {
          code: item.partyCode,
          name: item.partyDescription,
          type: item.partyType,
        });
    });
    return Array.from(map.values());
  }, [customerDbFlat]);

  const filteredCustomers = useMemo(() => {
    const s = custSearch.toLowerCase();
    return uniqueCustomers.filter(c => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s)).slice(0, 100);
  }, [uniqueCustomers, custSearch]);

  const selectCustomer = (c) => {
    if (isReadOnly) return;
    setBase(p => ({
      ...p,
      customerCode: c.code,
      customerName: c.name,
      category: c.type || p.category,
    }));
    setCustSearch(c.name);
    setShowCustDrop(false);
  };

  const handleDuplicate = (prod) => {
    setProducts(prev => [...prev, { ...prod, _pid: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]);
  };

  const removeProduct = (pid) => {
    if (products.length === 1) return toast("At least one product required", "warning");
    setProducts(prev => prev.filter(p => p._pid !== pid));
  };

  const addProduct = () => setProducts(prev => [...prev, emptyProduct()]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!base.jobOrderNo) { toast("Job Order Number is mandatory", "error"); return; }
    if (products.length === 0) { toast("At least one product is required", "warning"); return; }
    if (products.some(p => !p.productDescription)) { toast("All products must have a description", "error"); return; }
    onSave({ ...base, products });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full font-sans text-[0.85vw] max-h-[90vh] overflow-y-auto pr-[0.4vw]">
      <div className="flex items-center justify-between bg-white px-[1.2vw] py-[0.8vw] rounded-[0.6vw] shadow-sm border border-gray-300 mb-[1vw] sticky top-0 z-[60]">
        <div className="flex items-center gap-[1vw]">
          <button onClick={onBack} className="flex items-center gap-[0.4vw] text-gray-700 hover:text-black border border-gray-300 bg-gray-50 px-[0.8vw] py-[0.4vw] rounded-[0.4vw] cursor-pointer shadow-sm transition-all hover:shadow font-bold">
            <ArrowLeft className="w-[1vw] h-[1vw]" /> Back
          </button>
          <div>
            <h2 className="text-[1vw] font-bold text-gray-900">{initialData._id ? "Edit Production NC" : "New Production NC Registration"}</h2>
            <div className="text-[0.6vw] text-gray-500 mt-[.1vw] uppercase font-bold tracking-widest">Reference: {base.refNoInternal}</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[1.2vw] pb-[2vw]">
        {/* Base Info Section */}
        <div className="bg-white rounded-[0.6vw] shadow-sm border border-gray-300 p-[1.5vw]">
          <h3 className="text-[0.85vw] font-bold text-gray-900 uppercase mb-[1.2vw] pb-[0.6vw] border-b border-gray-200 flex items-center gap-[0.5vw]">
            <ClipboardList className="w-[1.1vw] h-[1.1vw] text-blue-500" /> Primary Order Details
          </h3>
          <div className="grid grid-cols-5 gap-[1vw]">
            <div className="flex flex-col gap-[0.4vw]">
              <label className="font-bold text-gray-700 text-[0.72vw] uppercase tracking-wider">Registration Date</label>
              <input type="date" value={base.date} onChange={e => setBase({ ...base, date: e.target.value })} disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.6vw] px-[0.8vw] text-[0.8vw] font-bold outline-none focus:border-blue-500 shadow-sm transition-all text-gray-800" />
            </div>
            <div className="flex flex-col gap-[0.4vw]">
              <label className="font-bold text-gray-700 text-[0.72vw] uppercase tracking-wider">Job Order Number <span className="text-red-500">*</span></label>
              <input value={base.jobOrderNo} onChange={e => setBase({ ...base, jobOrderNo: e.target.value })} placeholder="Enter Job Order..." disabled={isReadOnly} className="border border-gray-300 rounded-[0.4vw] py-[0.6vw] px-[0.8vw] text-[0.8vw] font-bold outline-none focus:border-blue-500 shadow-sm transition-all text-gray-800" />
            </div>
            <div className="flex flex-col gap-[0.4vw] relative" ref={custRef}>
              <label className="font-bold text-gray-700 text-[0.72vw] uppercase tracking-wider">Customer Name</label>
              <div className="relative group">
                <input 
                  value={custSearch} 
                  onChange={e => { setCustSearch(e.target.value); setShowCustDrop(true); }} 
                  onFocus={() => setShowCustDrop(true)}
                  placeholder="Type to search..." 
                  disabled={isReadOnly} 
                  className="w-full border border-gray-300 rounded-[0.4vw] py-[0.6vw] px-[0.8vw] pr-[2vw] text-[0.8vw] font-bold outline-none focus:border-blue-500 shadow-sm transition-all text-gray-800" 
                />
                <Search className="absolute right-[0.6vw] top-1/2 -translate-y-1/2 w-[1vw] h-[1vw] text-gray-400 group-focus-within:text-blue-500" />
              </div>
              <AnimatePresence>
                {showCustDrop && filteredCustomers.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-[100] w-[25vw] left-0 top-full mt-[0.4vw] bg-white border border-gray-300 rounded-[0.6vw] shadow-2xl max-h-[15vw] overflow-y-auto py-[0.4vw]">
                    {filteredCustomers.map(c => (
                      <div key={c.code} onClick={() => selectCustomer(c)} className="px-[1vw] py-[0.6vw] hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0 group">
                        <div className="flex-1">
                          <div className="text-[0.82vw] font-bold text-gray-900 group-hover:text-blue-700">{c.name}</div>
                          <div className="text-[0.68vw] text-gray-500 font-bold">{c.code}</div>
                        </div>
                        {c.type && <span className="text-[0.6vw] bg-blue-100 text-blue-700 px-[0.4vw] py-[0.1vw] rounded font-black uppercase">{c.type}</span>}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-col gap-[0.4vw]">
              <label className="font-bold text-gray-700 text-[0.72vw] uppercase tracking-wider">Customer Code</label>
              <input value={base.customerCode} readOnly className="border border-gray-300 rounded-[0.4vw] py-[0.6vw] px-[0.8vw] text-[0.8vw] font-bold outline-none bg-gray-50 text-gray-600 cursor-not-allowed shadow-none" />
            </div>
            <div className="flex flex-col gap-[0.4vw]">
              <label className="font-bold text-gray-700 text-[0.72vw] uppercase tracking-wider">Category</label>
              <input value={base.category} readOnly className="border border-gray-300 rounded-[0.4vw] py-[0.6vw] px-[0.8vw] text-[0.8vw] font-bold outline-none bg-gray-50 text-gray-600 cursor-not-allowed shadow-none" />
            </div>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="bg-blue-50/30 rounded-[0.6vw] shadow-sm border border-blue-200 p-[1.5vw]">
          <div className="flex items-center justify-between mb-[1.2vw] pb-[0.6vw] border-b border-blue-200">
            <h3 className="text-[0.85vw] font-bold text-blue-800 uppercase  flex items-center gap-[0.5vw]">
              <Package className="w-[1.1vw] h-[1.1vw] text-blue-600" /> Manifest & Assembly Specs
              <span className="ml-[0.8vw] text-[0.65vw] bg-blue-600 text-white px-[0.6vw] py-[0.15vw] rounded-full font-bold shadow-sm">{products.length} {products.length === 1 ? 'Item' : 'Items'}</span>
            </h3>
            {!isReadOnly && (
              <button type="button" onClick={addProduct} className="flex items-center gap-[0.4vw] text-[0.75vw] font-bold text-white bg-blue-600 hover:bg-blue-700 px-[1vw] py-[0.5vw] rounded-[0.4vw] cursor-pointer shadow-md transition-all active:scale-95">
                <Plus className="w-[1vw] h-[1vw]" /> Add Item Row
              </button>
            )}
          </div>
          <ProductionEditableProductTable
            products={products}
            setProducts={setProducts}
            customerCode={base.customerCode}
            customerDb={customerDb}
            boardTypes={boardTypes}
            employees={employees}
            stageOptions={stageOptions}
            dispositionOptions={dispositionOptions}
            isReadOnly={isReadOnly}
            onDuplicate={handleDuplicate}
            onRemove={removeProduct}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-[1vw] pt-[1vw] border-t border-gray-200 mt-[0.5vw]">
          <button type="button" onClick={onBack} className="px-[1.8vw] py-[0.75vw] border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-[0.5vw] cursor-pointer flex items-center gap-[0.5vw] font-bold shadow-sm transition-all">
            <X className="w-[1vw] h-[1vw]" /> Cancel
          </button>
          {!isReadOnly && (
            <button type="submit" className="px-[2.2vw] py-[0.75vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.5vw] flex items-center gap-[0.5vw] cursor-pointer font-bold shadow-lg transition-all active:scale-95">
              <Save className="w-[1.1vw] h-[1.1vw]" /> {initialData._id ? "Update Registration" : "Register Inward"}
            </button>
          )}
        </div>
      </form>
    </motion.div>
  );
};

// --- Main List Screen ---
export default function ProductionMaterial() {
  const { toast } = useNotification();
  const [data, setData] = useState([]);
  const [view, setView] = useState("list");
  const [selectedRow, setSelectedRow] = useState(null);
  const [reportsRow, setReportsRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMasterData, setShowMasterData] = useState(false);
  const [stageOptions, setStageOptions] = useState(() => lsLoad(STAGE_MASTER_KEY, DEFAULT_STAGE_OPTIONS));
  const [dispositionOptions, setDispositionOptions] = useState(() => lsLoad(DISPOSITION_MASTER_KEY, DEFAULT_DISPOSITION_OPTIONS));
  const [activeFilter, setActiveFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const ITEMS_PER_PAGE = 10;

  const fetchData = async () => {
    try {
      const [matRes, empRes] = await Promise.all([
        axios.get(`${API_URL}/production-material`),
        axios.get(`${API_URL}/auth/employees`)
      ]);
      setData(matRes.data.map(e => ({ ...e, id: e._id })));
      setEmployees(empRes.data);
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const saveMasterData = (newStages, newDispositions) => {
    const normalizedStages = newStages.length ? newStages : DEFAULT_STAGE_OPTIONS;
    const normalizedDispositions = newDispositions.length ? newDispositions : DEFAULT_DISPOSITION_OPTIONS;
    setStageOptions(normalizedStages);
    setDispositionOptions(normalizedDispositions);
    lsSave(STAGE_MASTER_KEY, normalizedStages);
    lsSave(DISPOSITION_MASTER_KEY, normalizedDispositions);
  };

  const handleSave = async (formData) => {
    const loggedUser = JSON.parse(sessionStorage.getItem("loggedInUser") || "{}");
    const entryData = { 
      ...formData, 
      creatorUserId: loggedUser.userId || "Admin",
      creatorName: loggedUser.name || "Admin"
    };

    try {
      if (selectedRow?.id) {
        const res = await axios.put(`${API_URL}/production-material/${selectedRow.id}`, entryData);
        setData(prev => prev.map(d => d.id === selectedRow.id ? { ...res.data, id: res.data._id } : d));
      } else {
        const res = await axios.post(`${API_URL}/production-material`, entryData);
        setData(prev => [{ ...res.data, id: res.data._id }, ...prev]);
      }
      setView("list"); setSelectedRow(null); toast("Registration Saved", "success");
    } catch (err) {
      toast("Save failed", "error");
    }
  };

  const onUpdateProduct = async (rowId, productId, updates) => {
      try {
          const res = await axios.patch(`${API_URL}/production-material/${rowId}/product/${productId}/final-status`, updates);
          setData(prev => prev.map(d => d.id === rowId ? { ...res.data, id: res.data._id } : d));
      } catch (err) {
          toast("Update failed", "error");
      }
  };

  const filteredData = useMemo(() => {
    let filtered = data;
    if (activeFilter !== "All") {
        filtered = filtered.filter(row => (row.products || []).some(p => (p.finalStatus || "Pending") === activeFilter));
    }
    if (employeeFilter !== "All") {
      filtered = filtered.filter(row => row.creatorUserId === employeeFilter);
    }
    if (searchTerm) { 
        const s = searchTerm.toLowerCase(); 
        filtered = filtered.filter(row => 
            (row.refNoInternal || "").toLowerCase().includes(s) || 
            (row.jobOrderNo || "").toLowerCase().includes(s) ||
            (row.customerName || "").toLowerCase().includes(s) ||
            (row.products || []).some(p => (p.productDescription || "").toLowerCase().includes(s) || (p.serialNumber || "").toLowerCase().includes(s))
        ); 
    }
    return filtered;
  }, [data, searchTerm, activeFilter, employeeFilter]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleSelect = (id) => { const s = new Set(selectedItems); s.has(id) ? s.delete(id) : s.add(id); setSelectedItems(s); };
  const toggleSelectPage = () => { const s = new Set(selectedItems); const pageSelected = paginatedData.length > 0 && paginatedData.every(r => s.has(r.id)); if (pageSelected) paginatedData.forEach(r => s.delete(r.id)); else paginatedData.forEach(r => s.add(r.id)); setSelectedItems(s); };
  const isPageSelected = paginatedData.length > 0 && paginatedData.every(r => selectedItems.has(r.id));

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (window.confirm(`Delete ${selectedItems.size} entries?`)) {
        try {
            await Promise.all(Array.from(selectedItems).map(id => axios.delete(`${API_URL}/production-material/${id}`)));
            setData(prev => prev.filter(e => !selectedItems.has(e.id)));
            setSelectedItems(new Set());
            toast("Deleted successfully", "success");
        } catch (err) {
            toast("Delete failed", "error");
        }
    }
  };

  const counts = useMemo(() => {
    const c = { All: data.length };
    FINAL_STATUS_OPTIONS.forEach(s => {
      c[s] = data.filter(row => (row.products || []).some(p => (p.finalStatus || "Pending") === s)).length;
    });
    return c;
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-[10vw] gap-[1.5vw]">
      <div className="w-[3vw] h-[3vw] border-[0.35vw] border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      <div className="text-blue-600 font-bold text-[1vw] uppercase tracking-widest animate-pulse">Loading Production Data...</div>
    </div>
  );

  if (view === "form") return <InwardForm initialData={selectedRow || {}} employees={employees} onSave={handleSave} onBack={() => setView("list")} stageOptions={stageOptions} dispositionOptions={dispositionOptions} />;

  return (
    <>
      <AnimatePresence>
        {showMasterData && (
          <MasterDataModal
            open={showMasterData}
            onClose={() => setShowMasterData(false)}
            stageOptions={stageOptions}
            dispositionOptions={dispositionOptions}
            onSave={(newStages, newDispositions) => {
              saveMasterData(newStages, newDispositions);
              setShowMasterData(false);
            }}
          />
        )}
      </AnimatePresence>
      <div className="w-full h-full font-sans text-[0.85vw]">
        <AnimatePresence>{reportsRow && <ReportsModal row={reportsRow} onClose={() => setReportsRow(null)} />}</AnimatePresence>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center justify-between bg-white p-[0.7vw] rounded-[0.6vw] shadow-sm border border-gray-300 mb-[0.9vw]">
            <div className="relative w-[30vw]"><Search className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 text-black/50 w-[1vw] h-[1vw]" /><input type="text" placeholder="Search by ref, JO, customer, product…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-[2.5vw] pr-[1vw] h-[2.5vw] border border-gray-300 rounded-[0.8vw] focus:outline-none focus:border-blue-500 font-bold" /></div>
            <div className="flex gap-[0.8vw] items-center">
                <button onClick={() => setShowMasterData(true)} className="flex items-center gap-[0.4vw] text-[0.85vw] font-bold border border-blue-200 bg-blue-50 text-blue-700 px-[1vw] h-[2.4vw] rounded-[0.4vw] hover:bg-blue-100 transition-all cursor-pointer">Master Data</button>
                {selectedItems.size > 0 && (<button onClick={handleBulkDelete} className="flex items-center gap-[0.5vw] bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-[1vw] h-[2.4vw] rounded-[0.4vw] font-bold cursor-pointer transition-all"><Trash2 className="w-[1vw] h-[1vw]" />Delete ({selectedItems.size})</button>)}
                <button onClick={() => setView("form")} className="cursor-pointer flex items-center gap-[0.5vw] bg-blue-600 hover:bg-blue-700 text-white px-[1.2vw] h-[2.4vw] rounded-[0.4vw] font-bold shadow-md transition-all active:scale-95"><Plus className="w-[1.1vw] h-[1.1vw]" />New Registration</button>
            </div>
          </div>
          <div className="flex gap-[1vw] mb-[0.9vw] items-center flex-wrap">
            {[{ label: "All", color: "bg-gray-400" }, { label: "Pending", color: "bg-orange-500" }, { label: "Rejected", color: "bg-gray-600" }, { label: "Completed", color: "bg-green-600" }].map(({ label, color }) => { 
                const isActive = activeFilter === label; 
                return (
                    <button key={label} onClick={() => setActiveFilter(label)} className={`flex items-center gap-[0.5vw] px-[1vw] py-[0.55vw] rounded-[0.5vw] border font-bold text-[0.8vw] cursor-pointer transition-all duration-150 select-none ${isActive ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-offset-1 ring-blue-300" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"}`}>
                        <span className={`w-[0.6vw] h-[0.6vw] rounded-full ${isActive ? "bg-white" : color}`} />
                        {label} <span className={`px-[0.4vw] py-[0.05vw] rounded-full text-[0.7vw] ${isActive ? "bg-white/20" : "bg-gray-100"}`}>{counts[label] ?? 0}</span>
                    </button>
                ); 
            })}
          </div>
          
          <div className="bg-white rounded-[0.6vw] shadow-sm border border-gray-300 flex flex-col overflow-hidden">
            <div className="overflow-auto max-h-[65vh] min-h-[65vh]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-blue-50 sticky top-0 z-20">
                  <tr>
                    <th rowSpan={2} className="p-[0.6vw] border-b-2 border-r border-gray-300 text-center align-middle w-[3%]">
                      <button onClick={toggleSelectPage} className="flex items-center justify-center w-full cursor-pointer">
                        {isPageSelected ? <CheckCircle className="w-[1.2vw] h-[1.2vw] text-blue-600" /> : <div className="w-[1.1vw] h-[1.1vw] border-2 border-gray-300 rounded"></div>}
                      </button>
                    </th>
                    {["S.No", "Date", "Job Order No", "Customer", "Cus Code", "Category"].map(h => (
                      <th key={h} rowSpan={2} className="px-[0.6vw] py-[0.5vw] font-semibold text-black text-center border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.78vw] align-middle bg-blue-50">{h}</th>
                    ))}
                    <th colSpan={7} className="px-[0.6vw] py-[0.4vw] font-semibold text-black border-b border-r border-gray-300 text-center text-[0.78vw] bg-blue-100/50">Product Manifest Details</th>
                    <th rowSpan={2} className="px-[0.8vw] py-[0.5vw] font-semibold text-black text-center border-b-2 border-l border-gray-300 whitespace-nowrap text-[0.78vw] align-middle bg-blue-50 sticky right-0 z-30 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Actions</th>
                  </tr>
                  <tr>
                    {["Item Code", "Description", "Stage", "Qty", "Serial/Batch", "Final Status", "Final Remarks"].map((h, i) => (
                      <th key={h} className="px-[0.6vw] py-[0.4vw] font-semibold text-blue-800 text-center border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.72vw] bg-blue-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedData.length > 0 ? (
                    paginatedData.flatMap((row, i) => {
                      const isSelected = selectedItems.has(row.id);
                      const products = row.products || [];
                      const span = products.length;
                      return products.map((prod, pi) => (
                        <tr key={`${row.id}-${pi}`} className={`transition-colors hover:bg-blue-50/20 ${isSelected ? "bg-blue-50/50" : "bg-white"}`}>
                          {pi === 0 && (
                            <>
                              <td rowSpan={span} className="p-[0.7vw] border-r border-gray-200 text-center align-middle">
                                <button onClick={() => toggleSelect(row.id)} className="flex items-center justify-center w-full cursor-pointer">
                                  {isSelected ? <CheckCircle className="w-[1.1vw] h-[1.1vw] text-blue-600" /> : <div className="w-[1.1vw] h-[1.1vw] border border-gray-300 rounded hover:border-blue-400"></div>}
                                </button>
                              </td>
                              <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center font-bold text-gray-900 text-[0.78vw]">{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</td>
                              <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center font-semibold text-gray-700 text-[0.78vw]">{fmtDate(row.date)}</td>
                              <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center text-[0.78vw] font-semibold text-blue-700">{row.jobOrderNo || "—"}</td>
                              <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center font-semibold text-gray-900 text-[0.75vw] max-w-[10vw] truncate">{row.customerName || "—"}</td>
                              <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 text-center align-middle font-semibold text-gray-600 text-[0.72vw]">{row.customerCode || "—"}</td>
                              <td rowSpan={span} className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 text-center align-middle"><span className="text-[0.68vw] font-semibold bg-blue-100 text-blue-700 px-[0.4vw] py-[0.1vw] rounded">{row.category || "—"}</span></td>
                            </>
                          )}
                          <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 text-center align-middle font-semibold text-gray-600 text-[0.72vw]">{prod.productCode || "—"}</td>
                          <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center font-semibold text-gray-900 text-[0.72vw] truncate max-w-[10vw]">{prod.productDescription || "—"}</td>
                          <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 text-center align-middle"><span className="text-[0.72vw] font-semibold text-gray-900">{prod.stage || "Assembly"}</span></td>
                          <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 text-center align-middle font-semibold text-black text-[0.75vw]">{prod.qty || "1"}</td>
                          <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center font-semibold text-gray-700 text-[0.72vw]">{prod.serialNumber || "—"}</td>
                          <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center"><FinalStatusCell row={row} prod={prod} onUpdateProduct={onUpdateProduct} /></td>
                          <td className="px-[0.8vw] py-[0.7vw] border-r border-gray-200 align-middle text-center font-semibold text-gray-900 text-[0.72vw] truncate max-w-[10vw]">{prod.finalStatusRemarks || "—"}</td>
                          {pi === 0 && (
                            <td rowSpan={span} className={`px-[0.8vw] py-[0.7vw] text-center align-middle border-l border-gray-200 sticky right-0 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] ${isSelected ? "bg-blue-50/50" : "bg-white"}`}>
                              <div className="flex items-center justify-center gap-[0.6vw]">
                                <button onClick={() => setReportsRow(row)} className="px-[0.7vw] py-[0.4vw] bg-white border border-gray-300 text-gray-700 rounded-[0.4vw] hover:bg-blue-600 hover:text-white shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-[0.4vw] text-[0.68vw] font-bold"><Eye className="w-[0.9vw] h-[0.9vw]" />View Report</button>
                                <button onClick={() => { setSelectedRow(row); setView("form"); }} className="p-[0.5vw] text-gray-400 hover:text-blue-600 transition-colors cursor-pointer group"><Edit3 className="w-[1.1vw] h-[1.1vw] group-hover:scale-110" /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ));
                    })
                  ) : (
                    <tr><td colSpan={19} className="py-[6vw] text-center text-gray-400 text-[0.9vw] font-bold italic">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 p-[0.6vw] bg-gray-50 flex justify-between items-center rounded-b-[0.6vw]">
              <div className="text-[0.8vw] font-bold text-gray-500">Showing <strong>{paginatedData.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> to <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</strong> of <strong>{filteredData.length}</strong> entries</div>
              <div className="flex items-center gap-[1.2vw]">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-[0.4vw] border border-gray-300 rounded-[0.3vw] hover:bg-white disabled:opacity-50 bg-white shadow-sm cursor-pointer"><ChevronDown className="w-[1vw] h-[1vw] rotate-90" /></button>
                <div className="flex gap-[0.7vw]">{Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2)).map(pNum => (<button key={pNum} onClick={() => setCurrentPage(pNum)} className={`w-[1.8vw] h-[1.8vw] flex items-center justify-center rounded-[0.3vw] text-[0.8vw] font-bold cursor-pointer ${currentPage === pNum ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"}`}>{pNum}</button>))}</div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-[0.4vw] border border-gray-300 rounded-[0.3vw] hover:bg-white disabled:opacity-50 bg-white shadow-sm cursor-pointer"><ChevronUp className="w-[1vw] h-[1vw] rotate-90" /></button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}