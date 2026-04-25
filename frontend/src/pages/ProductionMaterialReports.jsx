// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import {
  FileText, Download, Filter, Search, ChevronLeft, ChevronRight, TrendingDown,
  AlertCircle, CheckCircle2, Clock, PieChart as PieIcon, BarChart2,
  Target, Wrench, ShieldCheck, Calendar, Activity, Layers,
  SearchCode, ClipboardList
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

const PM_INWARD_KEY = "production_material_nc_v2";
const lsLoad = (key, fb = []) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const formatDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};
const STAGE_MAPPING = { "Inward": "Received", "Testing": "Under Testing / Repair in Progress", "Waiting": "Pending", "Completion": "Completed / Not Repairable", "Closure": "Delivered / Hold" };
const STAGES = ["Inward", "Testing", "Waiting", "Completion", "Closure"];
const STATUS_TO_STAGE = Object.fromEntries(Object.entries(STAGE_MAPPING).map(([k, v]) => [v, k]));

const StatusBadge = ({ status }) => {
  const colors = {
    "Received": "bg-blue-50 text-blue-700 border-blue-200",
    "Under Testing / Repair in Progress": "bg-purple-50 text-purple-700 border-purple-200",
    "Pending": "bg-amber-50 text-amber-700 border-amber-200",
    "Completed / Not Repairable": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Delivered / Hold": "bg-slate-100 text-slate-700 border-slate-300"
  };
  return (
    <span className={`px-[0.5vw] py-[0.05vw] rounded-full text-[0.62vw] font-medium border ${colors[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status || "No Status"}
    </span>
  );
};

const StageAnalysisTab = ({ data }) => {
  const counts = useMemo(() => {
    const res = { Inward: 0, Testing: 0, Waiting: 0, Completion: 0, Closure: 0, Unknown: 0 };
    data.forEach(item => { const stage = STATUS_TO_STAGE[item.status] || "Unknown"; if (res[stage] !== undefined) res[stage]++; });
    return res;
  }, [data]);
  return (
    <div className="space-y-[1vw]">
      <div className="grid grid-cols-5 gap-[0.8vw]">
        {STAGES.map(s => (
          <div key={s} className="bg-white p-[1.2vw] rounded-[0.4vw] border border-gray-200 flex flex-col items-center shadow-sm hover:shadow transition-all">
            <span className="text-[0.6vw] font-semibold text-blue-600 uppercase mb-[0.2vw]">{s}</span>
            <span className="text-[1.8vw] font-bold text-gray-900 leading-none">{counts[s]}</span>
            <span className="text-[0.55vw] font-normal text-gray-500 mt-[0.2vw]">{STAGE_MAPPING[s]}</span>
          </div>
        ))}
      </div>
      <div className="bg-white p-[1.5vw] rounded-[0.6vw] border border-gray-200 shadow-sm">
        <h3 className="text-[0.9vw] font-semibold text-gray-800 mb-[1vw] flex items-center gap-[0.5vw]">
          <Layers className="w-[1.2vw] h-[1.2vw] text-blue-500" /> Stage-wise Defect Distribution
        </h3>
        <div className="flex items-end h-[12vw] gap-[2vw] px-[2vw] border-b border-gray-100 pb-[0.8vw]">
          {STAGES.map(s => {
            const height = counts[s] ? (counts[s] / Math.max(...Object.values(counts), 1)) * 100 : 5;
            return (
              <div key={s} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-full mb-[0.3vw] text-[0.7vw] font-medium text-gray-700 opacity-0 group-hover:opacity-100 transition-all">{counts[s]}</div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  className="w-[3.5vw] bg-blue-500 rounded-t-[0.2vw] hover:bg-blue-600 transition-colors"
                />
                <span className="mt-[0.6vw] text-[0.68vw] font-medium text-gray-500 uppercase">{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RCATab = ({ data }) => (
  <div className="bg-white rounded-[0.4vw] border border-gray-200 overflow-hidden shadow-sm">
    <div className="p-[0.8vw] border-b border-gray-100 bg-gray-50 flex justify-between items-center">
      <h3 className="text-[0.85vw] font-semibold text-gray-800 flex items-center gap-[0.5vw]">
        <SearchCode className="w-[1.1vw] h-[1.1vw] text-blue-500" /> Root Cause Analysis Log
      </h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-[0.72vw]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-[0.65vw] text-gray-800 font-semibold uppercase">
            <th className="px-[1vw] py-[0.7vw] border-r border-gray-100">Job Order / Product</th>
            <th className="px-[1vw] py-[0.7vw] border-r border-gray-100">Dept context</th>
            <th className="px-[1vw] py-[0.7vw] border-r border-gray-100">RCA Detail</th>
            <th className="px-[1vw] py-[0.7vw]">Inward Reference</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((item, i) => (
            <tr key={i} className="hover:bg-blue-50/20 transition-colors">
              <td className="px-[1vw] py-[0.8vw] border-r border-gray-100">
                <div className="text-gray-800 font-semibold uppercase">{item.productDescription}</div>
                <div className="text-[0.6vw] text-gray-500 font-medium">{item.jobOrderNo}</div>
              </td>
              <td className="px-[1vw] py-[0.8vw] border-r border-gray-100">
                <span className="text-[0.6vw] bg-blue-50 text-blue-700 px-[0.4vw] py-[0.05vw] rounded font-medium">
                  {item.role === 'assembledBy' ? 'Assembler' : item.role === 'testedBy' ? 'Tester' : 'FI'}
                </span>
              </td>
              <td className="px-[1vw] py-[0.8vw] border-r border-gray-100 max-w-[25vw] text-gray-700 font-normal ">
                {item.rootCause}
              </td>
              <td className="px-[1vw] py-[0.8vw]">
                <div className="text-gray-800 font-medium">{item.refNoInternal}</div>
                <div className="text-[0.6vw] text-gray-500 font-normal">{formatDate(item.completionDate)}</div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <><tr><td colSpan={4} className="py-[3vw] text-center text-gray-400 text-[0.8vw] font-normal">No RCA records found</td></tr></>
          )}
          {/* {data.length === 0 && (
            <tr><td colSpan={4} className="py-[3vw] text-center text-gray-400 text-[0.8vw] font-normal">No RCA records found</td>79
          )} */}
        </tbody>
      </table>
    </div>
  </div>
);

const ReworkTab = ({ data }) => (
  <div className="bg-white rounded-[0.4vw] border border-gray-200 overflow-hidden shadow-sm">
    <div className="p-[0.8vw] border-b border-gray-100 bg-gray-50 flex justify-between items-center">
      <h3 className="text-[0.85vw] font-semibold text-gray-800 flex items-center gap-[0.5vw]">
        <Wrench className="w-[1.1vw] h-[1.1vw] text-blue-500" /> Rework Tracking Report
      </h3>
    </div>
    <div className="p-[1vw] grid grid-cols-2 gap-[1vw] bg-white">
      {data.map((item, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-[0.4vw] p-[0.8vw] flex flex-col gap-[0.6vw] hover:shadow-md transition-all shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-[0.8vw] font-semibold text-gray-800 leading-none truncate max-w-[15vw]">{item.productDescription}</h4>
              <p className="text-[0.58vw] text-gray-500 font-normal mt-[0.05vw]">SUBMITTED BY: {item.savedBy}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>
          <div className="bg-blue-50/30 border border-blue-100 p-[0.5vw] rounded-[0.2vw]">
            <p className="text-[0.72vw] text-gray-700 font-normal leading-tight">"{item.correction}"</p>
          </div>
          <div className="flex justify-between items-end mt-auto pt-[0.2vw]">
            <span className="text-[0.6vw] font-normal text-gray-500 uppercase">{formatDate(item.completionDate)}</span>
            <div className="bg-blue-600 text-white px-[0.4vw] py-[0.05vw] rounded text-[0.6vw] font-medium uppercase">{item.jobOrderNo}</div>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <div className="col-span-2 py-[3vw] text-center text-gray-400 text-[0.8vw] font-normal">No rework records found</div>
      )}
    </div>
  </div>
);

const QualityMetricsTab = ({ data }) => {
  const stats = useMemo(() => {
    const total = data.length;
    const verified = data.filter(x => x.status === "Completed / Not Repairable" || x.status === "Delivered / Hold").length;
    const yieldRate = total ? (verified / total) * 100 : 0;
    const breakdown = { assembledBy: 0, testedBy: 0, fiBy: 0 };
    data.forEach(x => breakdown[x.role]++);
    return { total, verified, yieldRate, breakdown };
  }, [data]);
  return (
    <div className="space-y-[1.2vw]">
      <div className="grid grid-cols-3 gap-[1.2vw]">
        <div className="bg-blue-600 p-[2vw] rounded-[0.8vw] flex flex-col items-center justify-center text-center shadow-md">
          <ShieldCheck className="w-[2.2vw] h-[2.2vw] text-white/80 mb-[0.5vw]" />
          <h4 className="text-white text-[1vw] font-semibold uppercase mb-[0.2vw]">Quality Yield Rate</h4>
          <div className="text-[3.5vw] font-bold text-white leading-none tracking-tighter">{Math.round(stats.yieldRate)}%</div>
        </div>
        <div className="bg-white p-[1.5vw] rounded-[0.8vw] border border-gray-200 col-span-2 flex flex-col justify-center shadow-sm">
          <h4 className="text-[0.85vw] font-semibold text-gray-800 mb-[1vw] flex items-center gap-[0.4vw]">
            <Activity className="w-[1.1vw] h-[1.1vw] text-blue-500" /> Technical Accuracy Matrix
          </h4>
          <div className="grid grid-cols-3 gap-[1.5vw]">
            {["assembledBy", "testedBy", "fiBy"].map(role => {
              const label = role === 'assembledBy' ? 'Assembly' : role === 'testedBy' ? 'Testing' : 'Final Insp';
              const count = stats.breakdown[role];
              const percentage = stats.total ? (count / stats.total) * 100 : 0;
              return (
                <div key={role} className="space-y-[0.5vw]">
                  <div className="flex justify-between items-end">
                    <span className="text-[0.75vw] font-semibold text-gray-700 uppercase">{label}</span>
                    <span className="text-[0.6vw] font-medium text-gray-500">{count} Hits</span>
                  </div>
                  <div className="w-full h-[0.4vw] bg-gray-100 border border-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className="h-full bg-blue-600 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="bg-white p-[1.5vw] rounded-[0.8vw] border border-gray-200 flex flex-col items-center shadow-sm">
        <div className="flex items-center gap-[0.6vw] mb-[1.2vw]">
          <div className="w-[0.8vw] h-[0.8vw] bg-emerald-500 rounded-full shadow-sm" />
          <span className="text-[0.7vw] font-medium text-gray-700">Success: {stats.verified}</span>
          <div className="w-[0.8vw] h-[0.8vw] bg-gray-300 rounded-full ml-[1.5vw]" />
          <span className="text-[0.7vw] font-medium text-gray-700">Waiting: {stats.total - stats.verified}</span>
        </div>
        <div className="w-[35vw] h-[0.3vw] bg-gray-100 border border-gray-200 rounded-full relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.yieldRate}%` }}
            className="absolute inset-0 bg-emerald-500 rounded-full"
          />
        </div>
      </div>
    </div>
  );
};

export default function ProductionMaterialReports() {
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState("stage");
  const [searchQuery, setSearchQuery] = useState("");
  const reload = () => {
    const raw = lsLoad(PM_INWARD_KEY, []);
    const flattened = [];
    raw.forEach(entry => {
      entry.products?.forEach(product => {
        if (product.responses) {
          Object.entries(product.responses).forEach(([role, response]) => {
            if (response) {
              flattened.push({
                ...response,
                ...entry,
                ...product,
                role: role,
                responses: null
              });
            }
          });
        }
      });
    });
    setData(flattened);
  };
  useEffect(() => {
    reload();
    const interval = setInterval(reload, 5000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: "stage", label: "Stage-wise Defect Analysis", icon: Layers },
    { id: "rca", label: "Root Cause Analysis Report", icon: SearchCode },
    { id: "rework", label: "Rework Tracking Report", icon: Wrench },
    { id: "metrics", label: "Quality Performance Metrics", icon: Activity }
  ];

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(x =>
      (x.jobOrderNo || "").toLowerCase().includes(q) ||
      (x.productDescription || "").toLowerCase().includes(q) ||
      (x.customerName || "").toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map(x => ({
        Date: formatDate(x.date),
        JobOrder: x.jobOrderNo,
        Customer: x.customerName,
        Product: x.productDescription,
        Role: x.role,
        Stage: STATUS_TO_STAGE[x.status] || "Unknown",
        Status: x.status,
        Problem: x.problem,
        RootCause: x.rootCause,
        Correction: x.correction
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QA_Reports");
    XLSX.writeFile(workbook, `QA_Production_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="w-full flex flex-col h-full bg-gray-50 p-[1.2vw] gap-[0.8vw]">
      <div className="flex justify-between items-end border-b border-gray-200 pb-[0.6vw]">
        <div>
          <h1 className="text-[1.1vw] font-bold text-gray-900 uppercase flex items-center gap-[0.5vw] tracking-tight">
            <ClipboardList className="w-[1.4vw] h-[1.4vw] text-blue-600" /> Production Technical Analysis
          </h1>
          <p className="text-gray-500 text-[0.72vw] font-normal leading-none mt-[0.2vw] italic">
            Comprehensive quality yield & rework efficiency metrics
          </p>
        </div>
        <div className="flex gap-[0.6vw] items-center">
          <div className="relative bg-white border border-gray-300 rounded-[0.3vw] shadow-sm">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.8vw] h-[0.8vw] text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search analytics..."
              className="pl-[1.8vw] pr-[0.8vw] py-[0.45vw] bg-transparent text-[0.72vw] text-gray-700 font-normal outline-none focus:border-blue-400"
            />
          </div>
          <button
            onClick={exportToExcel}
            className="bg-blue-600 text-white px-[1.2vw] py-[0.6vw] rounded-[0.3vw] font-medium text-[0.72vw] uppercase flex items-center gap-[0.5vw] hover:bg-blue-700 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Download className="w-[1vw] h-[1vw]" /> Export Excel
          </button>
        </div>
      </div>

      <div className="flex items-center gap-[0.3vw] bg-white p-[0.3vw] rounded-[0.5vw] border border-gray-200 shadow-sm sticky top-0 z-10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-[0.5vw] py-[0.55vw] rounded-[0.4vw] text-[0.7vw] font-medium uppercase transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <tab.icon className="w-[1vw] h-[1vw]" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-[5vw]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "stage" && <StageAnalysisTab data={filteredData} />}
            {activeTab === "rca" && <RCATab data={filteredData} />}
            {activeTab === "rework" && <ReworkTab data={filteredData} />}
            {activeTab === "metrics" && <QualityMetricsTab data={filteredData} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}