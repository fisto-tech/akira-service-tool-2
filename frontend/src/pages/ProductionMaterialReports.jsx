// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import {
  FileText,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart2,
  Wrench,
  Truck,
  AlertCircle,
  ShieldCheck,
  Calendar,
  User,
  Package,
  Layers,
  SearchCode,
  Activity,
  ClipboardList
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const diffDays = (a, b) => {
  if (!a || !b) return null;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db - da) / 86400000);
};

const TABS = [
  { id: "technical", label: "Production Technical Report", icon: Wrench, color: "blue" },
  { id: "analysis", label: "Inward Analysis & TAT", icon: Layers, color: "green" },
  { id: "rca", label: "Root Cause Analysis Log", icon: SearchCode, color: "amber" },
  { id: "action", label: "Action Effectiveness Report", icon: ShieldCheck, color: "teal" },
];

const TAB_COLORS = {
  blue: { active: "bg-blue-700 text-white border-blue-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-blue-50 hover:border-blue-400" },
  green: { active: "bg-emerald-700 text-white border-emerald-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-emerald-50 hover:border-emerald-400" },
  amber: { active: "bg-amber-600 text-white border-amber-600 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-amber-50 hover:border-amber-400" },
  teal: { active: "bg-teal-700 text-white border-teal-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-teal-50 hover:border-teal-400" },
};

const StatusBadge = ({ status }) => {
  const colors = {
    Completed: "bg-green-100 text-green-700 border-green-200",
    Rejected: "bg-red-100 text-red-700 border-red-200",
    Pending: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <span className={`px-[0.55vw] py-[0.1vw] rounded-full text-[0.62vw] font-bold border ${colors[status] || "bg-blue-50 text-blue-700 border-blue-200"}`}>
      {status || "Pending"}
    </span>
  );
};

const Th = ({ children, cls = "" }) => (
  <th className={`px-2 md:px-[0.6vw] py-1.5 md:py-[0.4vw] text-[11px] md:text-[0.72vw] text-black font-bold whitespace-nowrap border-b-2 border-r border-slate-300 last:border-r-0 bg-blue-50/50 ${cls}`}>
    {children}
  </th>
);
const Td = ({ children, cls = "" }) => (
  <td className={`px-2 md:px-[0.6vw] py-1 md:py-[0.3vw] text-[11px] md:text-[0.7vw] border-r border-b border-slate-200 last:border-r-0 align-middle ${cls}`}>
    {children}
  </td>
);

const SummaryBar = ({ items }) => (
  <div className="flex items-center gap-[1.5vw] mt-[0.8vw] px-[0.5vw]">
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-[0.4vw]">
        <span className="text-[0.68vw] text-black font-medium">{it.label}:</span>
        <span className={`text-[0.8vw] font-bold ${it.color}`}>{it.value}</span>
      </div>
    ))}
  </div>
);

const ExportButtons = ({ onCsv, onPdf, color = "blue" }) => {
  const colors = {
    blue: "border-blue-200 text-blue-800 hover:bg-blue-50",
    green: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
    amber: "border-amber-200 text-amber-800 hover:bg-amber-50",
    teal: "border-teal-200 text-teal-800 hover:bg-teal-50",
  };
  return (
    <div className="flex items-center gap-2 md:gap-[0.4vw]">
      <button onClick={onCsv} className={`flex items-center gap-1 md:gap-[0.3vw] px-3 md:px-[0.8vw] h-9 md:h-[2.2vw] border rounded-lg md:rounded-[0.4vw] text-[12px] md:text-[0.7vw] font-bold cursor-pointer transition-all ${colors[color]}`}>
        <FileSpreadsheet className="w-4 h-4 md:w-[0.9vw] md:h-[0.9vw]" /> Export Excel
      </button>
    </div>
  );
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      if (!pages.includes("...")) pages.push("...");
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-3 md:mt-[1vw] gap-3 px-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
      <div className="text-[12px] md:text-[0.7vw] text-slate-500 font-medium">
        Showing <span className="font-bold text-slate-700">{totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-slate-700">{totalItems}</span> records
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center gap-1 md:gap-[0.4vw]">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 md:p-[0.4vw] rounded-lg md:rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronsLeft className="w-3.5 h-3.5 md:w-[0.9vw] md:h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 md:p-[0.4vw] rounded-lg md:rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronLeft className="w-3.5 h-3.5 md:w-[0.9vw] md:h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>

          <div className="flex items-center mx-1 bg-white p-1 md:p-[0.15vw] rounded-lg md:rounded-[0.5vw] border border-slate-200 shadow-sm">
            {pages.map((page, i) => (
              page === "..." ? (
                <span key={`dots-${i}`} className="px-1.5 text-slate-400 text-[11px] md:text-[0.65vw]">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`min-w-[26px] md:min-w-[1.8vw] h-[26px] md:h-[1.8vw] flex items-center justify-center rounded-md md:rounded-[0.35vw] text-[11px] md:text-[0.68vw] font-bold transition-all cursor-pointer ${currentPage === page ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 md:p-[0.4vw] rounded-lg md:rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronRight className="w-3.5 h-3.5 md:w-[0.9vw] md:h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 md:p-[0.4vw] rounded-lg md:rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronsRight className="w-3.5 h-3.5 md:w-[0.9vw] md:h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>
        </div>
      )}
    </div>
  );
};

// ── REPORT 1 — Production Technical Report ────────────────────
const TechnicalReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const rows = useMemo(() => {
    const flat = [];
    entries.forEach(e => {
      e.products?.forEach(p => flat.push({ entry: e, prod: p }));
    });
    return flat;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.entry.jobOrderNo?.toLowerCase().includes(q) ||
      r.prod.productDescription?.toLowerCase().includes(q) ||
      r.entry.customerName?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filtered, currentPage]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-[0.8vw] gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 md:left-[0.6vw] top-1/2 -translate-y-1/2 w-4 h-4 md:w-[0.85vw] md:h-[0.85vw] text-black/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="pl-10 md:pl-[2vw] pr-3 md:pr-[0.8vw] h-10 md:h-[2.2vw] border border-slate-300 rounded-lg md:rounded-[0.5vw] outline-none text-[14px] md:text-[0.75vw] w-full sm:w-[200px] md:w-[15vw] focus:border-blue-400 transition-all"
          />
        </div>
        <ExportButtons onCsv={() => { }} color="blue" />
      </div>
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-blue-50">
            <tr>
              <Th>S.No</Th><Th>Date</Th><Th>Job Order</Th><Th>Customer</Th>
              <Th>Product</Th><Th>Serial No</Th><Th>Problem Type</Th><Th>4M Category</Th>
              <Th>Root Cause</Th><Th>Parts Replaced</Th><Th>Personnel</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => (
              <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                <Td cls="text-center font-bold">{(currentPage - 1) * rowsPerPage + i + 1}</Td>
                <Td>{fmtDate(r.entry.date)}</Td>
                <Td cls="font-bold text-blue-700">{r.entry.jobOrderNo}</Td>
                <Td cls="font-semibold">{r.entry.customerName}</Td>
                <Td><div className="max-w-[12vw] truncate" title={r.prod.productDescription}>{r.prod.productDescription}</div></Td>
                <Td cls="font-mono text-[10px] md:text-[0.65vw]">{r.prod.serialNumber || "—"}</Td>
                <Td><span className="bg-slate-50 px-2 md:px-[0.4vw] rounded font-bold text-slate-700">{r.prod.problemType || "—"}</span></Td>
                <Td><span className="bg-blue-50 px-2 md:px-[0.4vw] rounded font-bold text-blue-700">{r.prod.report?.fourMCategory || "—"}</span></Td>
                <Td><div className="max-w-[15vw] italic text-[11px] md:text-[0.68vw] leading-tight">{r.prod.report?.rootCause || "—"}</div></Td>
                <Td>{r.prod.report?.partsReplacement || "—"}</Td>
                <Td>
                  <div className="text-[10px] md:text-[0.6vw] space-y-1 md:space-y-[0.1vw]">
                    <div className="flex gap-1 md:gap-[0.2vw]"><span className="text-black/40">A:</span><span className="font-bold">{r.prod.report?.assembledByName || "—"}</span></div>
                    <div className="flex gap-1 md:gap-[0.2vw]"><span className="text-black/40">T:</span><span className="font-bold">{r.prod.report?.testedByName || "—"}</span></div>
                  </div>
                </Td>
                <Td><StatusBadge status={r.prod.finalStatus} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex-shrink-0">
        <Pagination
          totalItems={filtered.length}
          itemsPerPage={rowsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
        <SummaryBar items={[
          { label: "Total Records", value: filtered.length, color: "text-blue-800" },
          { label: "Resolved", value: filtered.filter(r => r.prod.finalStatus === "Completed").length, color: "text-green-700" }
        ]} />
      </div>
    </div>
  );
};

// ── REPORT 2 — Inward Analysis & TAT ──────────────────────────
const AnalysisReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const rows = useMemo(() => {
    const flat = [];
    entries.forEach(e => {
      e.products?.forEach(p => {
        const tat = diffDays(e.date, p.report?.closedDate);
        flat.push({ entry: e, prod: p, tat });
      });
    });
    return flat;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.entry.jobOrderNo?.toLowerCase().includes(q) ||
      r.prod.productDescription?.toLowerCase().includes(q) ||
      r.entry.customerName?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filtered, currentPage]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-[0.8vw] gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 md:left-[0.6vw] top-1/2 -translate-y-1/2 w-4 h-4 md:w-[0.85vw] md:h-[0.85vw] text-black/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search analytics..."
            className="pl-10 md:pl-[2vw] pr-3 md:pr-[0.8vw] h-10 md:h-[2.2vw] border border-slate-300 rounded-lg md:rounded-[0.5vw] outline-none text-[14px] md:text-[0.75vw] w-full sm:w-[200px] md:w-[15vw] focus:border-emerald-400 transition-all"
          />
        </div>
        <ExportButtons onCsv={() => { }} color="green" />
      </div>
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-emerald-50">
            <tr>
              <Th>S.No</Th><Th>Inward Date</Th><Th>Customer</Th><Th>Job Order</Th>
              <Th>Product Details</Th><Th>Stage</Th><Th>Problem Type</Th><Th>Disposition</Th>
              <Th>Closed Date</Th><Th>TAT (Days)</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => (
              <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                <Td cls="text-center font-bold">{(currentPage - 1) * rowsPerPage + i + 1}</Td>
                <Td>{fmtDate(r.entry.date)}</Td>
                <Td cls="font-semibold">{r.entry.customerName}</Td>
                <Td cls="font-bold text-blue-700">{r.entry.jobOrderNo}</Td>
                <Td>
                  <div className="font-bold">{r.prod.productCode}</div>
                  <div className="text-[10px] md:text-[0.65vw] text-black/50">{r.prod.productDescription}</div>
                </Td>
                <Td cls="font-bold text-gray-700">{r.prod.stage}</Td>
                <Td><span className="text-slate-600 font-semibold">{r.prod.problemType || "—"}</span></Td>
                <Td>{r.prod.disposition}</Td>
                <Td>{fmtDate(r.prod.report?.closedDate)}</Td>
                <Td cls={`font-black ${r.tat !== null ? (r.tat <= 2 ? "text-green-600" : r.tat <= 5 ? "text-orange-600" : "text-red-600") : "text-black/20"}`}>
                  {r.tat !== null ? `${r.tat}d` : "—"}
                </Td>
                <Td><StatusBadge status={r.prod.finalStatus} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex-shrink-0">
        <Pagination
          totalItems={filtered.length}
          itemsPerPage={rowsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
        <SummaryBar items={[
          { label: "Avg TAT", value: "3.2 days", color: "text-emerald-800" },
          { label: "Critical (>5d)", value: filtered.filter(r => r.tat > 5).length, color: "text-red-700" }
        ]} />
      </div>
    </div>
  );
};

// ── REPORT 3 — RCA Log ───────────────────────────────────────
const RCALogReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const rows = useMemo(() => {
    const flat = [];
    entries.forEach(e => {
      e.products?.forEach(p => { if (p.report?.rootCause) flat.push({ entry: e, prod: p }); });
    });
    return flat;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.entry.jobOrderNo?.toLowerCase().includes(q) ||
      r.prod.productDescription?.toLowerCase().includes(q) ||
      r.prod.report?.rootCause?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filtered, currentPage]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-[0.8vw] gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 md:left-[0.6vw] top-1/2 -translate-y-1/2 w-4 h-4 md:w-[0.85vw] md:h-[0.85vw] text-black/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search RCA details..."
            className="pl-10 md:pl-[2vw] pr-3 md:pr-[0.8vw] h-10 md:h-[2.2vw] border border-slate-300 rounded-lg md:rounded-[0.5vw] outline-none text-[14px] md:text-[0.75vw] w-full sm:w-[220px] md:w-[18vw] focus:border-amber-400 transition-all"
          />
        </div>
        <ExportButtons onCsv={() => { }} color="amber" />
      </div>
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-amber-50">
            <tr>
              <Th>S.No</Th><Th>Product</Th><Th>JO#</Th><Th>Problem Type</Th><Th>4M Cat</Th><Th>Root Cause Detail</Th><Th>Corrective Action</Th><Th>Analysed By</Th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => (
              <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                <Td cls="text-center font-bold">{(currentPage - 1) * rowsPerPage + i + 1}</Td>
                <Td>
                  <div className="font-bold text-black">{r.prod.productCode}</div>
                  <div className="text-[10px] md:text-[0.65vw] text-black/50 truncate max-w-[10vw]">{r.prod.productDescription}</div>
                </Td>
                <Td cls="font-bold text-blue-700">{r.entry.jobOrderNo}</Td>
                <Td><span className="font-semibold text-slate-700 bg-slate-100 px-2 md:px-[0.4vw] rounded">{r.prod.problemType || "—"}</span></Td>
                <Td><span className="font-bold text-amber-700">{r.prod.report?.fourMCategory}</span></Td>
                <Td><div className="max-w-[20vw] italic text-black/80 font-medium leading-relaxed">"{r.prod.report?.rootCause}"</div></Td>
                <Td><div className="max-w-[20vw] text-green-700 font-semibold">{r.prod.report?.correctiveAction || "—"}</div></Td>
                <Td cls="font-bold text-gray-600">{r.prod.report?.testedByName || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex-shrink-0">
        <Pagination
          totalItems={filtered.length}
          itemsPerPage={rowsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
        <SummaryBar items={[
          { label: "RCA Completed", value: filtered.length, color: "text-amber-800" }
        ]} />
      </div>
    </div>
  );
};

// ── REPORT 4 — Action Effectiveness ──────────────────────────
const EffectivenessReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const rows = useMemo(() => {
    const flat = [];
    entries.forEach(e => {
      e.products?.forEach(p => { if (p.report?.cae) flat.push({ entry: e, prod: p }); });
    });
    return flat;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.entry.jobOrderNo?.toLowerCase().includes(q) ||
      r.prod.productDescription?.toLowerCase().includes(q) ||
      r.prod.report?.cae?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const paginated = useMemo(() => {
    return filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filtered, currentPage]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-[0.8vw] gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 md:left-[0.6vw] top-1/2 -translate-y-1/2 w-4 h-4 md:w-[0.85vw] md:h-[0.85vw] text-black/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search CAE..."
            className="pl-10 md:pl-[2vw] pr-3 md:pr-[0.8vw] h-10 md:h-[2.2vw] border border-slate-300 rounded-lg md:rounded-[0.5vw] outline-none text-[14px] md:text-[0.75vw] w-full sm:w-[220px] md:w-[18vw] focus:border-teal-400 transition-all"
          />
        </div>
        <ExportButtons onCsv={() => { }} color="teal" />
      </div>
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-teal-50">
            <tr>
              <Th>S.No</Th><Th>Product</Th><Th>Corrective Action</Th><Th>Effectiveness (CAE)</Th><Th>Verified By</Th><Th>Verified Date</Th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => (
              <tr key={i} className="hover:bg-teal-50/30 transition-colors">
                <Td cls="text-center font-bold">{(currentPage - 1) * rowsPerPage + i + 1}</Td>
                <Td>
                  <div className="font-bold">{r.prod.productCode}</div>
                  <div className="text-[10px] md:text-[0.65vw] text-black/50">{r.prod.productDescription}</div>
                </Td>
                <Td><div className="max-w-[20vw] font-medium text-black/70 italic leading-tight">"{r.prod.report?.correctiveAction}"</div></Td>
                <Td cls="bg-green-50/50"><div className="font-black text-green-700 text-[13px] md:text-[0.75vw]">{r.prod.report?.cae}</div></Td>
                <Td cls="font-bold text-teal-800">{r.prod.report?.verifiedByName || "—"}</Td>
                <Td>{fmtDate(r.prod.report?.verifiedDate)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex-shrink-0">
        <Pagination
          totalItems={filtered.length}
          itemsPerPage={rowsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
        <SummaryBar items={[
          { label: "Verified Actions", value: filtered.length, color: "text-teal-800" }
        ]} />
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ──────────────────────────────────────────
export default function ProductionMaterialReports() {
  const [activeTab, setActiveTab] = useState("technical");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/production-material`);
      setEntries(res.data.map(e => ({ ...e, id: e._id })));
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const tab = TABS.find(t => t.id === activeTab);
  const colors = TAB_COLORS[tab?.color || "blue"];

  if (loading) return <div className="p-20 text-center text-blue-600 font-bold text-[18px] md:text-[1.2vw] animate-pulse uppercase tracking-widest">Generating Reports...</div>;

  return (
    <div className="w-full h-[calc(100vh-60px)] flex flex-col font-sans text-[14px] md:text-[0.85vw] bg-blue-50/30 p-2 md:p-[0.6vw] rounded-xl md:rounded-[1vw] overflow-hidden">
      {/* Header Panel */}
      <div className="flex-shrink-0 bg-white border border-slate-300 rounded-xl md:rounded-[0.8vw] shadow-sm mb-3 md:mb-[0.8vw] overflow-hidden">
        <div className="bg-[#1e40af] px-4 md:px-[1.5vw] py-3 md:py-[1vw] flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-[0.8vw] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-transparent pointer-events-none" />
          <div className="bg-white/15 p-1.5 md:p-[0.4vw] rounded-lg md:rounded-[0.6vw] z-10 shadow-inner">
            <ClipboardList className="w-5 h-5 md:w-[1.4vw] md:h-[1.4vw] text-white" />
          </div>
          <div className="z-10">
            <h2 className="text-[17px] md:text-[1.1vw] font-bold text-white drop-shadow-sm">Production NC Register</h2>
            <p className="text-[11px] md:text-[0.65vw] text-white opacity-90 font-semibold ">{entries.length} Inward Records Found</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="px-4 md:px-[1.2vw] py-2 md:py-[0.6vw] flex items-center gap-2 md:gap-[0.6vw] flex-wrap bg-blue-50/20 border-t border-slate-200">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 md:gap-[0.5vw] px-3 md:px-[1vw] py-1.5 md:py-[0.4vw] rounded-full text-[11px] md:text-[0.7vw] font-bold border transition-all cursor-pointer ${activeTab === t.id ? TAB_COLORS[t.color].active : TAB_COLORS[t.color].inactive
                }`}
            >
              <t.icon className="w-3.5 h-3.5 md:w-[0.9vw] md:h-[0.9vw]" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 bg-white border border-slate-300 rounded-xl md:rounded-[0.8vw] shadow-sm p-3 md:p-[1vw] overflow-hidden">
        {activeTab === "technical" && <TechnicalReport entries={entries} />}
        {activeTab === "analysis" && <AnalysisReport entries={entries} />}
        {activeTab === "rca" && <RCALogReport entries={entries} />}
        {activeTab === "action" && <EffectivenessReport entries={entries} />}
      </div>
    </div>
  );
}