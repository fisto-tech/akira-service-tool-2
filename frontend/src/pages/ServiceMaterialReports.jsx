// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  FileText,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
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
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

// ── Storage helpers ──────────────────────────────────────────
const lsLoad = (key, fb) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};

const API_URL = import.meta.env.VITE_API_URL;
const INWARD_KEY = "service_material_inward_v2";

// ── Date helpers ─────────────────────────────────────────────
const fmtDate = (s) => {
  if (!s) return "—";
  if (s.includes("T")) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  }
  if (s.includes("-") && s.split("-")[0].length === 4) {
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  }
  return s;
};

// ── Export Helpers ───────────────────────────────────────────
const exportToPDF = ({ tableId, filename, title, filters = {} }) => {
  const doc = new jsPDF("landscape", "mm", "a4");
  const margin = 10;
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text(title, margin, 15);
  
  // Subtitle / Metadata
  doc.setFontSize(9);
  doc.setTextColor(100);
  const dateStr = `Generated on: ${new Date().toLocaleString()}`;
  const filterStr = Object.entries(filters)
    .filter(([_, v]) => v && v !== "All")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ");
  
  doc.text(dateStr, margin, 22);
  if (filterStr) doc.text(`Filters: ${filterStr}`, margin, 27);

  autoTable(doc, {
    html: `#${tableId}`,
    startY: filterStr ? 32 : 27,
    theme: "striped",
    headStyles: { 
      fillColor: [30, 64, 175], 
      textColor: 255, 
      fontSize: 8,
      fontStyle: "bold",
      halign: "center"
    },
    bodyStyles: { fontSize: 7, textColor: 50 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { 
      lineWidth: 0.1, 
      lineColor: [200, 200, 200] 
    },
    margin: { top: 30, right: margin, bottom: 20, left: margin },
    didParseCell: (data) => {
      // Clean up text content (remove multiple spaces/newlines)
      if (data.cell.section === "body" && typeof data.cell.text === "object") {
        data.cell.text = data.cell.text.map(t => t.replace(/\s+/g, " ").trim());
      }
    }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - margin);
    doc.text("Akira Service Tool - Production & Service Reporting System", margin, doc.internal.pageSize.height - margin);
  }

  // Construct filename with filters
  let cleanName = filename.replace(/\s+/g, "_");
  if (filters.from && filters.to) cleanName += `_${filters.from}_to_${filters.to}`;
  else if (filters.status && filters.status !== "All") cleanName += `_${filters.status}`;

  doc.save(`${cleanName}.pdf`);
};

const exportToExcel = ({ data, filename }) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename.replace(/\s+/g, "_")}.xlsx`);
};

const diffDays = (a, b) => {
  if (!a || !b) return null;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
};

// ── Report tab definitions ───────────────────────────────────
const TABS = [
  {
    id: "testing",
    label: "Service Testing / Repair Report",
    icon: Wrench,
    color: "blue",
  },
  {
    id: "delivery",
    label: "Delivery Report & Delay / TAT Analysis",
    icon: Truck,
    color: "green",
  },
  {
    id: "rca",
    label: "Root Cause Analysis",
    icon: AlertCircle,
    color: "amber",
  },
  {
    id: "corrective",
    label: "Corrective Action",
    icon: ShieldCheck,
    color: "teal",
  },
];

const TAB_COLORS = {
  blue: { active: "bg-blue-700 text-white border-blue-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-blue-50 hover:border-blue-400", badge: "bg-blue-100 text-blue-900" },
  green: { active: "bg-emerald-700 text-white border-emerald-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-emerald-50 hover:border-emerald-400", badge: "bg-emerald-100 text-emerald-900" },
  amber: { active: "bg-amber-600 text-white border-amber-600 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-amber-50 hover:border-amber-400", badge: "bg-amber-100 text-amber-900" },
  teal: { active: "bg-teal-700 text-white border-teal-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-teal-50 hover:border-teal-400", badge: "bg-teal-100 text-teal-900" },
};

// ── Status badge ─────────────────────────────────────────────
const STATUS_COLORS = {
  Pending: "bg-orange-100 text-black border-orange-300",
  Delivered: "bg-green-100 text-black border-green-300",
  Hold: "bg-red-100 text-black border-red-300",
  "Not Repairable": "bg-slate-200 text-black border-slate-400",
  Completed: "bg-green-100 text-black border-green-300",
  "Repair in Progress": "bg-blue-100 text-black border-blue-300",
  Open: "bg-slate-100 text-black border-slate-300",
  Assigned: "bg-purple-100 text-black border-purple-300",
};

const StatusBadge = ({ status }) => (
  <span className={`px-[0.5vw] py-[0.1vw] rounded-full text-[0.8vw] font-semibold whitespace-pre border shadow-sm ${STATUS_COLORS[status] || "bg-slate-100 text-black border-slate-300"}`}>
    {status || "—"}
  </span>
);

// ── Empty state ──────────────────────────────────────────────
const EmptyState = ({ message }) => (
  <tr>
    <td colSpan={20} className="py-[3vw] text-center">
      <div className="flex flex-col items-center gap-[0.6vw] text-black">
        <FileText className="w-[2.5vw] h-[2.5vw]" />
        <span className="text-[0.8vw] font-semibold">{message}</span>
      </div>
    </td>
  </tr>
);

// ── Th helper ────────────────────────────────────────────────
const Th = ({ children, cls = "" }) => (
  <th className={`px-[0.8vw] py-[0.7vw] text-[0.85vw] text-black font-bold whitespace-nowrap border-b-2 border-r border-slate-300 last:border-r-0 bg-blue-50/50 ${cls}`}>
    {children}
  </th>
);
const Td = ({ children, cls = "" }) => (
  <td className={`px-[1vw] py-[1vw] text-[0.8vw] text-black border-r border-b border-slate-200 last:border-r-0 align-middle ${cls}`}>
    {children}
  </td> 
);

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
    <div className="flex flex-col sm:flex-row items-center justify-between mt-[1vw] gap-[0.6vw] px-[0.1vw] bg-slate-50/50 p-[0.4vw] rounded-[0.6vw] border border-slate-100">
      <div className="text-[0.7vw] text-slate-500 font-medium">
        Showing <span className="font-bold text-slate-700">{totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-slate-700">{totalItems}</span> records
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center gap-[0.4vw]">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-[0.4vw] rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronsLeft className="w-[0.9vw] h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-[0.4vw] rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronLeft className="w-[0.9vw] h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>

          <div className="flex items-center mx-[0.2vw] bg-white p-[0.15vw] rounded-[0.5vw] border border-slate-200 shadow-sm">
            {pages.map((page, i) => (
              page === "..." ? (
                <span key={`dots-${i}`} className="px-[0.3vw] text-slate-400 text-[0.65vw]">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`min-w-[1.8vw] h-[1.8vw] flex items-center justify-center rounded-[0.35vw] text-[0.68vw] font-bold transition-all cursor-pointer ${currentPage === page ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
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
            className="p-[0.4vw] rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronRight className="w-[0.9vw] h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-[0.4vw] rounded-[0.4vw] border border-slate-200 disabled:opacity-30 hover:bg-white hover:border-blue-300 transition-all cursor-pointer group"
          >
            <ChevronsRight className="w-[0.9vw] h-[0.9vw] text-slate-600 group-hover:text-blue-600" />
          </button>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REPORT 1 — Service Testing / Repair Report
// ═══════════════════════════════════════════════════════════════
const TestingRepairReport = ({ entries, fromDate, setFromDate, toDate, setToDate }) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const rows = useMemo(() => {
    const flat = [];
    entries.forEach((row) => {
      (row.products || []).forEach((p) => {
        if (p.report) {
          flat.push({ row, p });
        }
      });
    });
    return flat;
  }, [entries]);

  const filtered = useMemo(() => {
    let data = rows;
    if (filterStatus !== "All") data = data.filter(({ p }) => (p.report?.status || "") === filterStatus);
    if (fromDate && toDate) {
      data = data.filter(({ row }) => {
        const d = new Date(row.date);
        return d >= new Date(fromDate) && d <= new Date(toDate);
      });
    }
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(({ row, p }) =>
        row.customerName?.toLowerCase().includes(s) ||
        p.productDescription?.toLowerCase().includes(s) ||
        p.serialNumber?.toLowerCase().includes(s) ||
        p.report?.testedBy?.toLowerCase().includes(s) ||
        p.report?.fourMCategory?.toLowerCase().includes(s) ||
        p.report?.errorCode?.toLowerCase().includes(s)
      );
    }
    return data;
  }, [rows, search, filterStatus]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus]);

  const statuses = ["All", "Repair in Progress", "Completed", "Not Repairable", "Open"];

  const downloadPdf = () => {
    exportToPDF({
      tableId: "table-testing",
      filename: `Testing_Report_${filterStatus}`,
      title: "Service Testing / Repair Report",
      filters: { Status: filterStatus, Search: search, From: fromDate, To: toDate }
    });
  };

  const exportCsv = () => {
    const data = filtered.map(({ row, p }, i) => ({
      "S.No": i + 1,
      "Inward Date": fmtDate(row.date),
      "Customer": row.customerName,
      "Ref No": row.refNoCustomer,
      "Category": row.category,
      "Product": p.productDescription,
      "Board Type": p.boardType,
      "Serial No": p.serialNumber,
      "Tested By": p.report?.testedBy || "—",
      "Completed Date": fmtDate(p.report?.completedDate),
      "Status": p.report?.status || "Pending"
    }));
    exportToExcel({ data, filename: `Testing_Report_${filterStatus}` });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between mb-[0.8vw] gap-[0.6vw] flex-wrap">
        <div className="flex items-center gap-[0.5vw] flex-wrap">
          {statuses.map((s) => (
            <button key={s} type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-[0.8vw] py-[0.3vw] rounded-full text-[0.7vw] border font-bold cursor-pointer transition-all ${filterStatus === s ? "bg-blue-700 text-white border-blue-700 shadow-sm" : "bg-white text-black border-slate-300 hover:border-blue-400"
                }`}
            >{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-[0.5vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-blue-500 text-[0.75vw] w-[11vw] text-black"
            />
          </div>
          <DateRangeFilter from={fromDate} setFrom={setFromDate} to={toDate} setTo={setToDate} />
          <ExportButtons onCsv={exportCsv} onPdf={downloadPdf} />
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table id="table-testing" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-blue-50">
            <tr>
              <Th>S.No</Th><Th cls="min-w-[6vw]">Date</Th><Th>Customer</Th><Th>Ref No.</Th>
              <Th>Product</Th><Th>Board Type</Th><Th>Serial No</Th><Th>Type</Th>
              <Th>Tested By</Th><Th>Comp. Date</Th>
              <Th>4M Cat</Th><Th>Err Code</Th>
              <Th>Problem Identified</Th><Th>Root Cause</Th>
              <Th>Corrective Action</Th><Th>Parts Replaced</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <EmptyState message="No testing/repair reports found." /> :
              paginated.map(({ row, p }, i) => (
                <tr key={`${row.id}-${p._pid}`} className="hover:bg-blue-50/20 transition-colors">
                  <Td cls="text-center font-semibold">{((currentPage - 1) * rowsPerPage) + i + 1}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                  <Td cls="font-semibold">{row.customerName || "—"}</Td>
                  <Td>{row.refNoCustomer || "—"}</Td>
                  <Td><div className="break-words whitespace-normal min-w-[10vw]" title={p.productDescription}>{p.productDescription || "—"}</div></Td>
                  <Td>{p.boardType || "—"}</Td>
                  <Td cls="font-mono">{p.serialNumber || "—"}</Td>
                  <Td>
                    <span className={`px-[0.5vw] py-[0.1vw] rounded text-[0.62vw] font-semibold uppercase ${p.type === "W" ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                      {p.type === "W" ? "Warranty" : "Paid"}
                    </span>
                  </Td>
                  <Td cls="font-semibold">{p.report?.testedBy || "—"}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(p.report?.completedDate)}</Td>
                  <Td><span className="bg-blue-50 px-[0.4vw] rounded font-semibold text-black">{p.report?.fourMCategory || "—"}</span></Td>
                  <Td><span className="bg-slate-50 px-[0.4vw] rounded font-semibold text-black">{p.report?.errorCode || "—"}</span></Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[12vw]">{p.report?.problemDescription || "—"}</div></Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[12vw] text-black">{p.report?.rootCause || "—"}</div></Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[12vw] text-blue-700">{p.report?.correctiveAction || "—"}</div></Td>
                  <Td>{p.report?.partsReplacement || "—"}</Td>
                  <Td><StatusBadge status={p.report?.status} /></Td>
                </tr>
              ))
            }
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
          { label: "Total Reports", value: rows.length, color: "text-blue-800" },
          { label: "Completed", value: rows.filter(({ p }) => p.report?.status === "Completed").length, color: "text-emerald-800" },
          { label: "In Progress", value: rows.filter(({ p }) => p.report?.status === "Repair in Progress").length, color: "text-blue-700" },
          { label: "Not Repairable", value: rows.filter(({ p }) => p.report?.status === "Not Repairable").length, color: "text-red-700" },
        ]} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REPORT 2 — Delivery Report & Delay / TAT Analysis
// ═══════════════════════════════════════════════════════════════
const DeliveryReport = ({ entries, fromDate, setFromDate, toDate, setToDate }) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const rows = useMemo(() => entries.map((row) => {
    const prods = row.products || [];
    const allDelays = prods.map((p) => diffDays(p.expectedDeliveryDate, row.finalStatusDate)).filter((d) => d !== null);
    const avgDelay = allDelays.length ? Math.round(allDelays.reduce((a, b) => a + b, 0) / allDelays.length) : null;
    const inwardDate = row.date;
    const deliveredDate = row.finalStatusDate;
    const tat = diffDays(inwardDate, deliveredDate);
    return { row, prods, avgDelay, tat };
  }), [entries]);

  const filtered = useMemo(() => {
    let data = rows;
    if (filterStatus !== "All") data = data.filter(({ row }) => (row.finalStatus || "Pending") === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(({ row }) =>
        row.customerName?.toLowerCase().includes(s) ||
        row.refNoCustomer?.toLowerCase().includes(s)
      );
    }
    return data;
  }, [rows, search, filterStatus]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus]);

  const downloadPdf = () => {
    exportToPDF({
      tableId: "table-delivery",
      filename: `Delivery_Report_${filterStatus}`,
      title: "Delivery & Delay Analysis Report",
      filters: { Status: filterStatus, Search: search, From: fromDate, To: toDate }
    });
  };

  const exportCsv = () => {
    const data = filtered.map(({ row, prods, tat, avgDelay }, i) => ({
      "S.No": i + 1,
      "Inward Date": fmtDate(row.date),
      "Customer": row.customerName,
      "Ref No": row.refNoCustomer,
      "Category": row.category,
      "# Products": prods.length,
      "Final Status": row.finalStatus,
      "Delivered Date": fmtDate(row.finalStatusDate),
      "TAT (Days)": tat !== null ? `${tat}d` : "—",
      "Avg Delay": avgDelay !== null ? (avgDelay > 0 ? `+${avgDelay}d` : "On time") : "—",
      "Remarks": row.finalStatusRemarks
    }));
    exportToExcel({ data, filename: `Delivery_Report_${filterStatus}` });
  };

  const statuses = ["All", "Pending", "Delivered", "Hold", "Not Repairable"];
  const deliveredCount = rows.filter(({ row }) => row.finalStatus === "Delivered").length;
  const tats = rows.filter(({ tat }) => tat !== null).map(({ tat }) => tat);
  const avgTat = tats.length ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : "—";
  const delayedCount = rows.filter(({ avgDelay }) => avgDelay !== null && avgDelay > 0).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between mb-[0.8vw] gap-[0.6vw] flex-wrap">
        <div className="flex items-center gap-[0.5vw] flex-wrap">
          {statuses.map((s) => (
            <button key={s} type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-[0.8vw] py-[0.3vw] rounded-full text-[0.7vw] border font-bold cursor-pointer transition-all ${filterStatus === s ? "bg-emerald-800 text-white border-emerald-800 shadow-sm" : "bg-white text-black border-slate-300 hover:border-emerald-400"
                }`}
            >{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-[0.5vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-emerald-500 text-[0.75vw] w-[11vw] text-black"
            />
          </div>
          <DateRangeFilter from={fromDate} setFrom={setFromDate} to={toDate} setTo={setToDate} />
          <ExportButtons color="green" onCsv={exportCsv} onPdf={downloadPdf} />
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table id="table-delivery" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-emerald-50">
            <tr>
              <Th>S.No</Th><Th>Inward Date</Th><Th>Customer</Th>
              <Th>Ref No.</Th><Th>Category</Th><Th># Products</Th>
              <Th>Final Status</Th><Th>Delivered Date</Th>
              <Th>TAT (Days)</Th><Th>Avg Delay (Days)</Th><Th>Remarks</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <EmptyState message="No delivery records found." /> :
              paginated.map(({ row, prods, tat, avgDelay }, i) => (
                <tr key={row.id} className="hover:bg-emerald-50/20 transition-colors">
                  <Td cls="text-center font-semibold">{(currentPage - 1) * rowsPerPage + i + 1}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                  <Td cls="font-semibold"><div className="break-words whitespace-normal min-w-[9vw]" title={row.customerName}>{row.customerName || "—"}</div></Td>
                  <Td>{row.refNoCustomer || "—"}</Td>
                  <Td cls="font-semibold text-slate-700">{row.category || "—"}</Td>
                  <Td cls="text-center font-bold text-blue-700">{prods.length}</Td>
                  <Td><StatusBadge status={row.finalStatus} /></Td>
                  <Td cls="min-w-[6vw] font-semibold">{fmtDate(row.finalStatusDate)}</Td>
                  <Td cls={`font-bold ${tat === null ? "text-black/30" : tat <= 7 ? "text-green-700" : tat <= 14 ? "text-amber-600" : "text-red-600"}`}>
                    {tat !== null ? `${tat}d` : "—"}
                  </Td>
                  <Td cls={`font-bold ${avgDelay === null ? "text-black/30" : avgDelay <= 0 ? "text-green-700" : avgDelay <= 3 ? "text-amber-600" : "text-red-600"}`}>
                    {avgDelay !== null ? (avgDelay > 0 ? `+${avgDelay}d` : avgDelay === 0 ? "On time" : `${avgDelay}d early`) : "—"}
                  </Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[10vw] text-slate-900" title={row.finalStatusRemarks}>{row.finalStatusRemarks || "—"}</div></Td>
                </tr>
              ))
            }
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
          { label: "Total Entries", value: rows.length, color: "text-black" },
          { label: "Delivered", value: deliveredCount, color: "text-emerald-800" },
          { label: "Avg TAT", value: avgTat !== "—" ? `${avgTat} days` : "—", color: "text-slate-800" },
          { label: "Delayed", value: delayedCount, color: "text-red-700" },
        ]} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REPORT 3 — Root Cause Analysis
// ═══════════════════════════════════════════════════════════════
const RootCauseReport = ({ entries, fromDate, setFromDate, toDate, setToDate }) => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const rows = useMemo(() => {
    const flat = [];
    entries.forEach((row) => {
      (row.products || []).forEach((p) => {
        if (p.report?.rootCause) {
          flat.push({ row, p });
        }
      });
    });
    return flat;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(({ row, p }) =>
      row.customerName?.toLowerCase().includes(s) ||
      p.productDescription?.toLowerCase().includes(s) ||
      p.report?.rootCause?.toLowerCase().includes(s) ||
      p.report?.problemDescription?.toLowerCase().includes(s) ||
      p.report?.fourMCategory?.toLowerCase().includes(s) ||
      p.report?.errorCode?.toLowerCase().includes(s)
    );
  }, [rows, search]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search]);

  const downloadPdf = () => {
    exportToPDF({
      tableId: "table-rca",
      filename: "RCA_Report",
      title: "Root Cause Analysis (RCA) Report",
      filters: { Search: search, From: fromDate, To: toDate }
    });
  };

  const exportCsv = () => {
    const data = filtered.map(({ row, p }, i) => ({
      "S.No": i + 1,
      "Date": fmtDate(row.date),
      "Customer": row.customerName,
      "Product": p.productDescription,
      "Board Type": p.boardType,
      "Serial No": p.serialNumber,
      "Type": p.type === "W" ? "Warranty" : "Paid",
      "Err Code": p.report?.errorCode,
      "4M Cat": p.report?.fourMCategory,
      "Root Cause": p.report?.rootCause,
      "Tested By": p.report?.testedBy,
      "Status": p.report?.status
    }));
    exportToExcel({ data, filename: "RCA_Report" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between mb-[0.8vw] gap-[0.6vw]">
        <div></div>
        <div className="flex items-center gap-[0.8vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search root causes..."
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-amber-500 text-[0.75vw] w-[11vw] text-black"
            />
          </div>
          <DateRangeFilter from={fromDate} setFrom={setFromDate} to={toDate} setTo={setToDate} />
          <span className="text-[0.72vw] text-black/70 font-bold bg-amber-50 px-[0.8vw] py-[0.2vw] rounded-full border border-amber-100">{filtered.length} RCA records</span>
          <ExportButtons color="amber" onCsv={exportCsv} onPdf={downloadPdf} />
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table id="table-rca" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-amber-50">
            <tr>
              <Th>S.No</Th><Th cls="min-w-[6vw]">Date</Th><Th>Customer</Th>
              <Th>Product</Th><Th>Board Type</Th><Th>Serial No</Th><Th>Type</Th>
              <Th>Err Code</Th><Th>4M Cat</Th>
              <Th>Root Cause (Analysis)</Th>
              <Th>Tested By</Th><Th>Status</Th><Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <EmptyState message="No root cause records found." /> :
              paginated.map(({ row, p }, i) => (
                <React.Fragment key={`${row.id}-${p._pid}`}>
                  <tr className="hover:bg-amber-50/20 transition-colors">
                    <Td cls="text-center font-semibold">{(currentPage - 1) * rowsPerPage + i + 1}</Td>
                    <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                    <Td cls="font-semibold"><div className="break-words whitespace-normal min-w-[8vw]" title={row.customerName}>{row.customerName || "—"}</div></Td>
                    <Td><div className="break-words whitespace-normal min-w-[10vw]" title={p.productDescription}>{p.productDescription || "—"}</div></Td>
                    <Td>{p.boardType || "—"}</Td>
                    <Td cls="font-mono text-slate-500">{p.serialNumber || "—"}</Td>
                    <Td>
                      <span className={`px-[0.5vw] py-[0.1vw] rounded text-[0.62vw] font-semibold uppercase ${p.type === "W" ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                        {p.type === "W" ? "Warranty" : "Paid"}
                      </span>
                    </Td>
                    <Td><span className="bg-slate-50 px-[0.4vw] rounded font-semibold text-slate-900">{p.report?.errorCode || "—"}</span></Td>
                    <Td><span className="bg-amber-50 px-[0.4vw] rounded font-semibold text-amber-700">{p.report?.fourMCategory || "—"}</span></Td>
                    <Td><div className="break-words whitespace-normal text-[0.68vw] font-semibold text-amber-900 min-w-[11vw] italic leading-tight">"{p.report?.rootCause || "—"}"</div></Td>
                    <Td cls="font-semibold text-slate-700">{p.report?.testedBy || "—"}</Td>
                    <Td><StatusBadge status={p.report?.status} /></Td>
                    <Td cls="text-center">
                      <button type="button"
                        onClick={() => setExpanded(expanded === `${row.id}-${p._pid}` ? null : `${row.id}-${p._pid}`)}
                        className={`p-[0.2vw] rounded-[0.4vw] cursor-pointer transition-all ${expanded === `${row.id}-${p._pid}` ? "bg-amber-100 text-amber-900" : "text-amber-600 hover:bg-amber-50"}`}
                      >
                        {expanded === `${row.id}-${p._pid}` ? <ChevronUp className="w-[1vw] h-[1vw]" /> : <ChevronDown className="w-[1vw] h-[1vw]" />}
                      </button>
                    </Td>
                  </tr>
                  {expanded === `${row.id}-${p._pid}` && (
                    <tr className="bg-amber-50/40 animate-in fade-in slide-in-from-top-1">
                      <td colSpan={13} className="px-[1.5vw] py-[1vw] border-b border-amber-200 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-[1.2vw]">
                          <ExpandDetail label="Reported Problem" value={p.report?.problemDescription} color="orange" />
                          <ExpandDetail label="Root Cause (Full)" value={p.report?.rootCause} color="amber" />
                          <ExpandDetail label="Parts / Factors" value={p.report?.partsReplacement} color="yellow" />
                          <div className="md:col-span-2">
                            {p.report?.history && p.report.history.length > 0 && (
                              <div>
                                <div className="text-[0.65vw] font-black text-amber-700 mb-[0.5vw] uppercase tracking-wider flex items-center gap-[0.4vw]">
                                  <Clock className="w-[0.8vw] h-[0.8vw]" /> RCA Audit Trail
                                </div>
                                <div className="flex gap-[0.4vw] overflow-x-auto pb-[0.5vw] scrollbar-thin scrollbar-thumb-amber-200">
                                  {p.report.history.slice().reverse().map((h, hi) => (
                                    <div key={hi} className="bg-white border border-amber-200 rounded-[0.5vw] p-[0.4vw] min-w-[6vw] flex-shrink-0 shadow-sm">
                                      <div className="text-[0.62vw] font-bold text-amber-700">{h.status}</div>
                                      <div className="text-[0.65vw] text-slate-600 truncate">{h.remark || "No remark"}</div>
                                      <div className="text-[0.6vw] text-slate-400 mt-[0.2vw]">{new Date(h.timestamp).toLocaleDateString("en-GB")}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            }
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
          { label: "Total RCA", value: rows.length, color: "text-amber-800" },
          { label: "Warranty", value: rows.filter(({ p }) => p.type === "W").length, color: "text-emerald-800" },
          { label: "Paid", value: rows.filter(({ p }) => p.type === "PW").length, color: "text-slate-800" },
          { label: "Filtered", value: filtered.length, color: "text-black" },
        ]} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REPORT 4 — Corrective Action
// ═══════════════════════════════════════════════════════════════
const CorrectiveActionReport = ({ entries, fromDate, setFromDate, toDate, setToDate }) => {
  const [search, setSearch] = useState("");
  const [filterVerify, setFilterVerify] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const rows = useMemo(() => {
    const flat = [];
    entries.forEach((row) => {
      (row.products || []).forEach((p) => {
        if (p.report?.correctiveAction) {
          flat.push({ row, p });
        }
      });
    });
    return flat;
  }, [entries]);

  const filtered = useMemo(() => {
    let data = rows;
    if (filterVerify === "Completed") data = data.filter(({ p }) => p.report?.status === "Completed");
    if (filterVerify === "Pending") data = data.filter(({ p }) => p.report?.status !== "Completed");
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(({ row, p }) =>
        row.customerName?.toLowerCase().includes(s) ||
        p.productDescription?.toLowerCase().includes(s) ||
        p.report?.correctiveAction?.toLowerCase().includes(s) ||
        p.report?.testedBy?.toLowerCase().includes(s) ||
        p.report?.fourMCategory?.toLowerCase().includes(s) ||
        p.report?.errorCode?.toLowerCase().includes(s)
      );
    }
    return data;
  }, [rows, search, filterVerify]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search, filterVerify]);

  const downloadPdf = () => {
    exportToPDF({
      tableId: "table-corrective",
      filename: `Corrective_Action_${filterVerify}`,
      title: "Corrective Action & Verification Report",
      filters: { Verification: filterVerify, Search: search, From: fromDate, To: toDate }
    });
  };

  const exportCsv = () => {
    const data = filtered.map(({ row, p }, i) => ({
      "S.No": i + 1,
      "Date": fmtDate(row.date),
      "Customer": row.customerName,
      "Product": p.productDescription,
      "Board Type": p.boardType,
      "Serial No": p.serialNumber,
      "Type": p.type === "W" ? "Warranty" : "Paid",
      "4M Cat": p.report?.fourMCategory,
      "Err Code": p.report?.errorCode,
      "Root Cause": p.report?.rootCause,
      "Corrective Action": p.report?.correctiveAction,
      "Parts Replaced": p.report?.partsReplacement,
      "Implemented By": p.report?.testedBy,
      "Comp. Date": fmtDate(p.report?.completedDate),
      "Verification": p.report?.status
    }));
    exportToExcel({ data, filename: `Corrective_Action_${filterVerify}` });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between mb-[0.8vw] gap-[0.6vw] flex-wrap">
        <div className="flex items-center gap-[0.5vw]">
          {["All", "Completed", "Pending"].map((v) => (
            <button key={v} type="button"
              onClick={() => setFilterVerify(v)}
              className={`px-[0.8vw] py-[0.3vw] rounded-full text-[0.7vw] border font-bold cursor-pointer transition-all ${filterVerify === v ? "bg-teal-800 text-white border-teal-800 shadow-sm" : "bg-white text-black border-slate-300 hover:border-teal-400"
                }`}
            >{v}</button>
          ))}
        </div>
        <div className="flex items-center gap-[0.5vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions..."
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-teal-500 text-[0.75vw] w-[11vw] text-black font-medium"
            />
          </div>
          <DateRangeFilter from={fromDate} setFrom={setFromDate} to={toDate} setTo={setToDate} />
          <ExportButtons color="teal" onCsv={exportCsv} onPdf={downloadPdf} />
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-[0.5vw] border border-slate-300 shadow-sm relative">
        <table id="table-corrective" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-teal-50">
            <tr>
              <Th>S.No</Th><Th cls="min-w-[6vw]">Date</Th><Th>Customer</Th>
              <Th>Product</Th><Th>Board Type</Th><Th>Serial No</Th><Th>Type</Th>
              <Th>4M Cat</Th><Th>Err Code</Th>
              <Th>Root Cause Summary</Th><Th>Corrective Action Taken</Th>
              <Th>Parts Replaced</Th><Th>Implemented By</Th>
              <Th>Comp. Date</Th><Th>Verification</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <EmptyState message="No corrective action records found." /> :
              paginated.map(({ row, p }, i) => (
                <tr key={`${row.id}-${p._pid}`} className="hover:bg-teal-50/20 transition-colors">
                  <Td cls="text-center font-semibold">{(currentPage - 1) * rowsPerPage + i + 1}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                  <Td cls="font-semibold"><div className="break-words whitespace-normal min-w-[8vw]" title={row.customerName}>{row.customerName || "—"}</div></Td>
                  <Td><div className="break-words whitespace-normal min-w-[10vw]" title={p.productDescription}>{p.productDescription || "—"}</div></Td>
                  <Td>{p.boardType || "—"}</Td>
                  <Td cls="font-mono">{p.serialNumber || "—"}</Td>
                  <Td>
                    <span className={`px-[0.5vw] py-[0.1vw] rounded text-[0.62vw] font-semibold uppercase ${p.type === "W" ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                      {p.type === "W" ? "Warranty" : "Paid"}
                    </span>
                  </Td>
                  <Td><span className="bg-amber-50 px-[0.4vw] rounded font-semibold text-amber-700">{p.report?.fourMCategory || "—"}</span></Td>
                  <Td><span className="bg-slate-50 px-[0.4vw] rounded font-semibold text-black">{p.report?.errorCode || "—"}</span></Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] text-black min-w-[12vw] italic leading-tight">"{p.report?.rootCause || "—"}"</div></Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] font-semibold text-blue-700 min-w-[12vw] leading-tight">"{p.report?.correctiveAction || "—"}"</div></Td>
                  <Td>{p.report?.partsReplacement || "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-[0.4vw]">
                      {p.report?.testedBy && (
                        <div className="w-[1.4vw] h-[1.4vw] rounded-full bg-teal-600 flex items-center justify-center text-[0.55vw] font-semibold text-white shadow-sm">
                          {p.report.testedBy.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[0.72vw] font-semibold text-black">{p.report?.testedBy || "—"}</span>
                    </div>
                  </Td>
                  <Td cls="min-w-[6vw]">{fmtDate(p.report?.completedDate)}</Td>
                  <Td>
                    {p.report?.status === "Completed" ? (
                      <span className="flex items-center gap-[0.3vw] text-[0.65vw] font-semibold text-green-700 bg-green-50 px-[0.4vw] py-[0.1vw] rounded-full border border-green-200">
                        <CheckCircle2 className="w-[0.85vw] h-[0.85vw]" /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-[0.3vw] text-[0.65vw] font-semibold text-orange-600 bg-orange-50 px-[0.4vw] py-[0.1vw] rounded-full border border-orange-200">
                        <Clock className="w-[0.85vw] h-[0.85vw]" /> Pending
                      </span>
                    )}
                  </Td>
                </tr>
              ))
            }
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
          { label: "Total Actions", value: rows.length, color: "text-teal-700" },
          { label: "Verified", value: rows.filter(({ p }) => p.report?.status === "Completed").length, color: "text-green-700" },
          { label: "Pending", value: rows.filter(({ p }) => p.report?.status !== "Completed").length, color: "text-orange-600" },
          { label: "Parts Replaced", value: rows.filter(({ p }) => p.report?.partsReplacement).length, color: "text-blue-700" },
        ]} />
      </div>
    </div>
  );
};

// ── Shared sub-components ────────────────────────────────────

const ExportButtons = ({ onCsv, onPdf, color = "blue" }) => {
  const btnCls = {
    blue: "border-blue-200 text-blue-800 hover:bg-blue-50",
    green: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
    amber: "border-amber-200 text-amber-800 hover:bg-amber-50",
    teal: "border-teal-200 text-teal-800 hover:bg-teal-50",
  }[color] || "border-slate-300 text-black hover:bg-slate-50";

  return (
    <div className="flex items-center gap-[0.4vw]">
      <button type="button" onClick={onCsv}
        className={`flex items-center gap-[0.35vw] px-[0.8vw] h-[2.2vw] border rounded-[0.4vw] text-[0.72vw] font-semibold cursor-pointer transition-all ${btnCls}`}
      >
        <FileSpreadsheet className="w-[0.9vw] h-[0.9vw]" />Export Excel
      </button>
      <button type="button" onClick={onPdf}
        className={`flex items-center gap-[0.35vw] px-[0.8vw] h-[2.2vw] border rounded-[0.4vw] text-[0.72vw] font-semibold cursor-pointer transition-all ${btnCls}`}
      >
        <Download className="w-[0.9vw] h-[0.9vw]" />Export PDF
      </button>
    </div>
  );
};

const SummaryBar = ({ items }) => (
  <div className="flex items-center gap-[1.5vw] mt-[0.8vw] px-[0.5vw]">
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-[0.4vw]">
        <span className="text-[0.7vw] text-black font-semibold">{it.label}:</span>
        <span className={`text-[0.82vw] font-semibold ${it.color}`}>{it.value}</span>
      </div>
    ))}
  </div>
);

const DateRangeFilter = ({ from, setFrom, to, setTo }) => (
  <div className="flex items-center gap-[0.4vw] bg-white p-[0.2vw] px-[0.6vw] rounded-[0.5vw] border border-slate-300 shadow-sm h-[2.2vw]">
    <Calendar className="w-[0.9vw] h-[0.9vw] text-black" />
    <div className="flex items-center gap-[0.2vw]">
      <input 
        type="date" 
        value={from} 
        onChange={(e) => setFrom(e.target.value)}
        className="bg-transparent text-slate-700 text-[0.7vw] outline-none cursor-pointer"
      />
      <span className="text-slate-400 text-[0.7vw] mx-[0.1vw]">to</span>
      <input 
        type="date" 
        value={to} 
        onChange={(e) => setTo(e.target.value)}
        className="bg-transparent text-slate-700 text-[0.7vw] outline-none cursor-pointer"
      />
    </div>
    {(from || to) && (
      <button 
        onClick={() => { setFrom(""); setTo(""); }}
        className="ml-[0.4vw] text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
      >
        <XCircle className="w-[0.9vw] h-[0.9vw]" />
      </button>
    )}
  </div>
);

const ExpandDetail = ({ label, value, color }) => {
  const colors = {
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
  };
  return (
    <div className={`rounded-[0.4vw] border p-[0.6vw] ${colors[color] || "bg-gray-50 border-gray-200 text-gray-800"}`}>
      <div className="text-[0.65vw] font-bold uppercase tracking-wider mb-[0.3vw] opacity-70">{label}</div>
      <div className="text-[0.72vw] leading-relaxed">{value || <span className="opacity-40 italic">Not provided</span>}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ServiceMaterialReports() {
  const [activeTab, setActiveTab] = useState("testing");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/service-material`);
        setEntries(res.data.map(item => ({ ...item, id: item._id })));
      } catch (err) {
        console.error("Failed to fetch reports data:", err);
        setEntries(lsLoad(INWARD_KEY, []));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (!entry.date) return false;
      const d = new Date(entry.date);
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate) {
        const t = new Date(toDate);
        t.setHours(23, 59, 59, 999);
        if (d > t) return false;
      }
      return true;
    });
  }, [entries, fromDate, toDate]);

  const tab = TABS.find((t) => t.id === activeTab);
  const colors = TAB_COLORS[tab?.color || "blue"];

  return (
    <div className="w-full h-[calc(100vh-60px)] flex flex-col font-sans text-[0.85vw] bg-blue-50/30 p-[0.6vw] rounded-[1vw] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border border-slate-300 rounded-[0.8vw] shadow-sm mb-[0.8vw] overflow-hidden">
        <div className="bg-[#1e40af] px-[1.5vw] py-[1vw] flex items-center gap-[0.8vw] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-transparent pointer-events-none" />
          <div className="bg-white/15 p-[0.4vw] rounded-[0.6vw] z-10 shadow-inner">
            <BarChart2 className="w-[1.4vw] h-[1.4vw] text-white" />
          </div>
          <div className="z-10">
            <h2 className="text-[1.1vw] font-bold text-white drop-shadow-sm">Service Reports</h2>
            <p className="text-[0.65vw] text-white font-semibold ">{filteredEntries.length} Inward Entries Found</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="px-4 md:px-[1.2vw] py-2 md:py-[0.6vw] flex items-center gap-2 md:gap-[0.6vw] flex-wrap bg-blue-50/20 border-t border-slate-200">
          {TABS.map((t) => {
            const tc = TAB_COLORS[t.color];
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 md:gap-[0.5vw] px-3 md:px-[1vw] py-1.5 md:py-[0.4vw] rounded-full text-[11px] md:text-[0.7vw] font-bold border transition-all cursor-pointer select-none ${isActive ? tc.active : tc.inactive
                  }`}
              >
                <Icon className="w-3.5 h-3.5 md:w-[0.9vw] md:h-[0.9vw]" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Report Panel */}
      <div className="flex-1 bg-white border border-slate-300 rounded-xl md:rounded-[0.8vw] shadow-sm p-3 md:p-[1vw] overflow-hidden">
        {activeTab === "testing" && <TestingRepairReport entries={filteredEntries} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />}
        {activeTab === "delivery" && <DeliveryReport entries={filteredEntries} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />}
        {activeTab === "rca" && <RootCauseReport entries={filteredEntries} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />}
        {activeTab === "corrective" && <CorrectiveActionReport entries={filteredEntries} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} />}
      </div>
    </div>
  );
}