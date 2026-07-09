import React, { useState, useEffect, useMemo } from "react";
import {
  Package, Clock, User, CheckCircle, AlertCircle, X, Eye, Send,
  Phone, Mail, MapPin, FileText, Calendar, Hash, Tag, Wrench,
  AlertTriangle, Info, ChevronRight, ChevronLeft, Shield, Plus, Edit3, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useNotification } from "../components/NotificationContext";

const API_URL = import.meta.env.VITE_API_URL;

// ── Storage Keys ───────────────────────────────────────────────────────────────
const INWARD_KEY = "service_material_inward_v2";
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
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-100 text-slate-600 border-slate-400",
    gray: "bg-gray-100 text-gray-600 border-slate-400",
    black: "bg-gray-900 text-white border-gray-900",
    red: "bg-red-50 text-red-700 border-red-200",
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
  "Open": { color: "gray", icon: AlertCircle, bg: "bg-gray-100", border: "border-gray-400", text: "text-gray-700" },
  "Under Testing": { color: "blue", icon: Wrench, bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800" },
  "Repair in Progress": { color: "orange", icon: Wrench, bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800" },
  "Pending": { color: "slate", icon: Clock, bg: "bg-slate-100", border: "border-slate-400", text: "text-slate-800" },
  "Completed": { color: "green", icon: CheckCircle, bg: "bg-green-100", border: "border-green-300", text: "text-green-800" },
  "Not Repairable": { color: "red", icon: AlertTriangle, bg: "bg-red-100", border: "border-red-300", text: "text-red-800" },
};

// ── Read-only Input Field ─────────────────────────────────────────────────────
const RefInput = ({ label, value, icon: Icon, span = 1 }) => (
  <div className={`flex flex-col gap-[0.25vw] ${span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : span === 4 ? "col-span-4" : ""}`}>
    <label className="text-[0.75vw] font-semibold text-black flex items-start gap-[0.25vw] text-black">
      {/* {Icon && <Icon className="w-[0.8vw] h-[0.8vw]" />} */}
      {label}
    </label>
    <div className="bg-white border border-gray-400 rounded-[0.4vw] py-[0.45vw] px-[0.6vw] text-[0.8vw] text-gray-900 break-words whitespace-normal overflow-hidden">
      {value || "—"}
    </div>
  </div>
);


const STATUS_OPTIONS = ["Under Testing", "Repair in Progress", "Pending", "Completed", "Not Repairable"];
const DISPOSITION_OPTIONS = ["Repaired", "Replaced", "Scrap", "Return As Is"];

// ── Status Chips Configuration ─────────────────────────────────────────────
const STATUS_CHIPS = [
  { label: "All", color: "bg-blue-600", inactive: "text-gray-500 bg-gray-100", active: "bg-blue-600 text-white" },
  { label: "Open", color: "bg-gray-400", inactive: "text-gray-600 bg-gray-100", active: "bg-gray-600 text-white" },
  { label: "Under Testing", color: "bg-blue-400", inactive: "text-blue-700 bg-blue-50", active: "bg-blue-500 text-white" },
  { label: "Repair in Progress", color: "bg-orange-500", inactive: "text-orange-700 bg-orange-50", active: "bg-orange-500 text-white" },
  { label: "Pending", color: "bg-slate-500", inactive: "text-slate-700 bg-slate-50", active: "bg-slate-500 text-white" },
  { label: "Completed", color: "bg-emerald-500", inactive: "text-emerald-700 bg-emerald-50", active: "bg-emerald-500 text-white" },
  { label: "Not Repairable", color: "bg-red-500", inactive: "text-red-700 bg-red-50", active: "bg-red-500 text-white" },
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
            className={`flex items-center gap-[0.4vw] px-[0.8vw] py-[0.4vw] rounded-full border border-[0.15vw] transition-all text-[0.72vw] font-semibold cursor-pointer ${isActive ? chip.active + " border-slate-400" : chip.inactive + " border-slate-400 hover:border-gray-400"
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

// ── Service Info Modal (Read-only) ───────────────────────────────────────────
const ServiceInfoModal = ({ entry, product, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-[2vw]">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-[55vw] max-h-[90vh] rounded-[1vw] shadow-2xl overflow-hidden flex flex-col border border-gray-400"
      >
        <div className="bg-gray-900 px-[1.5vw] py-[1vw] flex justify-between items-center">
          <div className="flex items-center gap-[0.8vw]">
            <Info className="w-[1.2vw] h-[1.2vw] text-blue-400" />
            <h3 className="text-[1.1vw] font-bold text-white uppercase tracking-tight">Service Record Details</h3>
          </div>
          <button onClick={onClose} className="w-[2vw] h-[2vw] rounded-full bg-white/10 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-all">
            <X className="w-[1.1vw] h-[1.1vw]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-[1.5vw] space-y-[1.5vw] bg-gray-50/50">
          <div className="grid grid-cols-2 gap-[1.5vw]">
            <div className="space-y-[1vw]">
               <h4 className="text-[0.85vw] font-bold text-blue-700 border-b border-blue-100 pb-[0.3vw]">Inward Information</h4>
               <div className="grid grid-cols-1 gap-[0.8vw]">
                 <RefInput label="Registration Date" value={fmtDate(entry.date)} />
                 <RefInput label="Job Order No" value={entry.jobOrderNo} />
                 <RefInput label="Reference No" value={entry.refNoInternal} />
                 <RefInput label="Customer" value={entry.customerName} />
               </div>
            </div>
            <div className="space-y-[1vw]">
               <h4 className="text-[0.85vw] font-bold text-emerald-700 border-b border-emerald-100 pb-[0.3vw]">Product Details</h4>
               <div className="grid grid-cols-1 gap-[0.8vw]">
                 <RefInput label="Description" value={product.productDescription} />
                 <RefInput label="Code" value={product.productCode} />
                 <RefInput label="Qty" value={product.qty || "1"} />
                 <RefInput label="Serial Number" value={product.serialNumber} />
                 <RefInput label="Board Type" value={product.boardType} />
               </div>
            </div>
          </div>

          {product.report && (
            <div className="space-y-[1vw] mt-[1vw] p-[1vw] bg-white rounded-[0.6vw] border border-slate-400">
               <h4 className="text-[0.85vw] font-bold text-gray-800 border-b border-slate-400 pb-[0.3vw]">Technical Report</h4>
               <div className="grid grid-cols-2 gap-[1vw]">
                 <RefInput label="Tested By" value={product.report.testedBy} />
                 <RefInput label="Designators" value={product.report.designators} />
                 <RefInput label="4M Category" value={product.report.fourMCategory} />
                 <RefInput label="Error Code" value={product.report.errorCode} />
                 <RefInput label="Problem Description" value={product.report.problemDescription} span={2} />
                 <RefInput label="Root Cause" value={product.report.rootCause} span={2} />
                 <RefInput label="Corrective Action" value={product.report.correctiveAction} span={2} />
                 <RefInput label="Parts Replaced" value={product.report.partsReplacement} span={2} />
                 <RefInput label="Status" value={product.report.status} />
                 <RefInput label="Disposition" value={product.report.disposition} />
                 <div className="col-span-2">
                    <label className="text-[0.75vw] font-semibold text-black mb-[0.25vw] block">Technical Image</label>
                    {product.report.image ? (
                        <div className="mt-[0.5vw]">
                             <img 
                                src={`${API_URL}${product.report.image}`} 
                                alt="Report" 
                                className="max-w-[15vw] rounded-[0.4vw] border border-gray-400 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => window.open(`${API_URL}${product.report.image}`, '_blank')}
                             />
                        </div>
                    ) : (
                        <div className="text-[0.75vw] text-gray-400 italic">No image uploaded</div>
                    )}
                 </div>
               </div>
            </div>
          )}
        </div>
        <div className="p-[1vw] border-t border-slate-400 bg-gray-50 text-right">
          <button onClick={onClose} className="px-[1.5vw] py-[0.5vw] bg-gray-800 text-white rounded-[0.4vw] font-bold text-[0.8vw] cursor-pointer">Close View</button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function ServiceMaterialInwardResponse({ currentUser: propUser }) {
  const [entries, setEntries] = useState([]);
  const { toast } = useNotification();
  const [employees, setEmployees] = useState([]);
  const [fourMCategories, setFourMCategories] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(propUser || null);
  const [infoSelected, setInfoSelected] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [drafts, setDrafts] = useState({});
  const [savingStates, setSavingStates] = useState({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const getDraft = (productId, product) => {
    if (drafts[productId]) return drafts[productId];
    return {
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
      currentRemark: "",
      designators: product.report?.designators || "",
      image: product.report?.image || ""
    };
  };

  const handleDraftChange = (productId, product, field, value) => {
    setDrafts(prev => {
      const existing = prev[productId] || getDraft(productId, product);
      return {
        ...prev,
        [productId]: { ...existing, [field]: value, hasChanges: true }
      };
    });
  };

  const handleImageChange = (productId, product, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDrafts(prev => {
          const existing = prev[productId] || getDraft(productId, product);
          return {
            ...prev,
            [productId]: {
              ...existing,
              imageFile: file,
              imagePreview: reader.result,
              hasChanges: true
            }
          };
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveRow = async (entry, product, draft, showToastMsg = true) => {
    if (!draft || !draft.hasChanges) return true;

    if (!draft.fourMCategory?.trim()) { toast(`4M Category is mandatory for ${product.productDescription}`, "error"); return false; }
    if (!draft.problemDescription?.trim()) { toast(`Problem Description is mandatory for ${product.productDescription}`, "error"); return false; }
    if (!draft.rootCause?.trim()) { toast(`Root Cause is mandatory for ${product.productDescription}`, "error"); return false; }
    if (!draft.correctiveAction?.trim()) { toast(`Corrective Action is mandatory for ${product.productDescription}`, "error"); return false; }
    if (draft.status === "Completed" && !draft.completedDate) { toast(`Completed Date is mandatory for ${product.productDescription}`, "error"); return false; }

    const historyEntry = {
      status: draft.status,
      disposition: draft.disposition,
      remark: draft.currentRemark,
      timestamp: new Date().toISOString()
    };

    const updatedReport = {
      testedBy: draft.testedBy,
      disposition: draft.disposition,
      fourMCategory: draft.fourMCategory,
      errorCode: draft.errorCode,
      problemDescription: draft.problemDescription,
      rootCause: draft.rootCause,
      partsReplacement: draft.partsReplacement,
      correctiveAction: draft.correctiveAction,
      completedDate: draft.completedDate,
      status: draft.status,
      currentRemark: draft.currentRemark,
      designators: draft.designators,
      image: product.report?.image || "",
      lastUpdated: new Date().toISOString(),
      history: [...(product.report?.history || []), historyEntry]
    };

    setSavingStates(prev => ({ ...prev, [product._pid]: true }));
    try {
      await updateEntry(entry.id, product._pid, updatedReport, draft.imageFile);
      
      setDrafts(prev => {
        const next = { ...prev };
        if (next[product._pid]) {
          next[product._pid] = { ...next[product._pid], hasChanges: false, currentRemark: "" };
        }
        return next;
      });
      if (showToastMsg) toast("Report saved successfully!");
      return true;
    } catch (err) {
      if (showToastMsg) toast("Failed to save report.", "error");
      return false;
    } finally {
      setSavingStates(prev => ({ ...prev, [product._pid]: false }));
    }
  };

  const handleBulkSave = async () => {
    const productsToSave = [];
    for (const { entry, product } of myItems) {
      const draft = drafts[product._pid];
      if (draft && draft.hasChanges) {
        productsToSave.push({ entry, product, draft });
      }
    }

    if (productsToSave.length === 0) {
      return toast("No changes to save.", "warning");
    }

    setIsBulkSaving(true);
    try {
      const results = await Promise.all(productsToSave.map(({ entry, product, draft }) => saveRow(entry, product, draft, false)));
      const allSuccess = results.every(res => res);
      if (allSuccess) {
        toast(`Bulk save completed! ${productsToSave.length} items updated.`);
      } else {
        toast("Some items failed validation or saving.", "error");
      }
    } catch (err) {
      toast("An error occurred during bulk save.", "error");
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

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
        } catch { }
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
    } finally {
      setInitialLoading(false);
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
    return res.sort((a, b) => (a.entry.customerName || "").localeCompare(b.entry.customerName || ""));
  }, [entries, filterStatus]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return myItems.slice(startIndex, startIndex + itemsPerPage);
  }, [myItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(myItems.length / itemsPerPage);

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
  const updateEntry = async (id, productId, report, imageFile) => {
    try {
      const fd = new FormData();
      fd.append("productId", productId);
      fd.append("report", JSON.stringify(report));
      if (imageFile) fd.append("image", imageFile);

      const res = await axios.patch(`${API_URL}/service-material/${id}/report`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
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
    { key: "sno", label: "S.No", align: "text-center" },
    { key: "date", label: "Date", align: "text-left", minW: "min-w-[7vw]" },
    { key: "ref", label: "Ref No", align: "text-left", minW: "min-w-[7vw]" },
    { key: "customer", label: "Customer", align: "text-left", minW: "min-w-[12vw]" },
    { key: "product", label: "Product", align: "text-left", minW: "min-w-[12vw]" },
    { key: "board", label: "Board Type", align: "text-left", minW: "min-w-[8vw]" },
    { key: "serial", label: "Serial No", align: "text-left", minW: "min-w-[8vw]" },
    { key: "testedBy", label: "Tested By", align: "text-left", minW: "min-w-[10vw]" },
    { key: "fourM", label: "4M Category", align: "text-left", minW: "min-w-[10vw]" },
    { key: "errorCode", label: "Error Code", align: "text-left", minW: "min-w-[8vw]" },
    { key: "problemDesc", label: "Problem Desc", align: "text-left", minW: "min-w-[12vw]" },
    { key: "designators", label: "Designators", align: "text-left", minW: "min-w-[10vw]" },
    { key: "rootCause", label: "Root Cause", align: "text-left", minW: "min-w-[12vw]" },
    { key: "partsReplaced", label: "Parts Replaced", align: "text-left", minW: "min-w-[12vw]" },
    { key: "correctiveAction", label: "Corrective Action", align: "text-left", minW: "min-w-[12vw]" },
    { key: "disposition", label: "Disposition", align: "text-left", minW: "min-w-[10vw]" },
    { key: "completionDate", label: "Completion Date", align: "text-left", minW: "min-w-[10vw]" },
    { key: "status", label: "Status", align: "text-center", minW: "min-w-[10vw]" },
    { key: "remarks", label: "Action Remark", align: "text-center", minW: "min-w-[10vw]" },
    { key: "image", label: "Image", align: "text-center", minW: "min-w-[6vw]" },
    { key: "info", label: "Info", align: "text-center" },
    { key: "action", label: "Action", align: "text-center", minW: "min-w-[8vw]" },
  ];

  if (initialLoading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-[0.9vw]">
          <Loader2 className="w-[2.2vw] h-[2.2vw] text-blue-600 animate-spin" />
          <div className="text-[0.9vw] font-semibold text-gray-700">Loading service material data...</div>
        </div>
      </div>
    );
  }

  return (
        <div className="w-full font-sans">
      <datalist id="errorCodeList">
        {errorCodeHistory?.map((opt, i) => <option key={i} value={opt} />)}
      </datalist>
      <datalist id="problemDescList">
        {problemDescHistory?.map((opt, i) => <option key={i} value={opt} />)}
      </datalist>
      {/* Header */}
      <div className="flex items-center justify-between mb-[1vw] bg-white p-[0.8vw] rounded-[0.8vw] border border-slate-400 shadow-sm">
        <div className="flex items-center gap-[0.6vw]">
          <div className="w-[2.2vw] h-[2.2vw] rounded-[0.5vw] bg-gradient-to-br from-blue-700 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-800/20">
            <Package className="w-[1.1vw] h-[1.1vw] text-white" />
          </div>
          <div>
            <h1 className="text-[1.1vw] font-bold text-blue-700 uppercase tracking-tight">SERVICE MATERIAL MANAGEMENT</h1>
            <p className="text-[0.68vw] text-gray-500 font-medium italic">Service material inward items and reporting</p>
          </div>
        </div>

        <div className="flex items-center gap-[1.2vw]">
          {/* Quick Pagination (Top) */}
          {myItems.length > 0 && (
            <div className="flex items-center gap-[0.6vw] bg-blue-50/50 px-[0.8vw] py-[0.4vw] rounded-full border border-blue-100 shadow-inner">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-[1.4vw] h-[1.4vw] flex items-center justify-center rounded-full bg-white border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft className="w-[0.8vw] h-[0.8vw]" />
              </button>
              <div className="flex items-center gap-[0.3vw] min-w-[4.5vw] justify-center">
                <span className="text-[0.75vw] font-bold text-blue-700">{currentPage}</span>
                <span className="text-[0.65vw] font-medium text-blue-300 italic">of</span>
                <span className="text-[0.75vw] font-bold text-gray-600">{totalPages || 1}</span>
              </div>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="w-[1.4vw] h-[1.4vw] flex items-center justify-center rounded-full bg-white border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronRight className="w-[0.8vw] h-[0.8vw]" />
              </button>
            </div>
          )}

          <div className="h-[2vw] w-[1px] bg-gray-200 mx-[0.2vw]" />

          {myItems.length >= 0 && (
            <StatsBar
              items={entries.flatMap(e => e.products?.map(p => ({ product: p })) || [])}
              activeFilter={filterStatus}
              onFilterChange={setFilterStatus}
            />
          )}
        </div>
      </div>

      {/* Content */}
      {myItems.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-[0.6vw] border border-gray-400 overflow-hidden shadow-sm flex flex-col h-fit max-h-[72vh]">
          {/* Table Container with Internal Scroll */}
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-max border-separate border-spacing-0">
              {/* Table Header */}
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="bg-blue-50/95 backdrop-blur-md">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`${col.width} ${col.align} px-[0.8vw] py-[0.8vw] text-[0.82vw] font-semibold text-black uppercase whitespace-nowrap border-b border-r border-blue-200 last:border-r-0`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  let lastCustomer = null;
                  return paginatedItems.map(({ entry, product }, idx) => {
                    const isNewCustomer = entry.customerName !== lastCustomer;
                    lastCustomer = entry.customerName;

                    const pStatus = product.status || product.report?.status || "Open";
                    const pRemark = product.remark || product.report?.currentRemark || "—";
                    const statusCfg = STATUS_CONFIG[pStatus] || STATUS_CONFIG["Open"];
                    const StatusIcon = statusCfg.icon;
                    const isHovered = hoveredRow === idx;
                    const isClaimedByMe = product.assignedTo === (currentUser?.userId || currentUser?.id);
                    const draft = isClaimedByMe ? getDraft(product._pid, product) : null;
                    const hc = (field, val) => handleDraftChange(product._pid, product, field, val);

                    return (
                      <React.Fragment key={`${entry.id}-${product._pid}`}>
                        {isNewCustomer && (
                          <tr className="bg-blue-50/40 border-y border-blue-100 sticky top-[2.8vw] z-15 backdrop-blur-md">
                            <td colSpan={columns.length} className="px-[1vw] py-[0.5vw] border-b border-blue-100">
                              <div className="flex items-center gap-[0.6vw]">
                                <div className="w-[0.35vw] h-[1.1vw] bg-blue-600 rounded-full" />
                                <span className="text-[0.82vw] font-bold text-blue-800 uppercase tracking-wide">
                                  {entry.customerName}
                                </span>
                                <span className="text-[0.62vw] text-blue-600 font-bold px-[0.5vw] py-[0.05vw] bg-white rounded-full border border-blue-200 ml-[0.4vw] shadow-sm">
                                  {entry.customerCode || "N/A"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <motion.tr
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (idx % itemsPerPage) * 0.03 }}
                          onMouseEnter={() => setHoveredRow(idx)}
                          onMouseLeave={() => setHoveredRow(null)}
                          className={`transition-all duration-150 ${isHovered ? "bg-blue-50/30" : "bg-white"}`}
                        >

                          {/* S.No */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-400 bg-white sticky left-0 z-10 shadow-[4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                            <span className="inline-flex items-center justify-center w-[1.5vw] h-[1.5vw] rounded-full bg-gray-100 text-[0.68vw] font-bold text-gray-600">
                              {((currentPage - 1) * itemsPerPage) + idx + 1}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            <div className="flex items-center gap-[0.3vw]">
                              <Calendar className="w-[0.75vw] h-[0.75vw] text-blue-600" />
                              <span className="text-[0.75vw] text-gray-700 font-medium whitespace-nowrap">
                                {entry.date ? fmtDate(entry.date) : "—"}
                              </span>
                            </div>
                          </td>

                          {/* Ref No */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            <span className="text-[0.75vw] font-semibold text-gray-800 whitespace-nowrap">
                              {entry.refNoCustomer || entry.refNo || "—"}
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            <div className="flex items-center gap-[0.5vw]">
                              <div className="w-[1.6vw] h-[1.6vw] rounded-full bg-gradient-to-br from-blue-700 to-blue-600 flex items-center justify-center text-white text-[0.55vw] font-bold flex-shrink-0">
                                {entry.customerName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                              </div>
                              <div className="min-w-[10vw]">
                                <div className="text-[0.75vw] font-semibold text-gray-800 break-words whitespace-normal">{entry.customerName}</div>
                                <div className="text-[0.65vw] text-gray-600 mt-[.2vw]">CUS: {entry.customerCode || "—"}</div>
                              </div>
                            </div>
                          </td>

                          {/* Product */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            <div className="min-w-[10vw]">
                              <div className="text-[0.75vw] font-semibold text-gray-800 break-words whitespace-normal" title={product.productDescription}>
                                {product.productDescription}
                              </div>
                              <div className="text-[0.65vw] text-gray-600 mt-[.2vw]">{product.productCode || "—"}</div>
                            </div>
                          </td>

                          {/* Board Type */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            <span className="text-[0.75vw] font-semibold text-gray-700 whitespace-nowrap">
                              {product.boardType || "—"}
                            </span>
                          </td>

                          {/* Serial No */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            <span className="text-[0.75vw] font-semibold text-gray-700 whitespace-nowrap">
                              {product.serialNumber || "—"}
                            </span>
                          </td>

                          {/* Tested By */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <select value={draft.testedBy} onChange={e => hc("testedBy", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {employees.map(e => <option key={e.userId} value={e.name}>{e.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.testedBy || "—"}</span>
                            )}
                          </td>

                          {/* 4M Category */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <select value={draft.fourMCategory} onChange={e => hc("fourMCategory", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {fourMCategories?.map(opt => <option key={opt._id || opt.id} value={opt.name}>{opt.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.fourMCategory || "—"}</span>
                            )}
                          </td>

                          {/* Error Code */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <input type="text" list="errorCodeList" value={draft.errorCode} onChange={e => hc("errorCode", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[6vw]" placeholder="Code..." />
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.errorCode || "—"}</span>
                            )}
                          </td>

                          {/* Problem Description */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <input type="text" list="problemDescList" value={draft.problemDescription} onChange={e => hc("problemDescription", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw]" placeholder="Problem..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.problemDescription || "—"}</span>
                            )}
                          </td>

                          {/* Designators */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <select value={draft.designators} onChange={e => hc("designators", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {employees.map(e => <option key={e.userId} value={e.name}>{e.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.designators || "—"}</span>
                            )}
                          </td>

                          {/* Root Cause */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <textarea value={draft.rootCause} onChange={e => hc("rootCause", e.target.value)} rows={1} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw] resize-y min-h-[1.5vw]" placeholder="Root Cause..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.rootCause || "—"}</span>
                            )}
                          </td>

                          {/* Parts Replaced */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <textarea value={draft.partsReplacement} onChange={e => hc("partsReplacement", e.target.value)} rows={1} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw] resize-y min-h-[1.5vw]" placeholder="Parts..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.partsReplacement || "—"}</span>
                            )}
                          </td>

                          {/* Corrective Action */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <textarea value={draft.correctiveAction} onChange={e => hc("correctiveAction", e.target.value)} rows={1} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw] resize-y min-h-[1.5vw]" placeholder="Action..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.correctiveAction || "—"}</span>
                            )}
                          </td>

                          {/* Disposition */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <select value={draft.disposition} onChange={e => hc("disposition", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {DISPOSITION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.disposition || "—"}</span>
                            )}
                          </td>

                          {/* Completion Date */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <input type="date" value={draft.completedDate} onChange={e => hc("completedDate", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]" />
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.completedDate ? fmtDate(product.report.completedDate) : "—"}</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-400">
                            {isClaimedByMe ? (
                              <select value={draft.status} onChange={e => hc("status", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 font-semibold min-w-[9vw]">
                                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <span className={`inline-flex items-center gap-[0.3vw] px-[0.6vw] py-[0.25vw] rounded-full border text-[0.68vw] font-semibold whitespace-nowrap ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                                <StatusIcon className="w-[0.8vw] h-[0.8vw]" />
                                {pStatus}
                              </span>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400">
                            {isClaimedByMe ? (
                              <input type="text" value={draft.currentRemark} onChange={e => hc("currentRemark", e.target.value)} className="w-full text-[0.75vw] border border-gray-400 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]" placeholder="Remark..." />
                            ) : (
                              <span className="text-[0.75vw] text-gray-700 font-semibold">{pRemark}</span>
                            )}
                          </td>

                          {/* Image Upload */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-400 text-center min-w-[8vw]">
                            {isClaimedByMe ? (
                              <div className="flex items-center justify-center gap-[0.5vw]">
                                <input type="file" id={`file-${product._pid}`} accept="image/*" onChange={(e) => handleImageChange(product._pid, product, e)} className="hidden" />
                                <label htmlFor={`file-${product._pid}`} className="flex items-center justify-center w-[2vw] h-[2vw] bg-blue-50 border border-blue-200 text-blue-600 rounded-[0.4vw] cursor-pointer hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Upload Image">
                                  <svg className="w-[1vw] h-[1vw]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </label>
                                {(draft.imagePreview || draft.image) && (
                                  <div className="w-[2.2vw] h-[2.2vw] rounded-[0.4vw] border border-slate-400 overflow-hidden flex-shrink-0 relative group shadow-sm">
                                    <img src={draft.imagePreview || (draft.image.startsWith('http') ? draft.image : `${API_URL?.replace(/\/$/, '') || ''}${draft.image.startsWith('/') ? '' : '/'}${draft.image}`)} alt="preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => window.open(draft.imagePreview || (draft.image.startsWith('http') ? draft.image : `${API_URL?.replace(/\/$/, '') || ''}${draft.image.startsWith('/') ? '' : '/'}${draft.image}`), '_blank')}>
                                      <Eye className="w-[1vw] h-[1vw] text-white" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              product.report?.image ? (
                                <div className="w-[2.2vw] h-[2.2vw] rounded-[0.4vw] border border-slate-400 overflow-hidden relative group shadow-sm mx-auto">
                                  <img src={product.report.image.startsWith('http') ? product.report.image : `${API_URL?.replace(/\/$/, '') || ''}${product.report.image.startsWith('/') ? '' : '/'}${product.report.image}`} alt="preview" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => window.open(product.report.image.startsWith('http') ? product.report.image : `${API_URL?.replace(/\/$/, '') || ''}${product.report.image.startsWith('/') ? '' : '/'}${product.report.image}`, '_blank')}>
                                    <Eye className="w-[1vw] h-[1vw] text-white" />
                                  </div>
                                </div>
                              ) : <span className="text-[0.75vw] text-gray-400">—</span>
                            )}
                          </td>

                          {/* Info */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-400">
                             <button 
                               onClick={() => setInfoSelected({ entry, product })}
                               className="w-[1.8vw] h-[1.8vw] rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-sm border border-blue-100 mx-auto"
                               title="View Details"
                             >
                               <Eye className="w-[0.9vw] h-[0.9vw]" />
                             </button>
                          </td>

                          {/* Action */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-400 bg-white sticky right-0 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                            {product.assignedTo ? (
                              isClaimedByMe ? (
                                <button
                                  onClick={() => saveRow(entry, product, draft)}
                                  disabled={!draft?.hasChanges || savingStates[product._pid]}
                                  className={`inline-flex items-center gap-[0.25vw] px-[0.7vw] py-[0.35vw] rounded-[0.35vw] text-[0.85vw] font-semibold transition-all ${savingStates[product._pid] ? "bg-blue-400 text-white cursor-not-allowed" : draft?.hasChanges ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-md" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                                >
                                  {savingStates[product._pid] ? (
                                    <>
                                      <Loader2 className="w-[0.75vw] h-[0.75vw] animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-[0.75vw] h-[0.75vw]" />
                                      Save
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div className="flex flex-col items-center gap-[0.2vw]">
                                  <Badge label="Claimed" color="slate" size="xs" />
                                  <span className="text-[0.6vw] text-gray-800 font-bold whitespace-nowrap">{product.assignedToName}</span>
                                </div>
                              )
                            ) : (
                              <ClaimButton onClaim={() => claimProduct(entry.id, product._pid)} />
                            )}
                          </td>
                        </motion.tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="bg-gray-50 border-t border-slate-400 px-[1.2vw] py-[0.6vw] flex items-center justify-between">
            <div className="flex items-center gap-[1.5vw]">
              <span className="text-[0.72vw] text-gray-500 font-medium">
                Showing <strong className="text-gray-800">{paginatedItems.length}</strong> of <strong className="text-gray-800">{myItems.length}</strong> assigned products
              </span>

              {/* Pagination Controls */}
              <div className="flex items-center gap-[1vw] border-l border-gray-400 pl-[1.5vw]">
                <div className="flex items-center gap-[0.5vw]">
                  <span className="text-[0.68vw] text-gray-500 font-bold uppercase tracking-wider">Rows per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-gray-400 rounded-[0.3vw] px-[0.4vw] py-[0.15vw] text-[0.72vw] font-bold text-blue-700 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                  >
                    {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-[0.6vw]">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-[0.3vw] rounded-[0.4vw] bg-white border border-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm group"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-[1vw] h-[1vw] text-gray-600 group-hover:text-blue-600" />
                  </button>

                  <div className="flex items-center gap-[0.4vw] px-[0.6vw] py-[0.15vw] bg-blue-50 border border-blue-100 rounded-[0.3vw]">
                    <span className="text-[0.72vw] font-bold text-blue-700">{currentPage}</span>
                    <span className="text-[0.65vw] font-medium text-blue-300">/</span>
                    <span className="text-[0.72vw] font-bold text-gray-600">{totalPages || 1}</span>
                  </div>

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-[0.3vw] rounded-[0.4vw] bg-white border border-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm group"
                    title="Next Page"
                  >
                    <ChevronRight className="w-[1vw] h-[1vw] text-gray-600 group-hover:text-blue-600" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-[0.4vw] px-[0.8vw] py-[0.3vw] bg-emerald-50 border border-emerald-100 rounded-full">
              <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[0.65vw] font-bold text-emerald-700 uppercase tracking-widest">Live Sync Enabled</span>
            </div>
            <button onClick={handleBulkSave} disabled={isBulkSaving} className={`flex items-center gap-[0.5vw] px-[1vw] py-[0.4vw] text-white rounded-[0.4vw] text-[0.75vw] font-bold shadow-md shadow-emerald-900/20 transition-all ml-[1vw] ${isBulkSaving ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}>
              {isBulkSaving ? (
                <>
                  <Loader2 className="w-[0.9vw] h-[0.9vw] animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-[0.9vw] h-[0.9vw]" />
                  Bulk Save
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {infoSelected && (
          <ServiceInfoModal
            entry={infoSelected.entry}
            product={infoSelected.product}
            onClose={() => setInfoSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
