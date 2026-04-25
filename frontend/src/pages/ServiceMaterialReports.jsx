// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
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
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  }
  if (s.includes("-") && s.split("-")[0].length === 4) {
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  }
  return s;
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
  blue:   { active: "bg-blue-700 text-white border-blue-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-blue-50 hover:border-blue-400", badge: "bg-blue-100 text-blue-900" },
  green:  { active: "bg-emerald-700 text-white border-emerald-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-emerald-50 hover:border-emerald-400", badge: "bg-emerald-100 text-emerald-900" },
  amber:  { active: "bg-amber-600 text-white border-amber-600 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-amber-50 hover:border-amber-400", badge: "bg-amber-100 text-amber-900" },
  teal:   { active: "bg-teal-700 text-white border-teal-700 shadow-md", inactive: "bg-white text-black border-slate-300 hover:bg-teal-50 hover:border-teal-400", badge: "bg-teal-100 text-teal-900" },
};

// ── Status badge ─────────────────────────────────────────────
const STATUS_COLORS = {
  Pending:          "bg-orange-100 text-black border-orange-300",
  Delivered:        "bg-green-100 text-black border-green-300",
  Hold:             "bg-red-100 text-black border-red-300",
  "Not Repairable": "bg-slate-200 text-black border-slate-400",
  Completed:        "bg-green-100 text-black border-green-300",
  "Repair in Progress": "bg-blue-100 text-black border-blue-300",
  Open:             "bg-slate-100 text-black border-slate-300",
  Assigned:         "bg-purple-100 text-black border-purple-300",
};

const StatusBadge = ({ status }) => (
  <span className={`px-[0.55vw] py-[0.1vw] rounded-full text-[0.65vw] font-medium whitespace-pre border ${STATUS_COLORS[status] || "bg-slate-100 text-black border-slate-300"}`}>
    {status || "—"}
  </span>
);

// ── Empty state ──────────────────────────────────────────────
const EmptyState = ({ message }) => (
  <tr>
    <td colSpan={20} className="py-[3vw] text-center">
      <div className="flex flex-col items-center gap-[0.6vw] text-black/60">
        <FileText className="w-[2.5vw] h-[2.5vw]" />
        <span className="text-[0.8vw] font-medium">{message}</span>
      </div>
    </td>
  </tr>
);

// ── Export helpers ────────────────────────────────────────────
const escCsv = (v) => {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (rows, headers, filename) => {
  const lines = [headers.join(","), ...rows.map((r) => r.map(escCsv).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
};

const downloadPdf = (tableId, title) => {
  const content = document.getElementById(tableId);
  if (!content) return;
  const w = window.open("", "_blank");
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
      h2 { font-size: 15px; margin-bottom: 12px; color: #1e3a5f; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { border: 1px solid #e5e7eb; padding: 5px 8px; }
      tr:nth-child(even) { background: #f8fafc; }
      .meta { color: #000000; margin-bottom: 8px; font-size: 10px; }
    </style></head><body>
    <h2>${title}</h2>
    <p class="meta">Generated: ${new Date().toLocaleString()}</p>
    ${content.outerHTML}
    </body></html>
  `);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 500);
};

// ── Th helper ────────────────────────────────────────────────
const Th = ({ children, cls = "" }) => (
  <th className={`px-[0.7vw] py-[0.55vw] text-[0.75vw] text-black font-medium! whitespace-nowrap border-b-2 border-r border-slate-300 last:border-r-0 bg-blue-50/50 ${cls}`}>
    {children}
  </th>
);
const Td = ({ children, cls = "" }) => (
  <td className={`px-[0.7vw] py-[0.55vw] text-[0.75vw]  border-r border-b border-slate-200 last:border-r-0 align-middle ${cls}`}>
    {children}
  </td>
);

// ═══════════════════════════════════════════════════════════════
// REPORT 1 — Service Testing / Repair Report
// ═══════════════════════════════════════════════════════════════
const TestingRepairReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

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

  const statuses = ["All", "Repair in Progress", "Completed", "Not Repairable", "Open"];

  const exportCsv = () => {
    const headers = ["S.No","Date","Customer","Ref (Customer)","Product","Board Type","Serial No","Type","Tested By","Completed Date","4M Category","Error Code","Problem Identified","Root Cause","Corrective Action","Parts Replaced","Status"];
    const data = filtered.map(({ row, p }, i) => [
      i+1, fmtDate(row.date), row.customerName, row.refNoCustomer,
      p.productDescription, p.boardType, p.serialNumber, p.type === "W" ? "Warranty" : "Paid",
      p.report?.testedBy, fmtDate(p.report?.completedDate),
      p.report?.fourMCategory, p.report?.errorCode,
      p.report?.problemDescription, p.report?.rootCause, p.report?.correctiveAction,
      p.report?.partsReplacement, p.report?.status,
    ]);
    downloadCsv(data, headers, "Service_Testing_Repair_Report.csv");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-[0.8vw] gap-[0.6vw] flex-wrap">
        <div className="flex items-center gap-[0.5vw] flex-wrap">
          {statuses.map((s) => (
            <button key={s} type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-[0.8vw] py-[0.3vw] rounded-full text-[0.7vw] border cursor-pointer transition-all ${
                filterStatus === s ? "bg-blue-700 text-white border-blue-700 shadow-sm" : "bg-white text-black border-slate-300 hover:border-blue-400"
              }`}
            >{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-[0.5vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black/60" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-slate-500 text-[0.75vw] w-[14vw] text-black"
            />
          </div>
          <ExportButtons onCsv={exportCsv} onPdf={() => downloadPdf("table-testing", "Service Testing / Repair Report")} />
        </div>
      </div>
      <div className="overflow-auto rounded-[0.5vw] border border-slate-300">
        <table id="table-testing" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-10">
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
              filtered.map(({ row, p }, i) => (
                <tr key={`${row.id}-${p._pid}`} className="hover:bg-gray-50/60">
                  <Td cls="text-center">{i+1}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                  <Td cls="font-semibold">{row.customerName || "—"}</Td>
                  <Td>{row.refNoCustomer || "—"}</Td>
                  <Td><div className="break-words whitespace-normal min-w-[10vw]" title={p.productDescription}>{p.productDescription || "—"}</div></Td>
                  <Td>{p.boardType || "—"}</Td>
                  <Td>{p.serialNumber || "—"}</Td>
                  <Td>
                    <span className={`px-[0.4vw] py-[0.05vw] rounded text-[0.62vw] font-bold ${p.type === "W" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {p.type === "W" ? "Warranty" : "Paid"}
                    </span>
                  </Td>
                  <Td>{p.report?.testedBy || "—"}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(p.report?.completedDate)}</Td>
                  <Td>{p.report?.fourMCategory || "—"}</Td>
                  <Td>{p.report?.errorCode || "—"}</Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[12vw]">{p.report?.problemDescription || "—"}</div></Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[12vw]">{p.report?.rootCause || "—"}</div></Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[12vw]">{p.report?.correctiveAction || "—"}</div></Td>
                  <Td>{p.report?.partsReplacement || "—"}</Td>
                  <Td><StatusBadge status={p.report?.status} /></Td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <SummaryBar items={[
        { label: "Total Products with Reports", value: rows.length, color: "text-blue-800" },
        { label: "Completed", value: rows.filter(({p}) => p.report?.status === "Completed").length, color: "text-emerald-800" },
        { label: "In Progress", value: rows.filter(({p}) => p.report?.status === "Repair in Progress").length, color: "text-blue-700" },
        { label: "Not Repairable", value: rows.filter(({p}) => p.report?.status === "Not Repairable").length, color: "text-red-700" },
      ]} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REPORT 2 — Delivery Report & Delay / TAT Analysis
// ═══════════════════════════════════════════════════════════════
const DeliveryReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

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

  const exportCsv = () => {
    const headers = ["S.No","Date Inward","Customer","Ref No.","Category","Final Status","Delivered Date","TAT (Days)","Avg Delay (Days)","Remarks"];
    const data = filtered.map(({ row, tat, avgDelay }, i) => [
      i+1, fmtDate(row.date), row.customerName, row.refNoCustomer,
      row.category, row.finalStatus, fmtDate(row.finalStatusDate),
      tat ?? "—", avgDelay ?? "—", row.finalStatusRemarks,
    ]);
    downloadCsv(data, headers, "Delivery_TAT_Report.csv");
  };

  const statuses = ["All", "Pending", "Delivered", "Hold", "Not Repairable"];
  const deliveredCount = rows.filter(({ row }) => row.finalStatus === "Delivered").length;
  const tats = rows.filter(({ tat }) => tat !== null).map(({ tat }) => tat);
  const avgTat = tats.length ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : "—";
  const delayedCount = rows.filter(({ avgDelay }) => avgDelay !== null && avgDelay > 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-[0.8vw] gap-[0.6vw] flex-wrap">
        <div className="flex items-center gap-[0.5vw] flex-wrap">
          {statuses.map((s) => (
            <button key={s} type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-[0.8vw] py-[0.3vw] rounded-full text-[0.7vw] border cursor-pointer transition-all ${
                filterStatus === s ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-black border-slate-300 hover:border-emerald-400"
              }`}
            >{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-[0.5vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-emerald-500 text-[0.75vw] w-[14vw] text-black"
            />
          </div>
          <ExportButtons color="green" onCsv={exportCsv} onPdf={() => downloadPdf("table-delivery", "Delivery Report & Delay / TAT Analysis")} />
        </div>
      </div>
      <div className="overflow-auto rounded-[0.5vw] border border-slate-300">
        <table id="table-delivery" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>S.No</Th><Th>Inward Date</Th><Th>Customer</Th>
              <Th>Ref No.</Th><Th>Category</Th><Th># Products</Th>
              <Th>Final Status</Th><Th>Delivered Date</Th>
              <Th>TAT (Days)</Th><Th>Avg Delay (Days)</Th><Th>Remarks</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <EmptyState message="No delivery records found." /> :
              filtered.map(({ row, prods, tat, avgDelay }, i) => (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <Td cls="text-center">{i+1}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                  <Td cls="font-semibold"><div className="break-words whitespace-normal min-w-[9vw]" title={row.customerName}>{row.customerName || "—"}</div></Td>
                  <Td>{row.refNoCustomer || "—"}</Td>
                  <Td>{row.category || "—"}</Td>
                  <Td cls="text-center font-bold text-blue-700">{prods.length}</Td>
                  <Td><StatusBadge status={row.finalStatus} /></Td>
                  <Td cls="min-w-[6vw]">{fmtDate(row.finalStatusDate)}</Td>
                  <Td cls={`font-bold ${tat === null ? "text-black/30" : tat <= 7 ? "text-green-700" : tat <= 14 ? "text-amber-600" : "text-red-600"}`}>
                    {tat !== null ? `${tat}d` : "—"}
                  </Td>
                  <Td cls={`font-bold ${avgDelay === null ? "text-black/30" : avgDelay <= 0 ? "text-green-700" : avgDelay <= 3 ? "text-amber-600" : "text-red-600"}`}>
                    {avgDelay !== null ? (avgDelay > 0 ? `+${avgDelay}d` : avgDelay === 0 ? "On time" : `${avgDelay}d early`) : "—"}
                  </Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[10vw]" title={row.finalStatusRemarks}>{row.finalStatusRemarks || "—"}</div></Td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <SummaryBar items={[
        { label: "Total Entries", value: rows.length, color: "text-black" },
        { label: "Delivered", value: deliveredCount, color: "text-emerald-800" },
        { label: "Avg TAT", value: avgTat !== "—" ? `${avgTat} days` : "—", color: "text-slate-800" },
        { label: "Delayed", value: delayedCount, color: "text-red-700" },
      ]} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REPORT 3 — Root Cause Analysis
// ═══════════════════════════════════════════════════════════════
const RootCauseReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

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

  const exportCsv = () => {
    const headers = ["S.No","Date","Customer","Ref No.","Product","Board Type","Serial No","Type","4M Category","Error Code","Problem Identified","Root Cause","Contributing Factors","Tested By","Report Status"];
    const data = filtered.map(({ row, p }, i) => [
      i+1, fmtDate(row.date), row.customerName, row.refNoCustomer,
      p.productDescription, p.boardType, p.serialNumber, p.type === "W" ? "Warranty" : "Paid",
      p.report?.fourMCategory, p.report?.errorCode,
      p.report?.problemDescription, p.report?.rootCause,
      p.report?.partsReplacement, p.report?.testedBy, p.report?.status,
    ]);
    downloadCsv(data, headers, "Root_Cause_Analysis_Report.csv");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-[0.8vw]">
        <div className="flex items-center gap-[0.5vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search root causes, products…"
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-amber-500 text-[0.75vw] w-[18vw] text-black"
            />
          </div>
          <span className="text-[0.72vw] text-black/70 font-medium">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <ExportButtons color="amber" onCsv={exportCsv} onPdf={() => downloadPdf("table-rca", "Root Cause Analysis Report")} />
      </div>
      <div className="overflow-auto rounded-[0.5vw] border border-slate-300">
        <table id="table-rca" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>S.No</Th><Th cls="min-w-[6vw]">Date</Th><Th>Customer</Th>
              <Th>Product</Th><Th>Board Type</Th><Th>Serial No</Th><Th>Type</Th>
              <Th>4M Cat</Th><Th>Err Code</Th>
              <Th>Problem Identified</Th><Th>Root Cause</Th>
              <Th>Tested By</Th><Th>Status</Th><Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <EmptyState message="No root cause records found." /> :
              filtered.map(({ row, p }, i) => (
                <>
                  <tr key={`${row.id}-${p._pid}`} className="hover:bg-amber-50/30">
                    <Td cls="text-center">{i+1}</Td>
                    <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                    <Td cls="font-semibold"><div className="break-words whitespace-normal min-w-[8vw]" title={row.customerName}>{row.customerName || "—"}</div></Td>
                    <Td><div className="break-words whitespace-normal min-w-[10vw]" title={p.productDescription}>{p.productDescription || "—"}</div></Td>
                    <Td>{p.boardType || "—"}</Td>
                    <Td>{p.serialNumber || "—"}</Td>
                    <Td>
                      <span className={`px-[0.4vw] py-[0.05vw] rounded text-[0.62vw] font-bold ${p.type === "W" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {p.type === "W" ? "Warranty" : "Paid"}
                      </span>
                    </Td>
                    <Td><div className="break-words whitespace-normal text-[0.68vw] min-w-[11vw]">{p.report?.problemDescription || "—"}</div></Td>
                    <Td>{p.report?.fourMCategory || "—"}</Td>
                    <Td>{p.report?.errorCode || "—"}</Td>
                    <Td><div className="break-words whitespace-normal text-[0.68vw] font-semibold text-amber-800 min-w-[11vw]">{p.report?.rootCause || "—"}</div></Td>
                    <Td>{p.report?.testedBy || "—"}</Td>
                    <Td><StatusBadge status={p.report?.status} /></Td>
                    <Td cls="text-center">
                      <button type="button"
                        onClick={() => setExpanded(expanded === `${row.id}-${p._pid}` ? null : `${row.id}-${p._pid}`)}
                        className="text-amber-700 hover:text-amber-900 cursor-pointer flex items-center gap-[0.2vw] mx-auto text-[0.7vw] font-bold"
                      >
                        {expanded === `${row.id}-${p._pid}` ? <ChevronUp className="w-[0.9vw] h-[0.9vw]" /> : <ChevronDown className="w-[0.9vw] h-[0.9vw]" />}
                        {expanded === `${row.id}-${p._pid}` ? "Hide" : "View"}
                      </button>
                    </Td>
                  </tr>
                  {expanded === `${row.id}-${p._pid}` && (
                    <tr key={`exp-${row.id}-${p._pid}`} className="bg-amber-50/40">
                      <td colSpan={11} className="px-[1.5vw] py-[1vw] border-b border-gray-200">
                        <div className="grid grid-cols-5 gap-[1.2vw]">
                          <ExpandDetail label="Full Problem Description" value={p.report?.problemDescription} color="orange" />
                          <ExpandDetail label="4M Category" value={p.report?.fourMCategory} color="amber" />
                          <ExpandDetail label="Error Code" value={p.report?.errorCode} color="amber" />
                          <ExpandDetail label="Root Cause (Full)" value={p.report?.rootCause} color="amber" />
                          <ExpandDetail label="Parts / Factors Involved" value={p.report?.partsReplacement} color="yellow" />
                        </div>
                        {p.report?.history && p.report.history.length > 0 && (
                          <div className="mt-[0.8vw]">
                            <div className="text-[0.7vw] font-bold text-amber-700 mb-[0.4vw] uppercase tracking-wider">History Trail</div>
                            <div className="flex gap-[0.8vw] overflow-x-auto">
                              {p.report.history.slice().reverse().map((h, hi) => (
                                <div key={hi} className="bg-white border border-amber-200 rounded-[0.4vw] p-[0.5vw] min-w-[10vw] flex-shrink-0">
                                  <div className="text-[0.62vw] font-bold text-amber-700 mb-[0.2vw]">{h.status}</div>
                                  <div className="text-[0.65vw] text-black/70">{h.remark || "No remark"}</div>
                                  <div className="text-[0.6vw] text-black/70 mt-[0.2vw]">{new Date(h.timestamp).toLocaleDateString("en-GB")}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            }
          </tbody>
        </table>
      </div>
      <SummaryBar items={[
        { label: "Total RCA Records", value: rows.length, color: "text-amber-800" },
        { label: "Warranty Cases", value: rows.filter(({p}) => p.type === "W").length, color: "text-emerald-800" },
        { label: "Paid Cases", value: rows.filter(({p}) => p.type === "PW").length, color: "text-slate-800" },
        { label: "Showing", value: filtered.length, color: "text-black" },
      ]} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// REPORT 4 — Corrective Action
// ═══════════════════════════════════════════════════════════════
const CorrectiveActionReport = ({ entries }) => {
  const [search, setSearch] = useState("");
  const [filterVerify, setFilterVerify] = useState("All");

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

  const exportCsv = () => {
    const headers = ["S.No","Date","Customer","Ref No.","Product","Board Type","Serial No","Type","4M Category","Error Code","Root Cause","Corrective Action Taken","Parts Replaced","Implemented By","Completed Date","Verification Status"];
    const data = filtered.map(({ row, p }, i) => [
      i+1, fmtDate(row.date), row.customerName, row.refNoCustomer,
      p.productDescription, p.boardType, p.serialNumber, p.type === "W" ? "Warranty" : "Paid",
      p.report?.fourMCategory, p.report?.errorCode,
      p.report?.rootCause, p.report?.correctiveAction, p.report?.partsReplacement,
      p.report?.testedBy, fmtDate(p.report?.completedDate), p.report?.status,
    ]);
    downloadCsv(data, headers, "Corrective_Action_Report.csv");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-[0.8vw] gap-[0.6vw] flex-wrap">
        <div className="flex items-center gap-[0.5vw]">
          {["All","Completed","Pending"].map((v) => (
            <button key={v} type="button"
              onClick={() => setFilterVerify(v)}
              className={`px-[0.8vw] py-[0.3vw] rounded-full text-[0.7vw] border cursor-pointer transition-all ${
                filterVerify === v ? "bg-teal-800 text-white border-teal-800" : "bg-white text-black border-slate-300 hover:border-teal-400"
              }`}
            >{v}</button>
          ))}
        </div>
        <div className="flex items-center gap-[0.5vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions, products…"
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-300 rounded-[0.5vw] focus:outline-none focus:border-teal-500 text-[0.75vw] w-[16vw] text-black"
            />
          </div>
          <ExportButtons color="teal" onCsv={exportCsv} onPdf={() => downloadPdf("table-corrective", "Corrective Action Report")} />
        </div>
      </div>
      <div className="overflow-auto rounded-[0.5vw] border border-slate-300">
        <table id="table-corrective" className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-10">
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
              filtered.map(({ row, p }, i) => (
                <tr key={`${row.id}-${p._pid}`} className="hover:bg-teal-50/20">
                  <Td cls="text-center">{i+1}</Td>
                  <Td cls="min-w-[6vw]">{fmtDate(row.date)}</Td>
                  <Td cls="font-semibold"><div className="break-words whitespace-normal min-w-[8vw]" title={row.customerName}>{row.customerName || "—"}</div></Td>
                  <Td><div className="break-words whitespace-normal min-w-[10vw]" title={p.productDescription}>{p.productDescription || "—"}</div></Td>
                  <Td>{p.boardType || "—"}</Td>
                  <Td>{p.serialNumber || "—"}</Td>
                  <Td>
                    <span className={`px-[0.4vw] py-[0.05vw] rounded text-[0.62vw] font-bold ${p.type === "W" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                      {p.type === "W" ? "Warranty" : "Paid"}
                    </span>
                  </Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] text-amber-800 min-w-[10vw]">{p.report?.rootCause || "—"}</div></Td>
                  <Td>{p.report?.fourMCategory || "—"}</Td>
                  <Td>{p.report?.errorCode || "—"}</Td>
                  <Td><div className="break-words whitespace-normal text-[0.68vw] font-semibold text-teal-800 min-w-[12vw]">{p.report?.correctiveAction || "—"}</div></Td>
                  <Td>{p.report?.partsReplacement || "—"}</Td>
                  <Td>
                    <div className="flex items-center gap-[0.4vw]">
                      {p.report?.testedBy && (
                        <div className="w-[1.4vw] h-[1.4vw] rounded-full bg-teal-100 flex items-center justify-center text-[0.55vw] font-bold text-teal-700">
                          {p.report.testedBy.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[0.72vw]">{p.report?.testedBy || "—"}</span>
                    </div>
                  </Td>
                  <Td cls="min-w-[6vw]">{fmtDate(p.report?.completedDate)}</Td>
                  <Td>
                    {p.report?.status === "Completed" ? (
                      <span className="flex items-center gap-[0.3vw] text-[0.65vw] font-bold text-green-700">
                        <CheckCircle2 className="w-[0.85vw] h-[0.85vw]" /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-[0.3vw] text-[0.65vw] font-bold text-orange-600">
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
      <SummaryBar items={[
        { label: "Total Actions", value: rows.length, color: "text-teal-700" },
        { label: "Verified / Completed", value: rows.filter(({p}) => p.report?.status === "Completed").length, color: "text-green-700" },
        { label: "Pending Verification", value: rows.filter(({p}) => p.report?.status !== "Completed").length, color: "text-orange-600" },
        { label: "Parts Replaced", value: rows.filter(({p}) => p.report?.partsReplacement).length, color: "text-blue-700" },
      ]} />
    </div>
  );
};

// ── Shared sub-components ────────────────────────────────────

const ExportButtons = ({ onCsv, onPdf, color = "blue" }) => {
  const btnCls = {
    blue:  "border-blue-200 text-blue-800 hover:bg-blue-50",
    green: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
    amber: "border-amber-200 text-amber-800 hover:bg-amber-50",
    teal:  "border-teal-200 text-teal-800 hover:bg-teal-50",
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
        <span className="text-[0.7vw] text-black font-medium">{it.label}:</span>
        <span className={`text-[0.82vw] font-bold ${it.color}`}>{it.value}</span>
      </div>
    ))}
  </div>
);

const ExpandDetail = ({ label, value, color }) => {
  const colors = {
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    amber:  "bg-amber-50 border-amber-200 text-amber-800",
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_URL}/service-material`);
        setEntries(res.data.map(item => ({ ...item, id: item._id })));
      } catch (err) {
        console.error("Failed to fetch reports data:", err);
        setEntries(lsLoad(INWARD_KEY, []));
      }
    };
    fetchData();
  }, []);

  const tab = TABS.find((t) => t.id === activeTab);
  const colors = TAB_COLORS[tab?.color || "blue"];

  return (
    <div className="w-full h-full font-sans text-[0.85vw] bg-blue-50/30 p-[0.5vw] rounded-[0.8vw]">
      {/* Header */}
      <div className="bg-white border border-slate-300 rounded-[0.6vw] shadow-sm mb-[0.9vw] overflow-hidden">
        <div className="bg-[#1e40af] px-[1.5vw] py-[1.2vw] flex items-center gap-[0.8vw] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-transparent pointer-events-none" />
          <div className="bg-white/15 p-[0.4vw] rounded-[0.5vw] z-10 shadow-inner">
            <BarChart2 className="w-[1.3vw] h-[1.3vw] text-white" />
          </div>
          <div className="z-10">
            <h2 className="text-[1.05vw] font-black text-white uppercase tracking-widest drop-shadow-sm">Service Reports</h2>
            <p className="text-[0.72vw] text-white opacity-100 ">{entries.length} total inward entries · Select a report below</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="px-[1.2vw] py-[0.9vw] flex items-center gap-[0.6vw] flex-wrap bg-blue-50/30 border-t border-slate-200">
          {TABS.map((t) => {
            const tc = TAB_COLORS[t.color];
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-[0.5vw] px-[1.2vw] py-[0.55vw] rounded-[0.5vw] border text-[0.78vw] font-semibold cursor-pointer transition-all duration-150 select-none ${
                  isActive ? tc.active : tc.inactive
                }`}
              >
                <Icon className="w-[0.95vw] h-[0.95vw]" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Report Panel */}
      <div className="bg-white border border-slate-300 rounded-[0.6vw] shadow-md p-[1.2vw]">
        <div className="flex items-center gap-[0.7vw] mb-[1vw] pb-[0.8vw] border-b border-blue-100">
          {tab && <tab.icon className={`w-[1.2vw] h-[1.2vw] ${
            tab.color === "blue" ? "text-blue-700" :
            tab.color === "green" ? "text-emerald-700" :
            tab.color === "amber" ? "text-amber-700" : "text-teal-700"
          }`} />}
          <h3 className="text-[0.95vw] font-bold text-black">{tab?.label}</h3>
        </div>

        {activeTab === "testing"    && <TestingRepairReport entries={entries} />}
        {activeTab === "delivery"   && <DeliveryReport entries={entries} />}
        {activeTab === "rca"        && <RootCauseReport entries={entries} />}
        {activeTab === "corrective" && <CorrectiveActionReport entries={entries} />}
      </div>
    </div>
  );
}