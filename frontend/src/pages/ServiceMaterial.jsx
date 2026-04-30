// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Edit3,
  ArrowLeft,
  Plus,
  Clock,
  User,
  Package,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Shield,
  FileText,
  History,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useNotification } from "../components/NotificationContext";
import EditableProductTable from "../components/EditableProductTable";

const API_URL = import.meta.env.VITE_API_URL;

// Storage Keys
const INWARD_KEY = "service_material_inward_v2";
const CUSTOMER_DB_KEY = "customer_db_grouped_v5";
const EMPLOYEES_KEY = "employees";
const ESCALATION_FLOWS_KEY = "escalation_flows_v2";
const ITEMS_PER_PAGE = 10;

// Status/Type Options
const FINAL_STATUS_OPTIONS = ["Pending", "Delivered", "Hold", "Not Repairable"];
const TYPE_OPTIONS = ["W", "PW"];
const TYPE_LABELS = { W: "Warranty", PW: "Paid" };

const FINAL_STATUS_COLORS = {
  Pending: "bg-orange-100 text-orange-700 border-orange-300",
  Delivered: "bg-green-100 text-green-700 border-green-300",
  Hold: "bg-red-100 text-red-700 border-red-300",
  "Not Repairable": "bg-gray-200 text-gray-700 border-gray-400",
};

// Helpers
const lsLoad = (key, fb) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};
const lsSave = (key, v) => localStorage.setItem(key, JSON.stringify(v));

const genRef = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SMI-${d}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const todayDateStr = () => new Date().toISOString().slice(0, 10);

const fmtDate = (s) => {
  if (!s) return "—";
  if (s.includes("T")) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  if (s.includes("-") && s.split("-")[0].length === 4) {
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  }
  return s;
};

const emptyProduct = () => ({
  _pid: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  productCode: "",
  productDescription: "",
  productSegment: "",
  serialNumber: "",
  boardType: "",
  qty: "1",
  type: "W",
  expectedDeliveryDate: "",
  status: "Open",
  escalationLevel: 0,
  escalationHistory: [],
  assignedTo: "",
  assignedToName: "",
  assignedDepartment: "",
});

const emptyBase = () => ({
  date: todayDateStr(),
  refNoCustomer: "",
  refNoInternal: "",
  customerName: "",
  customerCode: "",
  category: "",
  assignedTo: "",
  assignedToName: "",
  assignedDepartment: "",
  finalStatus: "Pending",
  finalStatusRemarks: "",
});

// Avatar
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
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

const Avatar = ({ name, size = "md" }) => {
  const sz = {
    sm: "w-[1.4vw] h-[1.4vw] text-[0.52vw]",
    md: "w-[1.8vw] h-[1.8vw] text-[0.65vw]",
    lg: "w-[2.4vw] h-[2.4vw] text-[0.82vw]",
  };
  return (
    <div
      title={name}
      className={`rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center font-bold text-white flex-shrink-0 ${sz[size]}`}
    >
      {initials(name)}
    </div>
  );
};

// Duplicate Modal
const DuplicateModal = ({ onConfirm, onClose }) => {
  const [count, setCount] = useState(1);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[0.8vw] shadow-2xl border border-gray-300 p-[1.8vw] w-[22vw]"
      >
        <div className="flex items-center gap-[0.6vw] mb-[1.2vw]">
          <div className="w-[2.2vw] h-[2.2vw] rounded-full bg-blue-100 flex items-center justify-center">
            <Copy className="w-[1.1vw] h-[1.1vw] text-blue-600" />
          </div>
          <div>
            <div className="text-[0.9vw] font-bold text-black">Duplicate Product Row</div>
            <div className="text-[0.72vw] text-gray-800">How many copies do you need?</div>
          </div>
        </div>
        <div className="flex items-center gap-[0.8vw] mb-[1.4vw]">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="w-[2.4vw] h-[2.4vw] rounded-[0.4vw] border border-gray-400 text-gray-800 hover:bg-gray-100 font-bold text-[1.1vw] flex items-center justify-center cursor-pointer"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max="50"
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))
            }
            className="flex-1 border border-gray-400 rounded-[0.4vw] p-[0.5vw] text-center text-[1vw] font-bold outline-none focus:border-blue-500 shadow-none"
          />
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(50, c + 1))}
            className="w-[2.4vw] h-[2.4vw] rounded-[0.4vw] border border-gray-400 text-gray-800 hover:bg-gray-100 font-bold text-[1.1vw] flex items-center justify-center cursor-pointer"
          >
            +
          </button>
        </div>
        <div className="text-[0.72vw] text-gray-700 mb-[1.2vw] bg-blue-50 rounded-[0.4vw] p-[0.6vw] border border-blue-200">
          This will add <strong>{count}</strong> copy{count > 1 ? "ies" : ""} of this product row.
        </div>
        <div className="flex gap-[0.6vw] justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-[1.2vw] py-[0.55vw] border border-gray-300 rounded-[0.4vw] text-[0.78vw] text-black/80 hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(count);
              onClose();
            }}
            className="px-[1.4vw] py-[0.55vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.4vw] text-[0.78vw] font-semibold cursor-pointer flex items-center gap-[0.4vw]"
          >
            <Copy className="w-[0.85vw] h-[0.85vw]" />Add {count}{" "}
            {count > 1 ? "Copies" : "Copy"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Unsaved Changes Confirmation Modal
const UnsavedChangesModal = ({ onConfirm, onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[0.8vw] shadow-2xl border border-gray-300 p-[2vw] w-[25vw]"
      >
        <div className="flex items-center gap-[0.8vw] mb-[1.2vw]">
          <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-[1.2vw] h-[1.2vw] text-red-600" />
          </div>
          <div>
            <div className="text-[1vw] font-bold text-black">Unsaved Changes</div>
            <div className="text-[0.75vw] text-gray-800">You have made changes to the form. Are you sure you want to go back?</div>
          </div>
        </div>
        
        <div className="text-[0.72vw] text-red-700 bg-red-50 rounded-[0.4vw] p-[0.8vw] border border-red-200 mb-[1.5vw]">
          <strong>Warning:</strong> Any unsaved information will be permanently lost if you leave this page.
        </div>

        <div className="flex gap-[0.8vw] justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-[1.5vw] py-[0.6vw] border border-gray-300 rounded-[0.4vw] text-[0.8vw] font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Continue Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-[1.5vw] py-[0.6vw] bg-red-600 hover:bg-red-700 text-white rounded-[0.4vw] text-[0.8vw] font-bold cursor-pointer transition-all shadow-md active:scale-95"
          >
            Yes, Discard Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Board Type Master Modal
const BoardTypeMasterModal = ({ onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: "" });
  const [editingId, setEditingId] = useState(null);
  const [editItem, setEditItem] = useState({ name: "" });
  const { toast } = useNotification();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API_URL}/master/board-types`);
      setItems(res.data);
    } catch (err) {
      toast("Failed to fetch Board Types", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return toast("Name is required", "error");
    try {
      await axios.post(`${API_URL}/master/board-types`, newItem);
      toast("Added successfully", "success");
      setNewItem({ name: "" });
      fetchItems();
    } catch (err) {
      toast("Failed to add", "error");
    }
  };

  const handleUpdate = async (id) => {
    if (!editItem.name.trim()) return toast("Name is required", "error");
    try {
      await axios.put(`${API_URL}/master/board-types/${id}`, editItem);
      toast("Updated successfully", "success");
      setEditingId(null);
      fetchItems();
    } catch (err) {
      toast("Failed to update", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Board Type?")) return;
    try {
      await axios.delete(`${API_URL}/master/board-types/${id}`);
      toast("Deleted successfully", "success");
      fetchItems();
    } catch (err) {
      toast("Failed to delete", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[0.8vw] shadow-2xl border border-gray-300 w-[40vw] max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="bg-blue-600 px-[1.5vw] py-[1.2vw] flex justify-between items-center">
          <div className="flex items-center gap-[0.8vw]">
            <div className="bg-white/20 p-[0.4vw] rounded-[0.4vw]">
              <Wrench className="w-[1.2vw] h-[1.2vw] text-white" />
            </div>
            <div>
              <h3 className="text-[1.1vw] font-bold text-white tracking-wider">Manage Board Types</h3>
              <p className="text-[0.75vw] text-white/80">Add, edit or delete board types master data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-[0.4vw] hover:bg-white/20 rounded-full transition-colors cursor-pointer">
            <X className="w-[1.2vw] h-[1.2vw] text-white" />
          </button>
        </div>

        <div className="p-[1.5vw] bg-gray-50 border-b border-gray-200">
          <form onSubmit={handleAdd} className="flex gap-[0.8vw] items-end">
            <div className="flex-1 space-y-[0.3vw]">
              <label className="text-[0.75vw] font-bold text-gray-700">Board Type Name *</label>
              <input
                type="text"
                required
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full border border-gray-300 rounded-[0.4vw] p-[0.55vw] text-[0.8vw] outline-none focus:border-blue-500"
                placeholder="e.g. Main Board"
              />
            </div>
            <button
              type="submit"
              className="px-[1vw] py-[0.55vw] h-[2.2vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.4vw] text-[0.8vw] font-bold cursor-pointer transition-all flex items-center gap-[0.4vw]"
            >
              <Plus className="w-[0.9vw] h-[0.9vw]" /> Add
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-[1.5vw] bg-white">
          {loading ? (
            <div className="text-center text-[0.85vw] text-gray-500 py-[2vw]">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-[0.85vw] text-gray-500 py-[2vw]">No board types found.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="text-left py-[0.6vw] px-[0.8vw] text-[0.75vw] font-bold text-gray-700">Name</th>
                  <th className="text-right py-[0.6vw] px-[0.8vw] text-[0.75vw] font-bold text-gray-700 w-[20%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-b border-gray-100 hover:bg-gray-50">
                    {editingId === item._id ? (
                      <>
                        <td className="py-[0.5vw] px-[0.8vw]">
                          <input
                            type="text"
                            value={editItem.name}
                            onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                            className="w-full border border-gray-300 rounded-[0.3vw] p-[0.4vw] text-[0.8vw] outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="py-[0.5vw] px-[0.8vw] text-right">
                          <button onClick={() => handleUpdate(item._id)} className="text-green-600 hover:text-green-800 p-[0.3vw] cursor-pointer"><Save className="w-[0.9vw] h-[0.9vw]" /></button>
                          <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 p-[0.3vw] ml-[0.3vw] cursor-pointer"><X className="w-[0.9vw] h-[0.9vw]" /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-[0.6vw] px-[0.8vw] text-[0.8vw] font-semibold text-gray-800">{item.name}</td>
                        <td className="py-[0.6vw] px-[0.8vw] text-right flex items-center justify-end gap-[0.4vw]">
                          <button onClick={() => { setEditingId(item._id); setEditItem({ name: item.name }); }} className="text-blue-500 hover:text-blue-700 p-[0.3vw] cursor-pointer"><Edit3 className="w-[0.9vw] h-[0.9vw]" /></button>
                          <button onClick={() => handleDelete(item._id)} className="text-red-500 hover:text-red-700 p-[0.3vw] cursor-pointer"><Trash2 className="w-[0.9vw] h-[0.9vw]" /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// Reports Modal
const ReportsModal = ({ row, onClose }) => {
  const products = row.products || [];
  const [expandedIndex, setExpandedIndex] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-[2vw]">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-[60vw] max-h-[85vh] rounded-[0.8vw] shadow-2xl overflow-hidden flex flex-col border border-gray-300"
      >
        <div className="bg-blue-600 px-[1.5vw] py-[1.2vw] flex justify-between items-center shadow-md">
          <div className="flex items-center gap-[0.9vw]">
            <div className="bg-white/20 p-[0.4vw] rounded-full">
              <FileText className="w-[1.4vw] h-[1.4vw] text-white" />
            </div>
            <div>
              <h3 className="text-[1.1vw] font-bold text-white uppercase tracking-wider">
                Service Technical Reports
              </h3>
              <p className="text-[0.75vw] text-white font-medium">
                {row.customerName} · Ref: {row.refNoCustomer || "N/A"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-white cursor-pointer transition-all hover:bg-white/10 p-[0.4vw] rounded-full"
          >
            <X className="w-[1.3vw] h-[1.3vw]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-[1.5vw] space-y-[0.8vw]">
          {products.map((prod, idx) => {
            const r = prod.report;
            const isExpanded = expandedIndex === idx;
            return (
              <div
                key={prod._pid}
                className={`border rounded-[0.6vw] transition-all shadow-sm ${
                  isExpanded ? "border-blue-400" : "border-gray-300"
                }`}
              >
                <div
                  onClick={() => setExpandedIndex(isExpanded ? -1 : idx)}
                  className={`px-[1.2vw] py-[0.8vw] flex justify-between items-center cursor-pointer transition-colors ${
                    isExpanded
                      ? "bg-blue-50/50"
                      : "bg-gray-50 hover:bg-blue-50/30"
                  }`}
                >
                  <div className="flex items-center gap-[1vw]">
                    <span className="w-[1.6vw] h-[1.6vw] bg-blue-600 text-white rounded-full flex items-center justify-center text-[0.7vw] font-bold shadow-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-[0.9vw] font-bold text-black">
                        {prod.productDescription}
                      </span>
                      <div className="flex items-center gap-[0.7vw] text-[0.72vw] text-gray-800 font-bold mt-[0.3vw]">
                        <span className="bg-gray-200 px-[0.4vw] py-[0.05vw] rounded border border-gray-300">
                          SN: {prod.serialNumber || "—"}
                        </span>
                        <span className="text-blue-500">·</span>
                        <span className="flex items-center gap-[0.3vw]">
                          <User className="w-[0.8vw] h-[0.8vw] text-blue-600" />
                          Assigned:{" "}
                          <span className="text-blue-700 font-bold">
                            {prod.assignedToName || "Unassigned"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-[1vw]">
                    <span
                      className={`px-[0.6vw] py-[0.15vw] rounded-full text-[0.65vw] font-bold border shadow-none ${
                        r?.status === "Completed"
                          ? "bg-green-100 text-green-700 border-green-400"
                          : r?.status === "Repair in Progress"
                          ? "bg-blue-50 text-blue-700 border-blue-400"
                          : r?.status === "Not Repairable"
                          ? "bg-red-50 text-red-700 border-red-400"
                          : "bg-gray-100 text-gray-800 border-gray-400"
                      }`}
                    >
                      {r?.status || "No Report Yet"}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-[1.2vw] h-[1.2vw] text-blue-600" />
                    ) : (
                      <ChevronDown className="w-[1.2vw] h-[1.2vw] text-blue-600" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-gray-300 bg-white"
                    >
                      {!r ? (
                        <div className="p-[2.5vw] text-center text-black text-[0.85vw] italic flex flex-col items-center gap-[0.6vw]">
                          <AlertCircle className="w-[1.8vw] h-[1.8vw] text-blue-400" />
                          "No technical report submitted yet by the assigned employee."
                        </div>
                      ) : (
                        <div className="p-[1.2vw] grid grid-cols-2 gap-[1.5vw]">
                          <div className="space-y-[1.2vw]">
                            <div className="grid grid-cols-2 gap-[1vw]">
                              <DetailItem label="Tested By" value={r.testedBy} />
                              <DetailItem
                                label="Completed Date"
                                value={fmtDate(r.completedDate)}
                              />
                              <DetailItem label="4M Category" value={r.fourMCategory} />
                              <DetailItem label="Error Code" value={r.errorCode} />
                            </div>
                            <DetailSection
                              label="Problem Identification"
                              value={r.problemDescription}
                            />
                            <DetailSection
                              label="Root Cause Analysis"
                              value={r.rootCause}
                            />
                            <DetailSection
                              label="Corrective Action"
                              value={r.correctiveAction}
                            />
                            {r.partsReplacement && (
                              <div className="bg-white border border-slate-200 rounded-[0.5vw] p-[0.8vw] shadow-sm hover:border-blue-200 transition-all">
                                <span className="text-[0.62vw] font-bold text-blue-500 uppercase block mb-[0.6vw]">
                                  Parts Replacement
                                </span>
                                <div className="space-y-[0.4vw]">
                                  {r.partsReplacement.split(',').map(s => s.trim()).filter(s => s.length > 0).map((part, i) => (
                                    <div key={i} className="flex items-center gap-[0.6vw] text-[0.8vw] font-bold text-slate-800 bg-slate-50 border border-slate-100 px-[0.6vw] py-[0.4vw] rounded-[0.4vw]">
                                      <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-blue-500" />
                                      {part}
                                    </div>
                                  ))}
                                  {r.partsReplacement.split(',').map(s => s.trim()).filter(s => s.length > 0).length === 0 && (
                                    <div className="text-[0.82vw] text-slate-400 italic">No parts recorded</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="bg-blue-50/40 rounded-[0.6vw] border border-blue-100 p-[1vw]">
                            <h4 className="text-[0.75vw] font-bold text-blue-700 uppercase tracking-wider mb-[1.2vw] flex items-center gap-[0.5vw]">
                              <History className="w-[1vw] h-[1vw] text-blue-600" />{" "}
                              Status History Trail
                            </h4>
                            <div className="space-y-[1vw]">
                              {r.history
                                ?.slice()
                                .reverse()
                                .map((h, hi) => (
                                  <div
                                    key={hi}
                                    className="relative pl-[1.6vw] pb-[1vw] last:pb-0 border-l-2 border-blue-200 last:border-transparent"
                                  >
                                    <div className="absolute left-[-0.4vw] top-0 w-[0.8vw] h-[0.8vw] bg-blue-600 rounded-full border-2 border-white shadow-md" />
                                    <div className="flex justify-between items-start gap-[1vw]">
                                      <div className="flex-1">
                                        <span className="text-[0.68vw] font-bold text-blue-700 px-[0.5vw] py-[0.05vw] bg-blue-100 rounded border border-blue-200 uppercase">
                                          {h.status}
                                        </span>
                                        <p className="text-[0.78vw] text-black mt-[0.3vw] leading-relaxed">
                                          {h.remark || "No remark provided."}
                                        </p>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <div className="text-[0.68vw] font-bold text-blue-600 bg-white px-[0.4vw] py-[0.05vw] rounded border border-blue-200 mb-[0.1vw] shadow-sm">
                                          {new Date(h.timestamp).toLocaleDateString(
                                            "en-GB"
                                          )}
                                        </div>
                                        <div className="text-[0.62vw] text-black font-medium opacity-80 tracking-[.05vw] mt-[.2vw]">
                                          {new Date(h.timestamp).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="px-[1.5vw] py-[1vw] border-t border-gray-300 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-[2.5vw] py-[0.6vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.5vw] text-[0.85vw] font-bold cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-[0.5vw]"
          >
            Close Panel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div className="bg-slate-50 p-[0.6vw] rounded-[0.4vw] border border-slate-200 shadow-sm">
    <span className="text-[0.62vw] font-bold text-blue-500 uppercase block leading-none mb-[0.3vw]">
      {label}
    </span>
    <span className="text-[0.85vw] font-semibold text-slate-800">{value || "—"}</span>
  </div>
);

const DetailSection = ({ label, value }) => (
  <div className="bg-white border border-slate-200 rounded-[0.5vw] p-[0.8vw] shadow-sm hover:border-blue-200 transition-all">
    <span className="text-[0.62vw] font-bold text-blue-500 uppercase block mb-[0.4vw]">
      {label}
    </span>
    <p className="text-[0.82vw] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
      {value || "No information provided."}
    </p>
  </div>
);



// Registration / View Form
const InwardForm = ({ initialData, customerDb, employees, boardTypes, onSave, onBack }) => {
  const { toast } = useNotification();
  const isReadOnly = !!initialData._readonly;
  const isEdit = !!initialData._editing;

  const [base, setBase] = useState(() => ({
    date: initialData.date || todayDateStr(),
    refNoCustomer: initialData.refNoCustomer || "",
    refNoInternal: initialData.refNoInternal || "",
    customerName: initialData.customerName || "",
    customerCode: initialData.customerCode || "",
    category: initialData.category || "",
    assignedTo: initialData.assignedTo || "",
    assignedToName: initialData.assignedToName || "",
    assignedDepartment: initialData.assignedDepartment || "",
    finalStatus: initialData.finalStatus || "Pending",
    finalStatusRemarks: initialData.finalStatusRemarks || "",
  }));

  const [products, setProducts] = useState(() => {
    if (initialData.products && initialData.products.length > 0)
      return initialData.products;
    if (initialData._editing || initialData._readonly) {
      return [
        {
          _pid: `p-${Date.now()}`,
          productCode: initialData.productCode || "",
          productDescription: initialData.productDescription || "",
          productSegment: initialData.productSegment || "",
          serialNumber: initialData.serialNumber || "",
          boardType: initialData.boardType || "",
          qty: initialData.qty || "1",
          type: initialData.type || "W",
          expectedDeliveryDate: initialData.expectedDeliveryDate || "",
          status: initialData.status || "Open",
          escalationLevel: initialData.escalationLevel || 0,
          escalationHistory: initialData.escalationHistory || [],
          assignedTo: initialData.assignedTo || "",
          assignedToName: initialData.assignedToName || "",
          assignedDepartment: initialData.assignedDepartment || "",
        },
      ];
    }
    return [emptyProduct()];
  });

  const [showCustDrop, setShowCustDrop] = useState(false);
  const [custSearch, setCustSearch] = useState(initialData.customerName || "");
  const [dupeTarget, setDupeTarget] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const custRef = useRef(null);

  // Browser refresh/close prevention
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && !isReadOnly) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isReadOnly]);

  useEffect(() => {
    const handler = (e) => {
      if (custRef.current && !custRef.current.contains(e.target))
        setShowCustDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const customerDbFlat = useMemo(
    () =>
      Array.isArray(customerDb) ? customerDb : Object.values(customerDb).flat(),
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

  const sb = (k, v) => {
    if (!isReadOnly) {
      setBase((p) => ({ ...p, [k]: v }));
      setIsDirty(true);
    }
  };

  const selectCustomer = (c) => {
    if (isReadOnly) return;
    setBase((p) => ({
      ...p,
      customerCode: c.code,
      customerName: c.name,
      category: c.type || p.category,
    }));
    setCustSearch(c.name);
    setShowCustDrop(false);
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        productCode: "",
        productDescription: "",
        productSegment: "",
      }))
    );
    setIsDirty(true);
  };

  const updateProduct = (updated) => {
    setProducts((prev) =>
      prev.map((p) => (p._pid === updated._pid ? updated : p))
    );
    setIsDirty(true);
  };
  const removeProduct = (pid) => {
    setProducts((prev) => prev.filter((p) => p._pid !== pid));
    setIsDirty(true);
  };
  const addProduct = () => {
    setProducts((prev) => [...prev, emptyProduct()]);
    setIsDirty(true);
  };

  const requestDuplicate = (prod) => setDupeTarget(prod);
  const confirmDuplicate = (prod, count) => {
    if (!prod.productCode) {
      toast("Please select a product before duplicating.", "warning");
      return;
    }
    const copies = Array.from({ length: count }, () => ({
      ...prod,
      _pid: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      serialNumber: "",
      boardType: "",
    }));
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p._pid === prod._pid);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx + 1, 0, ...copies);
      return next;
    });
    setIsDirty(true);
    setDupeTarget(null);
  };

  const custDbForRows = useMemo(() => {
    const map = {};
    customerDbFlat.forEach((r) => {
      if (!map[r.partyCode]) map[r.partyCode] = [];
      map[r.partyCode].push(r);
    });
    return map;
  }, [customerDbFlat]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasExpDateChanges =
      isReadOnly &&
      products.some(
        (p) =>
          p.expectedDeliveryDate !==
          (initialData.products?.find((ip) => ip._pid === p._pid)
            ?.expectedDeliveryDate || "")
      );
    if (isReadOnly && !hasExpDateChanges) {
      onBack();
      return;
    }
    if (!base.customerCode) {
      toast("Please select a customer before submitting.", "error");
      return;
    }
    if (products.length === 0 || !products[0].productCode) {
      toast("At least one valid product must be added.", "error");
      return;
    }

    const flows = lsLoad(ESCALATION_FLOWS_KEY, {});
    const flow = flows["Service Material"] || [];
    const step0 = flow[0] || {};
    const slaMs =
      (step0.durationHours || 2) * 3600_000 +
      (step0.durationMins || 0) * 60_000;
    const now = new Date().toISOString();
    const nowMs = Date.now();

    if (isEdit || isReadOnly) {
      const updated = {
        ...initialData,
        ...base,
        products,
        productCode: products[0].productCode,
        productDescription: products[0].productDescription,
        serialNumber: products[0].serialNumber,
        boardType: products[0].boardType,
        qty: products[0].qty,
        type: products[0].type,
        expectedDeliveryDate: products[0].expectedDeliveryDate,
        _editing: undefined,
        _readonly: undefined,
      };
      onSave(updated, true);
    } else {
      const escalationHistory = [
        {
          level: 0,
          department: base.assignedDepartment || step0.dept || "",
          engineerId: base.assignedTo,
          engineerName: base.assignedToName,
          assignedAt: now,
          deadline: new Date(nowMs + slaMs).toISOString(),
        },
      ];
      const row = {
        id: `smi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        refNo: genRef(),
        dateTime: new Date().toLocaleString(),
        timestamp: now,
        ...base,
        products,
        productCode: products[0].productCode,
        productDescription: products[0].productDescription,
        productSegment: products[0].productSegment,
        serialNumber: products[0].serialNumber,
        boardType: products[0].boardType,
        qty: products[0].qty,
        type: products[0].type,
        expectedDeliveryDate: products[0].expectedDeliveryDate,
        status: "Open",
        escalationLevel: 0,
        escalationHistory,
        currentEngineerId: "",
        qcActions: [],
      };
      onSave(row, false);
    }
    setIsDirty(false); // Reset dirty state after successful save
  };

  const handleBackClick = () => {
    if (isDirty && !isReadOnly) {
      setShowUnsavedModal(true);
    } else {
      onBack();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="w-full font-sans text-[0.85vw] max-h-[90vh] overflow-y-auto"
    >
      <AnimatePresence>
        {dupeTarget && (
          <DuplicateModal
            onConfirm={(count) => confirmDuplicate(dupeTarget, count)}
            onClose={() => setDupeTarget(null)}
          />
        )}
        {showUnsavedModal && (
          <UnsavedChangesModal
            onConfirm={() => {
              setShowUnsavedModal(false);
              onBack();
            }}
            onClose={() => setShowUnsavedModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between bg-white px-[1.2vw] py-[0.8vw] rounded-[0.6vw] shadow-sm border border-gray-300 mb-[1vw]">
        <div className="flex items-center gap-[1vw]">
          <button
            type="button"
            onClick={handleBackClick}
            className="flex items-center gap-[0.4vw] text-black/70 hover:text-black border border-gray-300 bg-gray-50 px-[0.8vw] py-[0.4vw] rounded-[0.4vw] cursor-pointer"
          >
            <ArrowLeft className="w-[1vw] h-[1vw]" />
            <span className="font-medium">Back</span>
          </button>
          <h2 className="text-[1vw] font-bold text-black">
            {isReadOnly
              ? initialData.products?.some((p) => p.expectedDeliveryDate === "")
                ? "Update Inward Entry"
                : "View Inward Entry"
              : isEdit
              ? "Edit Inward Entry"
              : "New Service Material Inward"}
          </h2>
          {isReadOnly && (
            <span className="text-[0.72vw] bg-purple-50 text-purple-600 border border-purple-200 px-[0.6vw] py-[0.2vw] rounded-full flex items-center gap-[0.3vw]">
              <Eye className="w-[0.8vw] h-[0.8vw]" />
              {initialData.products?.some((p) => p.expectedDeliveryDate === "")
                ? "Partial Edit Mode — Exp. Delivery Date"
                : "Read Only Mode"}
            </span>
          )}
          {!isReadOnly && !isEdit && products.length > 1 && (
            <span className="text-[0.72vw] bg-blue-50 text-blue-600 border border-blue-200 px-[0.6vw] py-[0.2vw] rounded-full">
              {products.length} products in this entry
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[1vw]">
        {/* Customer Information */}
        <div className="bg-white rounded-[0.6vw] shadow-sm border border-gray-300 p-[1.2vw]">
          <h3 className="text-[0.85vw] font-bold text-black uppercase tracking-wide mb-[1vw] pb-[0.5vw] border-b border-gray-300 flex items-center gap-[0.5vw]">
            <User className="w-[1vw] h-[1vw] text-blue-500" />Customer
            Information
          </h3>
          <div className="grid grid-cols-4 gap-[1.2vw]">
            {/* Row 1 */}
            <div className="flex flex-col gap-[0.3vw]">
              <label className="font-semibold text-black">Date</label>
              <input
                readOnly
                value={fmtDate(base.date)}
                className="border border-gray-300 p-[0.6vw] rounded-[0.4vw] bg-gray-100 text-black cursor-not-allowed"
              />
            </div>

            <div className="col-span-1 flex flex-col gap-[0.3vw]">
              <label className="font-semibold text-black">
                Reference No{" "}
                <span className="text-black/80 font-normal">(Customer)</span>
              </label>
              <input
                value={base.refNoCustomer}
                onChange={(e) => sb("refNoCustomer", e.target.value)}
                disabled={isReadOnly}
                placeholder="Enter customer ref no…"
                className="border border-gray-300 p-[0.6vw] rounded-[0.4vw] outline-none focus:ring-2 ring-blue-100 focus:border-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div className="col-span-1 flex flex-col gap-[0.3vw]">
              <label className="font-semibold text-black">
                Reference No{" "}
                <span className="text-black/80 font-normal">(Internal)</span>
              </label>
              <input
                value={base.refNoInternal}
                onChange={(e) => sb("refNoInternal", e.target.value)}
                disabled={isReadOnly}
                placeholder="Enter internal ref no…"
                className="border border-gray-300 p-[0.6vw] rounded-[0.4vw] outline-none focus:ring-2 ring-blue-100 focus:border-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div
              className="col-span-1 flex flex-col gap-[0.3vw] relative"
              ref={custRef}
            >
              <label className="font-semibold text-gray-800">Customer Name</label>
              <div className="relative">
                <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.9vw] h-[0.9vw] text-gray-800" />
                <input
                  value={custSearch}
                  onChange={(e) => {
                    if (!isReadOnly) {
                      setCustSearch(e.target.value);
                      sb("customerName", e.target.value);
                      sb("customerCode", "");
                      setShowCustDrop(true);
                    }
                  }}
                  onFocus={() => {
                    if (!isReadOnly) setShowCustDrop(true);
                  }}
                  disabled={isReadOnly}
                  placeholder="Search & select customer…"
                  className="w-full border border-gray-400 rounded-[0.4vw] pl-[2.2vw] p-[0.6vw] outline-none focus:border-blue-500 shadow-none text-gray-800 font-bold disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              {showCustDrop && !isReadOnly && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-300 shadow-lg rounded-[0.4vw] mt-[0.3vw] max-h-[14vw] overflow-y-auto z-30">
                  {uniqueCustomers
                    .filter((c) =>
                      c.name?.toLowerCase().includes(custSearch.toLowerCase())
                    )
                    .map((c, i) => (
                      <div
                        key={i}
                        onClick={() => selectCustomer(c)}
                        className="p-[0.6vw] hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between"
                      >
                        <div>
                          <div className="font-bold text-gray-900">{c.name}</div>
                          <div className="text-[0.7vw] text-gray-700 font-medium">{c.code}</div>
                        </div>
                        <span className="text-[0.7vw] bg-purple-100 text-purple-700 px-[0.5vw] py-[0.15vw] rounded self-center border border-purple-200">
                          {c.type}
                        </span>
                      </div>
                    ))}
                  {!uniqueCustomers.filter((c) =>
                    c.name?.toLowerCase().includes(custSearch.toLowerCase())
                  ).length && (
                    <div className="p-[1vw] text-center text-gray-700 font-medium">
                      No customers found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 2 */}
            <div className="flex flex-col gap-[0.3vw]">
              <label className="font-semibold text-black uppercase text-[0.72vw]">Customer Code</label>
              <input
                readOnly
                value={base.customerCode}
                className="border border-gray-300 p-[0.6vw] rounded-[0.4vw] bg-gray-100 text-gray-800 font-semibold cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-[0.3vw]">
              <label className="font-semibold text-black uppercase text-[0.72vw]">Category</label>
              <input
                value={base.category}
                readOnly
                onChange={(e) => sb("category", e.target.value)}
                disabled={isReadOnly}
                placeholder="e.g. OEM, End Customer…"
                className="border border-gray-400 p-[0.6vw] rounded-[0.4vw] outline-none focus:border-blue-500 shadow-none text-gray-800 font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div />
          </div>
        </div>

        {/* Product & Service Details */}
        <div className="bg-white rounded-[0.6vw] shadow-sm border border-gray-300 p-[1.2vw]">
          <div className="flex items-center justify-between mb-[1vw] pb-[0.5vw] border-b border-gray-300">
            <h3 className="text-[0.85vw] font-bold text-black uppercase tracking-wide flex items-center gap-[0.5vw]">
              <Package className="w-[1vw] h-[1vw] text-blue-500" />Product &amp;
              Service Details
              <span className="ml-[0.5vw] text-[0.7vw] bg-blue-100 text-blue-700 px-[0.5vw] py-[0.15vw] rounded-full font-semibold normal-case tracking-normal">
                {products.length} count{products.length > 1 ? "s" : ""}
              </span>
            </h3>
            {!isReadOnly && (
              <button
                type="button"
                onClick={addProduct}
                className="flex items-center gap-[0.4vw] text-[0.75vw] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-[0.8vw] py-[0.4vw] rounded-[0.4vw] cursor-pointer"
              >
                <Plus className="w-[0.85vw] h-[0.85vw]" />Add Product Row
              </button>
            )}
          </div>

          {!base.customerCode && !isReadOnly && (
            <div className="text-[0.78vw] text-black/50 bg-gray-50 border border-dashed border-gray-300 rounded-[0.4vw] p-[1vw] text-center mb-[0.8vw]">
              Select a customer above to enable product search in each row
            </div>
          )}

          <div className="mt-[0.6vw]">
            <EditableProductTable
              products={products}
              setProducts={setProducts}
              customerCode={base.customerCode}
              customerDb={custDbForRows}
              boardTypes={boardTypes}
              isReadOnly={isReadOnly}
              allowPartialEdit={isReadOnly && initialData.products?.some(p => p.expectedDeliveryDate === "")}
              onDuplicate={requestDuplicate}
              onRemove={removeProduct}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-[1vw] sticky bottom-0 bg-gray-100 py-[0.6vw] pr-[0.5vw]">
          <button
            type="button"
            onClick={handleBackClick}
            className="px-[1.5vw] py-[0.7vw] border border-gray-300 bg-white hover:bg-gray-50 text-black/90 rounded-[0.4vw] cursor-pointer flex items-center gap-[0.5vw] font-semibold"
          >
            <X className="w-[1vw] h-[1vw]" />
            {isReadOnly &&
            !products.some(
              (p) =>
                p.expectedDeliveryDate !==
                (initialData.products?.find((ip) => ip._pid === p._pid)
                  ?.expectedDeliveryDate || "")
            )
              ? "Close"
              : "Cancel"}
          </button>
          {(!isReadOnly ||
            products.some(
              (p) =>
                p.expectedDeliveryDate !==
                (initialData.products?.find((ip) => ip._pid === p._pid)
                  ?.expectedDeliveryDate || "")
            )) && (
            <button
              type="submit"
              className="px-[1.5vw] py-[0.7vw] bg-blue-600 hover:bg-blue-700 text-white rounded-[0.4vw] flex items-center gap-[0.5vw] cursor-pointer font-semibold shadow-md"
            >
              <Save className="w-[1vw] h-[1vw]" />
              {isEdit || isReadOnly ? "Update Entry" : "Register Inward"}
            </button>
          )}
        </div>
      </form>
    </motion.div>
  );
};

// Assign Cell with group support
const AssignCell = ({ row, prod, employees, onAssign, onAssignSegmentGroup, onUpdateProduct }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("single");
  const [pendingAssign, setPendingAssign] = useState(null); // { assignData, isGroup }
  const [deliveryDateInput, setDeliveryDateInput] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const serviceEngineers = useMemo(
    () =>
      employees.filter((e) =>
        ["Support Engineer", "Service Engineer"].includes(e.department)
      ),
    [employees]
  );

  const filtered = serviceEngineers.filter(
    (e) =>
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.userId?.toLowerCase().includes(search.toLowerCase())
  );

  const sameSegmentProducts = useMemo(() => {
    if (!prod.productSegment) return [];
    return (row.products || []).filter(
      (p) =>
        p._pid !== prod._pid &&
        p.productSegment === prod.productSegment &&
        !p.assignedTo
    );
  }, [row.products, prod]);

  const isAssigned = !!prod.assignedTo;
  const hasGroupCandidates =
    sameSegmentProducts.length > 0 && !!prod.productSegment;

  return (
    <div className="relative" ref={ref}>
      {isAssigned ? (
        <div className="flex items-start justify-center gap-[0.5vw] w-full">
          <Avatar name={prod.assignedToName} size="sm" />
          <div>
            <span className="text-[0.72vw] text-black font-semibold leading-tight block">
              {prod.assignedToName}
            </span>
            {prod.productSegment && (
              <span className="text-[0.6vw] text-blue-500 font-medium">
                {prod.productSegment}
              </span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center gap-[0.35vw] px-[0.65vw] py-[0.3vw] border border-dashed border-gray-400 rounded-[0.4vw] text-[0.7vw] text-black hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all mx-auto w-max"
        >
          <Plus className="w-[0.72vw] h-[0.72vw]" />Assign
          {hasGroupCandidates && (
            <span className="ml-[0.2vw] bg-blue-100 text-blue-600 rounded text-[0.58vw] px-[0.3vw] font-bold">
              +{sameSegmentProducts.length} seg
            </span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-full left-0 mt-[0.3vw] bg-white border border-gray-300 shadow-xl rounded-[0.5vw] z-40 w-[20vw]"
          >
            {hasGroupCandidates && (
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setTab("single")}
                  className={`flex-1 py-[0.45vw] text-[0.7vw] font-semibold transition-colors cursor-pointer ${
                    tab === "single"
                      ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                      : "text-black/60 hover:bg-gray-50"
                  }`}
                >
                  Assign Single
                </button>
                <button
                  type="button"
                  onClick={() => setTab("group")}
                  className={`flex-1 py-[0.45vw] text-[0.7vw] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-[0.3vw] ${
                    tab === "group"
                      ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                      : "text-black/60 hover:bg-gray-50"
                  }`}
                >
                  Assign Segment Group
                  <span className="bg-blue-100 text-blue-700 text-[0.58vw] px-[0.3vw] rounded font-bold">
                    {sameSegmentProducts.length + 1}
                  </span>
                </button>
              </div>
            )}

            {tab === "group" && hasGroupCandidates && (
              <div className="px-[0.7vw] py-[0.4vw] bg-blue-50 border-b border-blue-100 text-[0.68vw] text-blue-700 font-medium flex items-center gap-[0.4vw]">
                <Shield className="w-[0.8vw] h-[0.8vw]" />
                Segment: <strong>{prod.productSegment}</strong> — will assign{" "}
                {sameSegmentProducts.length + 1} products
              </div>
            )}

            <div className="p-[0.55vw] border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-[0.5vw] top-1/2 -translate-y-1/2 w-[0.8vw] h-[0.8vw] text-black/50" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search engineer…"
                  className="w-full pl-[1.8vw] pr-[0.5vw] py-[0.4vw] border border-gray-300 rounded-[0.3vw] text-[0.72vw] outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="max-h-[12vw] overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((eng, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const assignData = {
                        assignedTo: eng.userId,
                        assignedToName: eng.name,
                        assignedDepartment: eng.department,
                      };
                      if (!prod.expectedDeliveryDate) {
                        setPendingAssign({ assignData, isGroup: tab === "group" && hasGroupCandidates });
                        setDeliveryDateInput("");
                        setOpen(false);
                        setSearch("");
                        return;
                      }
                      if (tab === "group" && hasGroupCandidates) {
                        onAssignSegmentGroup(
                          row.id,
                          prod._pid,
                          sameSegmentProducts.map((p) => p._pid),
                          assignData
                        );
                      } else {
                        onAssign(row.id, prod._pid, assignData);
                      }
                      setOpen(false);
                      setSearch("");
                    }}
                    className="flex items-center gap-[0.6vw] p-[0.55vw] hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    <Avatar name={eng.name} size="sm" />
                    <div className="flex-1">
                      <div className="font-medium text-black/90 text-[0.75vw]">
                        {eng.name}
                      </div>
                      <div className="text-[0.62vw] text-black/50">
                        {eng.department}
                      </div>
                    </div>
                    {tab === "group" && hasGroupCandidates && (
                      <span className="text-[0.6vw] bg-green-100 text-green-700 px-[0.35vw] py-[0.1vw] rounded font-bold">
                        ×{sameSegmentProducts.length + 1}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-[1vw] text-center text-[0.72vw] text-black/50">
                  No engineers found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expected Delivery Date prompt modal */}
      <AnimatePresence>
        {pendingAssign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[0.8vw] shadow-2xl border border-gray-300 p-[1.8vw] w-[26vw]"
            >
              <div className="flex items-center gap-[0.6vw] mb-[1.2vw]">
                <div className="w-[2.2vw] h-[2.2vw] rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertCircle className="w-[1.1vw] h-[1.1vw] text-orange-600" />
                </div>
                <div>
                  <div className="text-[0.9vw] font-bold text-black">Expected Delivery Date Required</div>
                  <div className="text-[0.72vw] text-black/70">
                    Please set an expected delivery date before assigning.
                  </div>
                </div>
              </div>
              <div className="mb-[1.2vw]">
                <label className="text-[0.72vw] font-semibold text-black/80 block mb-[0.4vw]">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={deliveryDateInput}
                  onChange={(e) => setDeliveryDateInput(e.target.value)}
                  min={todayDateStr()}
                  className="w-full border border-gray-300 rounded-[0.4vw] px-[0.6vw] py-[0.5vw] text-[0.8vw] outline-none focus:border-blue-400 text-black"
                />
              </div>
              <div className="flex gap-[0.6vw] justify-end">
                <button
                  type="button"
                  onClick={() => { setPendingAssign(null); setDeliveryDateInput(""); }}
                  className="px-[1.2vw] py-[0.55vw] border border-gray-300 rounded-[0.4vw] text-[0.78vw] text-black/80 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!deliveryDateInput}
                  onClick={() => {
                    if (!deliveryDateInput) return;
                    // Save the expected delivery date on the product first
                    onUpdateProduct(row.id, prod._pid, { expectedDeliveryDate: deliveryDateInput });
                    // Then perform the assignment
                    if (pendingAssign.isGroup) {
                      onAssignSegmentGroup(
                        row.id,
                        prod._pid,
                        sameSegmentProducts.map((p) => p._pid),
                        pendingAssign.assignData
                      );
                    } else {
                      onAssign(row.id, prod._pid, pendingAssign.assignData);
                    }
                    setPendingAssign(null);
                    setDeliveryDateInput("");
                  }}
                  className="px-[1.4vw] py-[0.55vw] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-[0.4vw] text-[0.78vw] font-semibold cursor-pointer flex items-center gap-[0.4vw]"
                >
                  <User className="w-[0.85vw] h-[0.85vw]" />Confirm & Assign
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
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
      if (historyRef.current && !historyRef.current.contains(e.target))
        setShowHistory(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setStatus(prod.finalStatus || "Pending");
    setRemarks(prod.finalStatusRemarks || "");
    setStatusDate(prod.finalStatusDate || todayDateStr());
  }, [prod.finalStatus, prod.finalStatusRemarks, prod.finalStatusDate]);

  const handleSave = () => {
    const newHistoryEntry = {
      status,
      remarks,
      date: statusDate,
      timestamp: new Date().toISOString(),
    };
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
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`text-[0.68vw] px-[0.5vw] py-[0.2vw] rounded-full border font-semibold flex items-center gap-[0.3vw] cursor-pointer ${cls}`}
        >
          {status}
          <ChevronDown className="w-[0.7vw] h-[0.7vw]" />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-full right-0 mt-[0.3vw] bg-white border border-gray-300 shadow-xl rounded-[0.5vw] z-40 w-[17vw] p-[0.8vw]"
            >
              <div className="text-[0.72vw] font-semibold text-black/80 mb-[0.5vw]">
                Final Status
              </div>
              <div className="grid grid-cols-2 gap-[0.35vw] mb-[0.7vw]">
                {FINAL_STATUS_OPTIONS.map((opt) => {
                  const optCls = FINAL_STATUS_COLORS[opt];
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setStatus(opt)}
                      className={`py-[0.3vw] rounded-[0.3vw] border text-[0.66vw] font-semibold cursor-pointer transition-all truncate px-[0.3vw] ${
                        status === opt
                          ? optCls + " ring-2 ring-offset-1 ring-blue-300"
                          : "bg-gray-50 text-black/70 border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div className="mb-[0.6vw]">
                <label className="text-[0.65vw] font-semibold text-black/70 block mb-[0.25vw]">
                  Status Date
                </label>
                <input
                  type="date"
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-[0.3vw] px-[0.4vw] py-[0.35vw] text-[0.72vw] outline-none focus:border-blue-400 text-black"
                />
              </div>

              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add remarks…"
                className="w-full border border-gray-300 rounded-[0.3vw] p-[0.4vw] text-[0.72vw] outline-none focus:border-blue-400 resize-none mb-[0.6vw] text-black"
              />

              <div className="flex justify-end gap-[0.4vw]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-[0.8vw] py-[0.3vw] text-[0.68vw] border border-gray-300 rounded-[0.3vw] text-black/80 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-[0.8vw] py-[0.3vw] text-[0.68vw] bg-blue-600 text-white rounded-[0.3vw] hover:bg-blue-700 cursor-pointer font-semibold flex items-center gap-[0.3vw]"
                >
                  <Save className="w-[0.7vw] h-[0.7vw]" />Save
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative" ref={historyRef}>
        <button
          type="button"
          onClick={() => setShowHistory((s) => !s)}
          title="View History"
          className="p-[0.3vw] text-black/50 hover:text-blue-600 hover:bg-blue-50 rounded-[0.3vw] transition-colors cursor-pointer"
        >
          <Clock className="w-[0.9vw] h-[0.9vw]" />
        </button>
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-full right-0 mt-[0.3vw] bg-white border border-gray-300 shadow-2xl rounded-[0.5vw] z-40 w-[22vw] p-[1vw]"
            >
              <div className="flex items-center justify-between mb-[0.8vw] pb-[0.4vw] border-b border-gray-300">
                <div className="text-[0.8vw] font-bold text-black flex items-center gap-[0.4vw]">
                  <Clock className="w-[0.9vw] h-[0.9vw] text-blue-500" />Status
                  History
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-black/40 hover:text-black"
                >
                  <X className="w-[0.8vw] h-[0.8vw]" />
                </button>
              </div>
              <div className="max-h-[15vw] overflow-y-auto space-y-[0.6vw] pr-[0.3vw]">
                {(prod.finalStatusHistory || []).length > 0 ? (
                  [...(prod.finalStatusHistory || [])]
                    .reverse()
                    .map((h, i) => (
                      <div
                        key={i}
                        className="bg-gray-50/50 rounded-[0.4vw] p-[0.6vw] border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-[0.2vw]">
                          <span
                            className={`text-[0.65vw] px-[0.4vw] py-[0.05vw] rounded-full font-bold border ${
                              FINAL_STATUS_COLORS[h.status] ||
                              "bg-gray-100 text-black/80"
                            }`}
                          >
                            {h.status}
                          </span>
                          <div className="text-right">
                            {h.date && (
                              <div className="text-[0.62vw] font-bold text-blue-600">
                                {fmtDate(h.date)}
                              </div>
                            )}
                            <div className="text-[0.6vw] text-black/50 font-medium">
                              {fmtDate(h.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="text-[0.72vw] text-black/90 italic leading-tight">
                          "
                          {h.remarks || (
                            <span className="text-black/30">No remarks</span>
                          )}
                          "
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="py-[2vw] text-center">
                    <div className="text-[0.72vw] text-black/40">
                      No history available yet.
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Table
const PRODUCT_SUB_COLS = ["Product", "Serial No", "Exp. Delivery"];

const getProductDelay = (row, prod) => {
  // Only calculate delay when product has been delivered
  if (prod.finalStatus !== "Delivered") return "—";

  const expectedDate = prod.expectedDeliveryDate || "";
  const deliveryDate = prod.finalStatusDate || "";

  if (!expectedDate || !deliveryDate) return "—";

  const expected = new Date(expectedDate);
  const delivered = new Date(deliveryDate);
  if (Number.isNaN(expected.getTime()) || Number.isNaN(delivered.getTime())) return "—";

  // Reset time parts for pure date diff
  expected.setHours(0, 0, 0, 0);
  delivered.setHours(0, 0, 0, 0);

  const diffDays = Math.round((delivered - expected) / 86400000);

  if (diffDays === 0) return <span className="text-green-600 font-semibold">On time</span>;
  if (diffDays < 0)
    return (
      <span className="text-green-600 font-semibold">
        {Math.abs(diffDays)} day{Math.abs(diffDays) === 1 ? "" : "s"} early
      </span>
    );
  return (
    <span className="text-red-600 font-semibold">
      {diffDays} day{diffDays === 1 ? "" : "s"} late
    </span>
  );
};

const AdminTableView = ({
  employees,
  onView,
  onEdit,
  onUpdateRow,
  onUpdateProduct,
  onDelete,
  selectedItems,
  onToggleSelect,
  onToggleSelectPage,
  currentPage,
  setCurrentPage,
  filteredData,
  paginatedData,
  totalPages,
  isPageSelected,
}) => (
  <div className="bg-white rounded-[0.6vw] shadow-sm border border-gray-300 flex flex-col">
    <div className="overflow-auto max-h-[65vh] min-h-[65vh] w-full rounded-t-[0.6vw]">
      <table className="w-full text-left border-collapse">
        <thead className="bg-blue-50 sticky top-0 z-10">
          <tr>
            <th
              rowSpan={2}
              className="p-[0.6vw] border-b-2 border-r border-gray-300 text-center align-middle w-[3%] bg-blue-50"
            >
              <button
                type="button"
                onClick={onToggleSelectPage}
                className="flex items-center justify-center w-full cursor-pointer"
              >
                {isPageSelected ? (
                  <CheckSquare className="w-[1.1vw] h-[1.1vw] text-blue-600" />
                ) : (
                  <Square className="w-[1.1vw] h-[1.1vw] text-gray-700" />
                )}
              </button>
            </th>
            {["S.No", "Date", "Customer Name", "Category"].map((h) => {
              const minW = h === "Customer Name" ? "200px" : "100px";
              return (
                <th
                  key={h}
                  rowSpan={2}
                  style={{ minWidth: minW }}
                  className="px-[0.6vw] py-[0.5vw] font-bold text-black text-center border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.78vw] align-middle bg-blue-50"
                >
                  {h}
                </th>
              );
            })}
            <th
              colSpan={PRODUCT_SUB_COLS.length}
              className="px-[0.6vw] py-[0.4vw] font-bold text-black border-b border-r border-gray-300 text-center text-[0.78vw] bg-blue-100"
            >
              Products
            </th>
            {["Edit", "Reports", "Final Status", "Remarks", "Delay"].map((h) => {
              const minW = h === "Remarks" ? "180px" : (h === "Final Status" ? "140px" : "100px");
              return (
                <th
                  key={h}
                  rowSpan={2}
                  style={{ minWidth: minW }}
                  className="px-[0.6vw] py-[0.5vw] font-bold text-black text-center border-b-2 border-r border-gray-300 last:border-r-0 whitespace-nowrap text-[0.78vw] align-middle bg-blue-50"
                >
                  {h}
                </th>
              );
            })}
          </tr>
          <tr>
            {PRODUCT_SUB_COLS.map((h, i) => {
              const minW = h === "Product" ? "220px" : "140px";
              return (
                <th
                  key={h}
                  style={{ minWidth: minW }}
                  className={`px-[0.6vw] py-[0.4vw] font-bold text-black text-center border-b-2 border-r border-gray-300 whitespace-nowrap text-[0.72vw] bg-blue-50 ${
                    i === PRODUCT_SUB_COLS.length - 1
                      ? "border-r border-gray-300"
                      : ""
                  }`}
                >
                  {h}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {paginatedData.length > 0 ? (
            paginatedData.flatMap((row, i) => {
              const sn = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
              const isSelected = selectedItems.has(row.id);

              const prods =
                row.products && row.products.length > 0
                  ? row.products
                  : [
                      {
                        _pid: "legacy",
                        productDescription: row.productDescription,
                        productCode: row.productCode,
                        serialNumber: row.serialNumber,
                        type: row.type,
                        qty: row.qty,
                        expectedDeliveryDate: row.expectedDeliveryDate,
                        assignedTo: row.assignedTo || "",
                        assignedToName: row.assignedToName || "",
                        assignedDepartment: row.assignedDepartment || "",
                      },
                    ];

              const span = prods.length;
              const bgCls = isSelected ? "bg-blue-50" : "";

              return prods.map((prod, pi) => (
                <tr
                  key={`${row.id}-${pi}`}
                  className={`transition-colors hover:bg-gray-50/60 ${bgCls} ${
                    pi > 0
                      ? "border-t border-dashed border-gray-300"
                      : "border-t border-gray-300"
                  }`}
                >
                  {pi === 0 && (
                    <>
                      <td
                        rowSpan={span}
                        className="p-[0.7vw] border-r border-gray-300 text-center align-middle"
                      >
                        <button
                          type="button"
                          onClick={() => onToggleSelect(row.id)}
                          className="flex items-center justify-center w-full cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-[1.1vw] h-[1.1vw] text-blue-600" />
                          ) : (
                            <Square className="w-[1.1vw] h-[1.1vw] text-gray-700 hover:text-black" />
                          )}
                        </button>
                      </td>
                      <td
                        rowSpan={span}
                        className="p-[0.7vw] border-r border-gray-300 text-black/80 font-medium text-center text-[0.78vw] align-middle"
                      >
                        {sn}
                      </td>
                      <td
                        rowSpan={span}
                        className="p-[0.7vw] border-r border-gray-300 text-black text-[0.72vw] whitespace-nowrap align-middle text-center"
                      >
                        {fmtDate(row.date || row.timestamp)}
                      </td>
                      <td
                        rowSpan={span}
                        className="p-[0.7vw] border-r border-gray-300 align-middle text-center"
                      >
                        <div
                          className="font-semibold text-black text-[0.75vw] max-w-[9vw] break-words mx-auto text-center"
                          title={row.customerName}
                        >
                          {row.customerName || "—"}
                        </div>
                      </td>
                      <td
                        rowSpan={span}
                        className="p-[0.7vw] border-r border-gray-300 align-middle text-center"
                      >
                        <div className="text-[0.65vw] text-gray-800 font-bold mx-auto text-center break-words">
                          {row.category || "—"}
                        </div>
                      </td>
                    </>
                  )}

                  {/* Product sub-cols */}
                  <td className="px-[0.65vw] py-[0.6vw] border-r border-gray-300 align-middle text-center">
                    <div className="flex flex-col items-center gap-[0.3vw]">
                      <div
                        className="font-medium text-black text-[0.75vw] max-w-[10vw] break-words mx-auto text-center"
                        title={prod.productDescription}
                      >
                        {prod.productDescription || "—"}
                      </div>
                      {prod.report?.status === "Completed" && (
                        <span className="inline-flex items-center gap-[0.25vw] rounded-[0.35vw] bg-green-100 text-green-700 px-[0.45vw] py-[0.3vw] text-[0.62vw] font-semibold flex-shrink-0 w-max mx-auto">
                          <span className="w-[0.5vw] h-[0.5vw] rounded-full bg-green-600" />
                          Completed by emp
                        </span>
                      )}
                    </div>
                    {prod.productCode && (
                      <div className="text-[0.62vw] text-black mt-[0.1vw] mx-auto text-center">
                        {prod.productCode}
                      </div>
                    )}
                    {prod.productSegment && (
                      <div className="text-[0.6vw] text-blue-500 font-medium mt-[0.05vw] mx-auto text-center">
                        {prod.productSegment}
                      </div>
                    )}
                  </td>

                  <td className="px-[0.65vw] py-[0.6vw] border-r border-gray-300 text-[0.7vw] text-black font-semibold align-middle text-center">
                    {prod.serialNumber || (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>

                  <td className="px-[0.65vw] py-[0.6vw] border-r border-gray-300 text-[0.7vw] text-black font-semibold whitespace-nowrap align-middle text-center">
                    {fmtDate(prod.expectedDeliveryDate)}
                  </td>

                  {pi === 0 && (
                    <>
                      <td
                        rowSpan={span}
                        className="px-[0.65vw] py-[0.6vw] border-r border-gray-300 text-center align-middle"
                      >
                        <div className="flex flex-col items-center gap-[0.4vw]">
                          {row.products?.some((p) => !!p.assignedTo) ? (
                            <button
                              type="button"
                              onClick={() => onView(row)}
                              title="View"
                              className="text-purple-400 hover:text-purple-600 cursor-pointer p-[0.3vw] rounded-[0.3vw] hover:bg-purple-50 transition-colors flex flex-col items-center gap-[0.1vw] mx-auto"
                            >
                              <Eye className="w-[0.95vw] h-[0.95vw]" />
                              <span className="text-[0.55vw] leading-none">
                                View
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onEdit(row)}
                              title="Edit"
                              className="text-gray-800 hover:text-blue-600 cursor-pointer p-[0.3vw] rounded-[0.3vw] hover:bg-blue-50 transition-colors mx-auto block"
                            >
                              <Edit3 className="w-[0.95vw] h-[0.95vw]" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDelete(row.id)}
                            title="Delete"
                            className="text-red-400 hover:text-red-600 cursor-pointer p-[0.3vw] rounded-[0.3vw] hover:bg-red-50 transition-colors mx-auto block"
                          >
                            <Trash2 className="w-[0.95vw] h-[0.95vw]" />
                          </button>
                        </div>
                      </td>

                      <td
                        rowSpan={span}
                        className="px-[0.65vw] py-[0.6vw] border-r border-gray-300 align-middle text-center"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRow(row.id, { _openReports: true })
                          }
                          className="text-[0.65vw] px-[0.5vw] py-[0.2vw] bg-gray-100 hover:bg-blue-100 text-black hover:text-blue-700 border border-black/20 hover:border-blue-300 rounded-[0.3vw] cursor-pointer font-semibold transition-all"
                        >
                          View Reports
                        </button>
                      </td>
                    </>
                  )}

                  <td className="px-[0.65vw] py-[0.6vw] border-r border-gray-300 align-middle text-center">
                    <FinalStatusCell row={row} prod={prod} onUpdateProduct={onUpdateProduct} />
                  </td>

                  <td className="px-[0.65vw] py-[0.6vw] align-middle text-center">
                    <div
                      className="text-[0.7vw] text-black font-medium max-w-[10vw] break-words mx-auto text-center"
                      title={prod.finalStatusRemarks}
                    >
                      {prod.finalStatusRemarks || (
                        <span className="text-gray-700 font-bold">—</span>
                      )}
                    </div>
                    {prod.finalStatusDate && (
                      <div className="text-[0.6vw] text-blue-500 font-medium mt-[0.1vw] mx-auto text-center">
                        {fmtDate(prod.finalStatusDate)}
                      </div>
                    )}
                  </td>

                  <td className="px-[0.65vw] py-[0.6vw] border-l border-r border-gray-300 text-[0.7vw] text-gray-800 font-bold align-middle text-center">
                    {getProductDelay(row, prod)}
                  </td>
                </tr>
              ));
            })
          ) : (
            <tr>
              <td
                colSpan={5 + PRODUCT_SUB_COLS.length + 5}
                className="py-[4vw] text-center text-black/50 text-[0.85vw]"
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Pagination */}
    <div className="border-t border-blue-100 p-[0.6vw] bg-blue-50 flex justify-between items-center rounded-b-[0.6vw]">
      <div className="text-[0.8vw] text-black/70">
        Showing{" "}
        <strong>
          {paginatedData.length > 0
            ? (currentPage - 1) * ITEMS_PER_PAGE + 1
            : 0}
        </strong>{" "}
        to{" "}
        <strong>
          {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}
        </strong>{" "}
        of <strong>{filteredData.length}</strong> entries
      </div>
      <div className="flex items-center gap-[1.2vw]">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="p-[0.4vw] border border-gray-300 rounded-[0.3vw] hover:bg-white disabled:opacity-50 bg-white shadow-sm cursor-pointer"
        >
          <ChevronLeft className="w-[1vw] h-[1vw] text-black/80" />
        </button>
        <div className="flex gap-[0.7vw]">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pNum = i + 1;
            if (totalPages > 5 && currentPage > 3) pNum = currentPage - 2 + i;
            if (pNum > totalPages) return null;
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => setCurrentPage(pNum)}
                className={`w-[1.8vw] h-[1.8vw] flex items-center justify-center rounded-[0.3vw] text-[0.8vw] font-medium cursor-pointer ${
                  currentPage === pNum
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-300 text-black/80 hover:bg-gray-50"
                }`}
              >
                {pNum}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages || totalPages === 0}
          className="p-[0.4vw] border border-gray-300 rounded-[0.3vw] hover:bg-white disabled:opacity-50 bg-white shadow-sm cursor-pointer"
        >
          <ChevronRight className="w-[1vw] h-[1vw] text-black/80" />
        </button>
      </div>
    </div>
  </div>
);

// Status chip config
const STATUS_CHIPS = [
  {
    label: "All",
    activeColor: "bg-gray-700 text-white border-gray-700",
    inactiveColor: "bg-gray-100 text-black/90 border-gray-300 hover:bg-gray-200",
    dot: "bg-gray-400",
    activeDot: "bg-white",
  },
  {
    label: "Pending",
    activeColor: "bg-orange-500 text-white border-orange-500",
    inactiveColor: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    dot: "bg-orange-500",
    activeDot: "bg-white",
  },
  {
    label: "Delivered",
    activeColor: "bg-green-600 text-white border-green-600",
    inactiveColor: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
    dot: "bg-green-500",
    activeDot: "bg-white",
  },
  {
    label: "Hold",
    activeColor: "bg-red-600 text-white border-red-600",
    inactiveColor: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
    dot: "bg-red-500",
    activeDot: "bg-white",
  },
  {
    label: "Not Repairable",
    activeColor: "bg-gray-600 text-white border-gray-600",
    inactiveColor: "bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300",
    dot: "bg-gray-500",
    activeDot: "bg-white",
  },
];

// Main Export
export default function App() {
  const { toast, confirm } = useNotification();
  const [view, setView] = useState("table");
  const [editingRow, setEditing] = useState(null);
  const [entries, setEntries] = useState([]);
  const [customerDb, setCustomerDb] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [boardTypes, setBoardTypes] = useState([]);
  const [reportsRowId, setReportsRowId] = useState(null);
  const [isBoardTypeMasterOpen, setIsBoardTypeMasterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const materialRes = await axios.get(`${API_URL}/service-material`).catch(() => ({ data: lsLoad(INWARD_KEY, []) }));
        const customerRes = await axios.get(`${API_URL}/master/customers`).catch(() => ({ data: [] }));
        const boardRes = await axios.get(`${API_URL}/master/board-types`).catch(() => ({ data: [] }));

        // Map backend _id to id for frontend compatibility (only for real API responses)
        const mappedEntries = materialRes.data.map(item => ({
          ...item,
          id: item._id || item.id
        }));
        
        setEntries(mappedEntries);
        setCustomerDb(customerRes.data);
        setBoardTypes(boardRes.data);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
      setEmployees(lsLoad(EMPLOYEES_KEY, []));
    };
    fetchData();
  }, []);

  const save = (rows) => {
    setEntries(rows);
    lsSave(INWARD_KEY, rows);
  };
  const goToForm = () => {
    setEditing(null);
    setView("form");
  };
  const goToEdit = (row) => {
    setEditing({ ...row, _editing: true });
    setView("form");
  };
  const goToView = (row) => {
    setEditing({ ...row, _readonly: true });
    setView("form");
  };
  const goToTable = () => {
    setEditing(null);
    setView("table");
  };

  const handleSave = async (formRow, isEditMode) => {
    try {
      if (isEditMode) {
        const res = await axios.put(`${API_URL}/service-material/${formRow.id}`, formRow);
        const updatedRow = { ...res.data, id: res.data._id };
        setEntries(entries.map((r) => (r.id === formRow.id ? updatedRow : r)));
      } else {
        const res = await axios.post(`${API_URL}/service-material`, formRow);
        const newRow = { ...res.data, id: res.data._id };
        setEntries([newRow, ...entries]);
      }
      setView("table");
      toast(
        isEditMode
          ? "Entry updated successfully."
          : "Inward registered successfully.",
        "success"
      );
    } catch (err) {
      toast("Failed to save entry: " + (err.response?.data?.message || err.message), "error");
    }
  };

  const handleUpdateRow = async (id, updates) => {
    if (updates._openReports) {
      setReportsRowId(id);
      return;
    }
    try {
      const res = await axios.put(`${API_URL}/service-material/${id}`, updates);
      const updatedRow = { ...res.data, id: res.data._id };
      setEntries(entries.map((r) => (r.id === id ? updatedRow : r)));
    } catch (err) {
      toast("Failed to update entry", "error");
    }
  };

  const handleUpdateProduct = async (id, productId, updates) => {
    const entry = entries.find(r => r.id === id);
    if (!entry) return;

    const updatedProducts = (entry.products || []).map((p) =>
      p._pid === productId ? { ...p, ...updates } : p
    );

    try {
      const res = await axios.put(`${API_URL}/service-material/${id}`, { products: updatedProducts });
      const updatedRow = { ...res.data, id: res.data._id };
      setEntries(entries.map((r) => (r.id === id ? updatedRow : r)));
    } catch (err) {
      toast("Failed to update product", "error");
    }
  };

  const handleAssign = async (id, productId, assignData) => {
    try {
      const res = await axios.patch(`${API_URL}/service-material/${id}/claim-product`, {
        productId,
        userId: assignData.assignedTo,
        userName: assignData.assignedToName
      });
      const updatedRow = { ...res.data, id: res.data._id };
      setEntries(entries.map((r) => (r.id === id ? updatedRow : r)));
      toast(`Product assigned to ${assignData.assignedToName}`, "success");
    } catch (err) {
      toast("Failed to assign product", "error");
    }
  };

  const handleAssignSegmentGroup = async (id, mainPid, otherPids, assignData) => {
    const allPids = new Set([mainPid, ...otherPids]);
    const entry = entries.find(r => r.id === id);
    if (!entry) return;

    const updatedProducts = (entry.products || []).map((p) =>
      allPids.has(p._pid)
        ? { ...p, ...assignData, status: "Assigned" }
        : p
    );

    try {
      const res = await axios.put(`${API_URL}/service-material/${id}`, { products: updatedProducts });
      const updatedRow = { ...res.data, id: res.data._id };
      setEntries(entries.map((r) => (r.id === id ? updatedRow : r)));
      toast(
        `${allPids.size} products in segment assigned to ${assignData.assignedToName}`,
        "success"
      );
    } catch (err) {
      toast("Failed to assign products group", "error");
    }
  };

  // Filter by search term AND active status chip
  const filteredData = useMemo(() => {
    let data = entries;

    // Apply status filter
    if (activeFilter !== "All") {
      data = data.filter((row) => (row.finalStatus || "Pending") === activeFilter);
    }

    // Apply search filter
    const s = searchTerm.toLowerCase();
    if (s) {
      data = data.filter(
        (row) =>
          row.refNo?.toLowerCase().includes(s) ||
          row.customerName?.toLowerCase().includes(s) ||
          row.productDescription?.toLowerCase().includes(s) ||
          row.assignedToName?.toLowerCase().includes(s) ||
          row.refNoCustomer?.toLowerCase().includes(s) ||
          row.refNoInternal?.toLowerCase().includes(s) ||
          row.products?.some((p) =>
            p.productDescription?.toLowerCase().includes(s)
          )
      );
    }

    return data;
  }, [entries, searchTerm, activeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const isPageSelected =
    paginatedData.length > 0 && paginatedData.every((r) => selectedItems.has(r.id));

  const toggleSelect = (id) => {
    const s = new Set(selectedItems);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedItems(s);
  };
  const toggleSelectPage = () => {
    const s = new Set(selectedItems);
    if (isPageSelected) paginatedData.forEach((r) => s.delete(r.id));
    else paginatedData.forEach((r) => s.add(r.id));
    setSelectedItems(s);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    const confirmed = await confirm({
      title: "Delete Entries",
      message: `Are you sure you want to delete ${selectedItems.size} selected entries? This action cannot be undone.`,
      confirmText: `Yes, Delete ${selectedItems.size} Entries`,
      type: "danger",
    });
    if (confirmed) {
      save(entries.filter((e) => !selectedItems.has(e.id)));
      setSelectedItems(new Set());
      toast(`${selectedItems.size} entries deleted successfully`);
    }
  };

  const handleDeleteRow = async (id) => {
    const confirmed = await confirm({
      title: "Delete Entry",
      message: "Are you sure you want to delete this entry? This action cannot be undone.",
      confirmText: "Yes, Delete",
      type: "danger",
    });
    if (confirmed) {
      try {
        await axios.delete(`${API_URL}/service-material/${id}`);
        setEntries(entries.filter((e) => e.id !== id));
        toast("Entry deleted successfully", "success");
      } catch (err) {
        toast("Failed to delete entry", "error");
      }
    }
  };

  const counts = useMemo(() => {
    const c = { All: entries.length };
    FINAL_STATUS_OPTIONS.forEach((s) => {
      c[s] = entries.filter((e) => (e.finalStatus || "Pending") === s).length;
    });
    return c;
  }, [entries]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-[10vw] gap-[1.5vw]">
      <div className="w-[3vw] h-[3vw] border-[0.35vw] border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      <div className="text-blue-600 font-bold text-[1vw] uppercase tracking-widest animate-pulse">Loading Service Data...</div>
    </div>
  );

  return (
    <div className="w-full h-full font-sans text-[0.85vw]">
      <AnimatePresence>
        {reportsRowId && (
          <ReportsModal
            row={entries.find((r) => r.id === reportsRowId)}
            onClose={() => setReportsRowId(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isBoardTypeMasterOpen && (
          <BoardTypeMasterModal
            onClose={() => {
               setIsBoardTypeMasterOpen(false);
               axios.get(`${API_URL}/master/board-types`).then(r => setBoardTypes(r.data));
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {view === "form" ? (
          <InwardForm
            key="form"
            initialData={editingRow || { ...emptyBase() }}
            customerDb={customerDb}
            employees={employees}
            boardTypes={boardTypes}
            onSave={handleSave}
            onBack={goToTable}
          />
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between bg-white p-[0.7vw] rounded-[0.6vw] shadow-sm border border-gray-300 mb-[0.9vw]">
              <div className="relative w-[30vw]">
                <Search className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 text-gray-800 w-[1vw] h-[1vw]" />
                <input
                  type="text"
                  placeholder="Search by ref, customer, product…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-[2.5vw] pr-[1vw] h-[2.5vw] border border-gray-400 rounded-[0.8vw] focus:outline-none focus:border-blue-500 shadow-none text-gray-800 font-bold"
                />
              </div>
              <div className="flex gap-[0.8vw] items-center">
                <AnimatePresence>
                  {selectedItems.size > 0 && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={handleBulkDelete}
                      className="flex items-center gap-[0.5vw] bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-[1vw] h-[2.4vw] rounded-[0.4vw] font-semibold"
                    >
                      <Trash2 className="w-[1vw] h-[1vw]" />Delete (
                      {selectedItems.size})
                    </motion.button>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={() => setIsBoardTypeMasterOpen(true)}
                  className="cursor-pointer flex items-center gap-[0.5vw] bg-white border border-gray-300 hover:bg-blue-50 text-blue-700 font-semibold px-[1vw] h-[2.4vw] rounded-[0.4vw] transition-colors"
                >
                  <Wrench className="w-[1vw] h-[1vw]" /> Board Types Master
                </button>
                <button
                  type="button"
                  onClick={goToForm}
                  className="cursor-pointer flex items-center gap-[0.5vw] bg-white border border-gray-300 hover:bg-gray-50 text-black/90 px-[1vw] h-[2.4vw] rounded-[0.4vw]"
                >
                  <Plus className="w-[1.2vw] h-[1.2vw]" />Add
                </button>
              </div>
            </div>

            {/* Status chips — clickable filter */}
            <div className="flex gap-[1vw] mb-[0.9vw] flex-wrap">
              {STATUS_CHIPS.map(({ label, activeColor, inactiveColor, dot, activeDot }) => {
                const isActive = activeFilter === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveFilter(label)}
                    className={`flex items-center gap-[0.5vw] px-[1vw] py-[0.55vw] rounded-[0.5vw] border font-medium text-[0.8vw] cursor-pointer transition-all duration-150 select-none ${
                      isActive ? activeColor : inactiveColor
                    } ${isActive ? "ring-2 ring-offset-1 ring-blue-300/60 scale-[1.03]" : ""}`}
                  >
                    <span
                      className={`w-[0.6vw] h-[0.6vw] rounded-full flex-shrink-0 ${
                        isActive ? activeDot : dot
                      }`}
                    />
                    {label}{" "}
                    <span className="font-bold">{counts[label] ?? 0}</span>
                  </button>
                );
              })}
            </div>

            <AdminTableView
              employees={employees}
              onView={goToView}
              onEdit={goToEdit}
              onUpdateRow={handleUpdateRow}
              onUpdateProduct={handleUpdateProduct}
              onDelete={handleDeleteRow}
              selectedItems={selectedItems}
              onToggleSelect={toggleSelect}
              onToggleSelectPage={toggleSelectPage}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              filteredData={filteredData}
              paginatedData={paginatedData}
              totalPages={totalPages}
              isPageSelected={isPageSelected}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}