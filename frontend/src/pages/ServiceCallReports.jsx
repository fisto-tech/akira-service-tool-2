import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useNotification } from "../components/NotificationContext";
import {
  FileText,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Users,
  Briefcase,
  Layers,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const API_URL = import.meta.env.VITE_API_URL;

const getTodayStr = () => new Date().toISOString().split("T")[0];

const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const exportToPDF = (title, headers, data, filename, dateRangeStr) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175);
  doc.text(title, 10, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Report Period: ${dateRangeStr}`, 10, 22);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, 27);

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: data,
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 2, font: 'helvetica', textColor: 50, lineColor: [200, 200, 200], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 30, left: 10, right: 10 },
  });
  doc.save(`${filename}.pdf`);
};

const exportToExcel = ({ data, filename }) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

const DateRangeFilter = ({ from, setFrom, to, setTo }) => (
  <div className="flex items-center gap-[0.4vw] bg-white p-[0.1vw] rounded-[0.5vw] border border-slate-400 shadow-sm">
    <div className="flex items-center gap-[0.3vw] px-[0.6vw] border-r border-slate-400">
      <Calendar className="w-[0.8vw] h-[0.8vw] text-black/40" />
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
        className="text-[0.72vw] font-semibold outline-none bg-transparent h-[1.8vw] w-[6.5vw] cursor-pointer text-black" />
    </div>
    <div className="flex items-center gap-[0.3vw] px-[0.6vw]">
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
        className="text-[0.72vw] font-semibold outline-none bg-transparent h-[1.8vw] w-[6.5vw] cursor-pointer text-black" />
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const colors = {
    Resolved: "bg-green-100 text-green-700 border-green-200",
    Pending: "bg-orange-100 text-orange-700 border-orange-200",
    Open: "bg-amber-100 text-amber-700 border-amber-200",
    Registered: "bg-blue-100 text-blue-700 border-blue-200",
    Critical: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`px-[0.55vw] py-[0.1vw] rounded-full text-[0.75vw] font-semibold border ${colors[status] || "bg-slate-50 text-black border-slate-400"}`}>
      {status || "—"}
    </span>
  );
};

const Th = ({ children, cls = "" }) => (
  <th className={`px-[0.8vw] py-[0.7vw] text-[0.85vw] text-black font-bold whitespace-nowrap border-b-2 border-r border-slate-400 last:border-r-0 bg-blue-50/50 ${cls}`}>
    {children}
  </th>
);

const Td = ({ children, cls = "" }) => (
  <td className={`px-[1vw] py-[1vw] text-[0.8vw] text-black border-r border-b border-slate-400 last:border-r-0 align-middle ${cls}`}>
    {children}
  </td>
);

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) pages.push(i);
    else if (i === currentPage - 2 || i === currentPage + 2) if (!pages.includes("...")) pages.push("...");
  }
  return (
    <div className="flex items-center justify-between px-[1vw] py-[0.8vw] bg-white border-t border-slate-400">
      <div className="text-[0.7vw] text-black font-semibold uppercase">
        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
      </div>
      <div className="flex items-center gap-[0.4vw]">
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
          className="p-[0.4vw] border border-slate-400 rounded-[0.4vw] hover:bg-slate-50 disabled:opacity-30 transition-all">
          <ChevronLeft className="w-[1vw] h-[1vw] text-black" />
        </button>
        {pages.map((p, i) => (
          <button key={i} onClick={() => typeof p === 'number' && onPageChange(p)}
            className={`min-w-[2vw] h-[2vw] rounded-[0.4vw] text-[0.75vw] font-semibold border transition-all ${currentPage === p ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-black border-slate-400 hover:border-slate-400'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
          className="p-[0.4vw] border border-slate-400 rounded-[0.4vw] hover:bg-slate-50 disabled:opacity-30 transition-all">
          <ChevronRight className="w-[1vw] h-[1vw] text-black" />
        </button>
      </div>
    </div>
  );
};

const SummaryBar = ({ items }) => (
  <div className="bg-black px-[1.5vw] py-[1vw] flex items-center gap-[2.5vw] rounded-b-[0.75vw] rounded-t-[0.75vw]">
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-[0.8vw]">
        <div className="w-[2vw] h-[2vw] rounded-full bg-white/10 flex items-center justify-center border border-white/20">
          <Layers className="w-[1vw] h-[1vw] text-white" />
        </div>
        <div>
          <span className="block text-[0.55vw] text-white uppercase font-semibold tracking-widest">{it.label}</span>
          <span className="text-[1vw] font-semibold text-white leading-tight">{it.value}</span>
        </div>
      </div>
    ))}
  </div>
);

const ExportButtons = ({ onCsv, onPdf, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700 border-blue-800",
    green: "bg-emerald-600 hover:bg-emerald-700 border-emerald-800",
    amber: "bg-amber-600 hover:bg-amber-700 border-amber-800",
    purple: "bg-purple-600 hover:bg-purple-700 border-purple-800"
  };
  return (
    <div className="flex items-center gap-[0.5vw]">
      <button onClick={onCsv} className="flex items-center gap-[0.4vw] px-[0.8vw] py-[0.5vw] bg-white cursor-pointer text-black border border-slate-400 rounded-[0.5vw] text-[0.72vw] font-semibold hover:bg-slate-50 transition-all active:scale-95">
        <FileSpreadsheet className="w-[0.9vw] h-[0.9vw] text-emerald-600" /> Excel
      </button>
      <button onClick={onPdf} className={`flex items-center gap-[0.4vw] px-[0.8vw] py-[0.5vw] bg-white cursor-pointer text-black border border-slate-400 rounded-[0.5vw] text-[0.72vw] font-semibold hover:bg-slate-50 transition-all active:scale-95`}>
        <Download className="w-[0.9vw] h-[0.9vw]" /> PDF Report
      </button>
    </div>
  );
};

const CallDetailsModal = ({ isOpen, onClose, employee, calls }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[2vw]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={onClose}></div>
      
      {/* Modal Container */}
      <div className="relative bg-white/95 backdrop-blur-2xl rounded-[1.2vw] w-[90vw] max-h-[85vh] flex flex-col overflow-hidden border border-white/40 shadow-[0_20px_60px_rgba(0,0,0,0.4)] shadow-blue-900/30 animate-in zoom-in-95 duration-300">
        
        {/* Premium Header */}
        <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 px-[2vw] py-[1.5vw] flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute -right-[10vw] -top-[10vw] w-[30vw] h-[30vw] bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -left-[5vw] -bottom-[5vw] w-[20vw] h-[20vw] bg-indigo-500/20 rounded-full blur-3xl"></div>
          
          <div className="flex items-center gap-[1.2vw] relative z-10">
            <div className="w-[4vw] h-[4vw] rounded-[1vw] bg-white/10 flex items-center justify-center border border-white/20 shadow-inner backdrop-blur-md">
              <User className="w-[2vw] h-[2vw] text-white" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-white text-[1.4vw] font-black tracking-tight leading-none drop-shadow-sm">{employee?.name || "Unassigned"}</h3>
              <div className="flex items-center gap-[0.8vw] mt-[0.5vw]">
                <span className="text-blue-100 text-[0.75vw] font-bold uppercase tracking-widest bg-white/10 px-[0.6vw] py-[0.2vw] rounded-full border border-white/10">{employee?.department || "N/A"}</span>
                <span className="text-emerald-300 text-[0.75vw] font-bold uppercase tracking-widest bg-emerald-500/20 px-[0.6vw] py-[0.2vw] rounded-full border border-emerald-500/30 shadow-sm">{calls.length} Calls Allocated</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 transition-all p-[0.6vw] rounded-full cursor-pointer relative z-10 hover:rotate-90 duration-300 bg-white/5 border border-white/10">
            <X className="w-[1.5vw] h-[1.5vw]" />
          </button>
        </div>
        
        {/* Table Content */}
        <div className="flex-1 overflow-auto p-[2vw] bg-slate-50/60">
          <div className="border border-slate-200 rounded-[1vw] bg-white shadow-sm overflow-hidden ring-1 ring-slate-900/5">
            <table className="w-full border-collapse">
              <thead className="bg-slate-100/80 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200">
                <tr>
                  <Th cls="text-center font-extrabold text-slate-700 py-[1vw] text-[0.75vw] border-b-0 uppercase tracking-widest bg-transparent">Call No</Th>
                  <Th cls="min-w-[8vw] text-center font-extrabold text-slate-700 py-[1vw] text-[0.75vw] border-b-0 uppercase tracking-widest bg-transparent">Date</Th>
                  <Th cls="min-w-[12vw] text-left font-extrabold text-slate-700 py-[1vw] px-[1.5vw] text-[0.75vw] border-b-0 uppercase tracking-widest bg-transparent">Customer</Th>
                  <Th cls="min-w-[16vw] text-left font-extrabold text-slate-700 py-[1vw] px-[1.5vw] text-[0.75vw] border-b-0 uppercase tracking-widest bg-transparent">Products</Th>
                  <Th cls="text-center font-extrabold text-slate-700 py-[1vw] text-[0.75vw] border-b-0 uppercase tracking-widest bg-transparent">Attended</Th>
                  <Th cls="text-center font-extrabold text-slate-700 py-[1vw] text-[0.75vw] border-b-0 uppercase tracking-widest bg-transparent">Status</Th>
                  <Th cls="text-center font-extrabold text-slate-700 py-[1vw] text-[0.75vw] border-b-0 uppercase tracking-widest bg-transparent">Priority</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-[6vw] text-slate-400 font-bold text-[1vw]">No calls allocated.</td></tr>
                ) : (
                  calls.map((call) => {
                    const isAttended = call.products?.some(p => p._attended);
                    return (
                    <tr key={call._id} className="hover:bg-slate-50/80 transition-colors group">
                      <Td cls="font-bold text-blue-600 text-center py-[1vw]">{call.callNumber}</Td>
                      <Td cls="text-center font-semibold text-slate-600 py-[1vw]">{fmtDate(call.dateTime)}</Td>
                      <Td cls="font-bold text-slate-800 text-left py-[1vw] px-[1.5vw] leading-tight">{call.customerName}</Td>
                      <Td cls="text-left py-[1vw] px-[1.5vw]">
                        <div className="flex flex-col items-start gap-[0.4vw]">
                          {call.products?.map((p, i) => (
                            <span key={i} className="text-[0.7vw] text-slate-700 font-bold px-[0.6vw] py-[0.2vw] rounded-[0.4vw] bg-white border border-slate-200 shadow-sm">
                              {p.itemDescription || p.productDescription || p.productName || p.description || p.itemCode || p.productCode || (typeof p === 'string' ? p : "Product Details Missing")} 
                              {p.serialNumber ? <span className="ml-[0.4vw] text-slate-400 font-medium">({p.serialNumber})</span> : ""}
                            </span>
                          ))}
                        </div>
                      </Td>
                      <Td cls="text-center py-[1vw]">
                        {isAttended ? (
                          <span className="inline-flex items-center justify-center w-[1.8vw] h-[1.8vw] rounded-full bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200" title="Attended"><CheckCircle className="w-[1vw] h-[1vw]" /></span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-[1.8vw] h-[1.8vw] rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200" title="Not Attended"><X className="w-[1vw] h-[1vw]" /></span>
                        )}
                      </Td>
                      <Td cls="text-center py-[1vw]"><StatusBadge status={call.status} /></Td>
                      <Td cls="text-center py-[1vw]">
                        <span className={`px-[0.6vw] py-[0.2vw] rounded-full text-[0.65vw] font-black border shadow-sm uppercase tracking-widest ${
                          call.priority === 'Critical' ? 'bg-red-50 text-red-600 border-red-200' :
                          call.priority === 'High' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>{call.priority}</span>
                      </Td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────
export default function ServiceCallReports() {
  const { toast } = useNotification();
  const [fromDate, setFromDate] = useState(getTodayStr());
  const [toDate, setToDate] = useState(getTodayStr());
  const [employees, setEmployees] = useState([]);
  const [calls, setCalls] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Modal State
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, callRes] = await Promise.all([
        axios.get(`${API_URL}/auth/employees`),
        axios.get(`${API_URL}/service-calls`),
      ]);
      setEmployees(empRes.data || []);
      setCalls(callRes.data || []);
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter calls by date range
  const filteredCalls = useMemo(() => {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    return calls.filter((call) => {
      const callDate = new Date(call.dateTime || call.createdAt);
      return callDate >= start && callDate <= end;
    });
  }, [calls, fromDate, toDate]);

  // Aggregate data per employee
  const reportData = useMemo(() => {
    // Group 1: All active employees
    const empData = employees.map((emp) => {
      const empCalls = filteredCalls.filter((call) => {
        const isMainEngineer = call.currentEngineerId === emp.userId;
        const isProductEngineer = call.products?.some(p => p._assignedEngineerId === emp.userId);
        return isMainEngineer || isProductEngineer;
      });

      const statusCounts = empCalls.reduce((acc, call) => {
        acc[call.status] = (acc[call.status] || 0) + 1;
        return acc;
      }, {});

      return {
        ...emp,
        allocatedCount: empCalls.length,
        statusCounts,
        calls: empCalls,
      };
    });

    // Group 2: Unassigned Calls
    const unassignedCalls = filteredCalls.filter((call) => {
      const isUnassigned = call.status === 'Registered' || !call.currentEngineerId;
      return isUnassigned;
    });

    return {
      employees: empData,
      unassigned: {
        name: "Unassigned / Not Allocated",
        allocatedCount: unassignedCalls.length,
        calls: unassignedCalls,
        statusCounts: unassignedCalls.reduce((acc, call) => {
          acc[call.status] = (acc[call.status] || 0) + 1;
          return acc;
        }, {}),
        isUnassignedRow: true
      }
    };
  }, [employees, filteredCalls]);

  // Final filtered list for display
  const displayRows = useMemo(() => {
    const searchLow = search.toLowerCase();
    const filteredEmps = reportData.employees.filter(emp =>
      emp.name.toLowerCase().includes(searchLow) ||
      emp.department?.toLowerCase().includes(searchLow)
    );

    filteredEmps.sort((a, b) => b.allocatedCount - a.allocatedCount);
    return filteredEmps;
  }, [reportData, search]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return displayRows.slice(startIdx, startIdx + rowsPerPage);
  }, [displayRows, currentPage]);

  const totalPages = Math.ceil(displayRows.length / rowsPerPage);

  // Reset to page 1 on search
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleViewDetails = (row) => {
    setSelectedEmp(row);
    setIsModalOpen(true);
  };

  const dateRangeStr = `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;

  const exportCsv = () => {
    const data = [];
    displayRows.forEach((row, i) => {
      // 1. Push the outer "Employee" summary row
      data.push({
        "S.No": i + 1,
        "Employee Name": row.name,
        "Department": row.department || "N/A",
        "Role": row.role || "N/A",
        "Total Allocated": row.allocatedCount,
        "Call No": "",
        "Call Date": "",
        "Customer": "",
        "Products": "",
        "Attended": "",
        "Status": "",
        "Priority": ""
      });

      // 2. Push the inside view details rows (if any allocated calls)
      if (row.calls && row.calls.length > 0) {
        row.calls.forEach((call, j) => {
          data.push({
            "S.No": `  ↳ ${j + 1}`,
            "Employee Name": "",
            "Department": "",
            "Role": "",
            "Total Allocated": "",
            "Call No": call.callNumber,
            "Call Date": fmtDate(call.dateTime),
            "Customer": call.customerName,
            "Products": (call.products || []).map(p => p.itemDescription || p.productModel || "Product").join(', '),
            "Attended": call.products?.some(p => p._attended) ? "Yes" : "No",
            "Status": call.status,
            "Priority": call.priority
          });
        });
      }
      // 3. Add visual spacing
      data.push({});
    });
    exportToExcel({ data, filename: `Service_Allocation_Report_${dateRangeStr.replace(/ /g, "_")}` });
  };

  const exportPdf = () => {
    const headers = ["S.No", "Employee Name", "Department", "Call No", "Call Date", "Customer", "Products", "Attended", "Status", "Priority"];
    const data = [];
    displayRows.forEach((row, i) => {
      // 1. Push the outer "Employee" summary row
      data.push([
        (i + 1).toString(),
        row.name,
        row.department || "N/A",
        "", "", "", "", "", "", ""
      ]);

      // 2. Push the inside view details rows (if any allocated calls)
      if (row.calls && row.calls.length > 0) {
        row.calls.forEach((call, j) => {
          data.push([
            `  - ${j + 1}`, // use simple dash instead of ↳ for jspdf compatibility sometimes
            "",
            "",
            call.callNumber,
            fmtDate(call.dateTime),
            call.customerName.length > 15 ? call.customerName.substring(0, 15) + "..." : call.customerName,
            (call.products || []).map(p => p.itemDescription || p.productModel || "Product").join(', ').substring(0, 20),
            call.products?.some(p => p._attended) ? "Yes" : "No",
            call.status,
            call.priority
          ]);
        });
      }
    });
    exportToPDF("Service Call Allocation Report", headers, data, `Service_Allocation_Report_${dateRangeStr.replace(/ /g, "_")}`, dateRangeStr);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-[1vw] bg-white">
        <div className="w-[3vw] h-[3vw] border-[0.3vw] border-black/10 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-[0.9vw] font-medium text-black">Generating Analysis...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-[0.6vw] bg-white gap-[0.8vw] max-h-[88vh]">
      {/* Action Bar */}
      <div className="flex-shrink-0 flex items-center justify-between mb-[0.2vw] gap-[0.6vw]">
        <div className="flex items-center gap-[0.8vw]">
          <div className="bg-blue-600 p-[0.5vw] rounded-lg shadow-blue-200 shadow-lg">
            <BarChart2 className="w-[1.2vw] h-[1.2vw] text-white" />
          </div>
          <div>
            <h2 className="text-[1.2vw] font-bold text-black tracking-tight leading-none">Service Call Allocation</h2>
            <p className="text-[0.68vw] text-black font-normal uppercase mt-[0.2vw]">Engineer Workload Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-[0.8vw]">
          <div className="relative">
            <Search className="absolute left-[0.6vw] top-1/2 -translate-y-1/2 w-[0.85vw] h-[0.85vw] text-black" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="pl-[2vw] pr-[0.8vw] h-[2.2vw] border border-slate-400 rounded-[0.5vw] focus:outline-none focus:border-blue-500 text-[0.75vw] w-[11vw] text-black font-medium"
            />
          </div>
          <DateRangeFilter from={fromDate} setFrom={setFromDate} to={toDate} setTo={setToDate} />
          <ExportButtons onCsv={exportCsv} onPdf={exportPdf} color="blue" />
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto rounded-lg md:rounded-[0.5vw] border border-slate-400 shadow-sm relative bg-white">
        <table className="w-full border-collapse text-left min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-blue-50">
            <tr>
              <Th cls="w-[3vw] text-center">S.No</Th>
              <Th cls="min-w-[15vw]">Employee Details</Th>
              <Th cls="min-w-[10vw]">Department</Th>
              <Th cls="text-center min-w-[8vw]">Allocated</Th>
              <Th cls="min-w-[20vw]">Status Breakdown</Th>
              <Th cls="text-center min-w-[8vw]">Action</Th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-[5vw] text-black/30 font-bold">No records found.</td></tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const sNo = (currentPage - 1) * rowsPerPage + idx + 1;
                return (
                  <tr key={row.userId || `row-${idx}`} className={`hover:bg-blue-50/30 transition-colors ${row.isUnassignedRow ? 'bg-orange-50/50' : ''}`}>
                    <Td cls="text-center font-semibold text-black">{sNo}</Td>
                    <Td>
                      <div className="flex items-center gap-[0.8vw]">
                        <div className={`w-[2.4vw] h-[2.4vw] rounded-lg flex items-center justify-center font-bold text-[0.9vw] border ${row.isUnassignedRow ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                          {row.isUnassignedRow ? <AlertCircle className="w-[1.2vw] h-[1.2vw]" /> : row.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className={`text-[0.85vw] font-semibold tracking-tight ${row.isUnassignedRow ? 'text-orange-700' : 'text-black'}`}>{row.name}</div>
                          {!row.isUnassignedRow && <div className="text-[0.6vw] text-black font-semibold uppercase tracking-wider">{row.role}</div>}
                        </div>
                      </div>
                    </Td>
                    <Td><span className="text-black font-semibold px-[0.6vw] py-[0.1vw] bg-slate-50 rounded border border-slate-400">{row.department || "—"}</span></Td>
                    <Td cls="text-center">
                      <span className={`inline-block px-[0.8vw] py-[0.1vw] rounded-full text-[0.85vw] font-semibold border ${row.allocatedCount > 0 ? (row.isUnassignedRow ? 'bg-orange-600 text-white border-orange-700' : 'bg-blue-600 text-white border-blue-700') : 'bg-white text-black border-slate-400'}`}>
                        {row.allocatedCount}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-[0.4vw] flex-wrap">
                        {Object.entries(row.statusCounts).length > 0 ? (
                          Object.entries(row.statusCounts).map(([status, count]) => (
                            <div key={status} className="flex items-center gap-[0.3vw] bg-white border border-slate-400 rounded-[0.4vw] px-[0.5vw] py-[0.1vw] shadow-sm">
                              <span className="text-[0.6vw] font-semibold text-black uppercase">{status}:</span>
                              <span className="text-[0.75vw] font-semibold text-black">{count}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-black text-[0.7vw]">No activity</span>
                        )}
                      </div>
                    </Td>
                    <Td cls="text-center">
                      <button 
                        onClick={() => {
                          if (row.allocatedCount === 0) {
                            toast("No allocated tasks for this engineer.", "info");
                          } else {
                            handleViewDetails(row);
                          }
                        }} 
                        onMouseEnter={() => {
                          if (row.allocatedCount === 0) {
                            toast("No allocated tasks for this engineer.", "info");
                          }
                        }}
                        title={row.allocatedCount === 0 ? "No calls allocated" : "View Details"}
                        className={`inline-flex items-center gap-[0.4vw] px-[1vw] py-[0.4vw] rounded-[0.5vw] text-[0.72vw] font-semibold transition-all border shadow-sm ${row.allocatedCount > 0 ? 'bg-white text-black border-slate-400 hover:bg-slate-50 active:scale-95 cursor-pointer' : 'bg-slate-50 text-black border-slate-400 cursor-not-allowed opacity-70'}`}>
                        <Layers className="w-[0.9vw] h-[0.9vw]" /> View Details
                      </button>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0">
        <Pagination totalItems={displayRows.length} itemsPerPage={rowsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} />
        <SummaryBar items={[
          { label: "Total Calls", value: filteredCalls.length },
          { label: "Resolved", value: filteredCalls.filter(c => c.status === 'Resolved').length },
          { label: "Critical", value: filteredCalls.filter(c => c.priority === 'Critical').length },
          { label: "Unassigned", value: reportData.unassigned.allocatedCount }
        ]} />
      </div>
      {/* Details Modal */}
      <CallDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={selectedEmp}
        calls={selectedEmp?.calls || []}
      />
    </div>
  );
}
