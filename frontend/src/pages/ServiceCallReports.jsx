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
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

// ── Date helpers ─────────────────────────────────────────────
const getTodayStr = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${d.getFullYear()}`;
};

// ── Status Badge ─────────────────────────────────────────────
const STATUS_COLORS = {
  Registered: "bg-blue-100 text-blue-700 border-blue-200",
  Assigned: "bg-purple-100 text-purple-700 border-purple-200",
  Open: "bg-amber-100 text-amber-700 border-amber-200",
  Pending: "bg-orange-100 text-orange-700 border-orange-200",
  Resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
  Escalated: "bg-rose-100 text-rose-700 border-rose-200",
};

const StatusBadge = ({ status }) => (
  <span
    className={`px-[0.55vw] py-[0.1vw] rounded-full text-[0.65vw] font-medium border ${
      STATUS_COLORS[status] || "bg-blue-50 text-blue-600 border-blue-100"
    }`}
  >
    {status || "—"}
  </span>
);

// ── Shared UI Components ─────────────────────────────────────
const Th = ({ children, cls = "" }) => (
  <th
    className={`px-[0.8vw] py-[0.7vw] text-[0.7vw] text-black font-semibold uppercase tracking-wider border-b-2 border-r border-slate-200 last:border-r-0 bg-blue-50/40 ${cls}`}
  >
    {children}
  </th>
);

const Td = ({ children, cls = "" }) => (
  <td
    className={`px-[0.8vw] py-[0.8vw] text-[0.75vw] text-black border-b border-r border-slate-100 last:border-r-0 align-middle ${cls}`}
  >
    {children}
  </td>
);

const ExportButtons = ({ onCsv, onPdf }) => (
  <div className="flex items-center gap-[0.5vw]">
    <button
      onClick={onCsv}
      className="flex items-center gap-[0.4vw] px-[1vw] py-[0.5vw] bg-emerald-600 text-white rounded-[0.5vw] text-[0.75vw] font-semibold hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md cursor-pointer active:scale-95"
    >
      <FileSpreadsheet className="w-[1vw] h-[1vw]" /> Excel
    </button>
    <button
      onClick={onPdf}
      className="flex items-center gap-[0.4vw] px-[1vw] py-[0.5vw] bg-blue-600 text-white rounded-[0.5vw] text-[0.75vw] font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md cursor-pointer active:scale-95"
    >
      <Download className="w-[1vw] h-[1vw]" /> PDF
    </button>
  </div>
);

// ── Popup Modal for Call Details ──────────────────────────────
const CallDetailsModal = ({ isOpen, onClose, employee, calls }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/40 backdrop-blur-sm p-[2vw]">
      <div className="bg-white rounded-[1.2vw] shadow-2xl w-[85vw] max-h-[85vh] flex flex-col overflow-hidden border border-blue-100">
        <div className="bg-blue-950 px-[1.5vw] py-[1.2vw] flex items-center justify-between">
          <div className="flex items-center gap-[0.8vw]">
            <div className="w-[2.5vw] h-[2.5vw] rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
              <User className="w-[1.2vw] h-[1.2vw] text-blue-300" />
            </div>
            <div>
              <h3 className="text-white text-[1.1vw] font-semibold tracking-tight">
                {employee?.name || "Unassigned"}
              </h3>
              <p className="text-blue-200/70 text-[0.7vw]">
                {employee?.department || "N/A"} • <span className="text-blue-100 font-medium">{calls.length}</span> Allocated Calls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors cursor-pointer p-[0.5vw] hover:bg-white/10 rounded-full"
          >
            <X className="w-[1.4vw] h-[1.4vw]" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-[1.5vw] bg-blue-50/10">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <Th>Call No</Th>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Products</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-[5vw] text-black/30 font-medium">
                    No calls found for this period.
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr key={call._id} className="hover:bg-gray-50 transition-colors group">
                    <Td className="font-bold text-black">{call.callNumber}</Td>
                    <Td className="text-black/80">{fmtDate(call.dateTime)}</Td>
                    <Td className="font-semibold text-black">{call.customerName}</Td>
                    <Td>
                      <div className="flex flex-col gap-[0.2vw]">
                        {call.products?.map((p, i) => (
                          <span key={i} className="text-[0.68vw] text-black bg-blue-50 px-[0.4vw] py-[0.1vw] rounded border border-blue-100 truncate max-w-[15vw] font-medium">
                            {p.itemDescription} <span className="text-black/50 text-[0.6vw]">({p.serialNumber})</span>
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={call.status} />
                    </Td>
                    <Td>
                      <span className={`px-[0.5vw] py-[0.1vw] rounded text-[0.65vw] font-semibold border ${
                        call.priority === 'Critical' ? 'text-red-700 bg-red-50 border-red-100' : 
                        call.priority === 'High' ? 'text-orange-700 bg-orange-50 border-orange-100' : 'text-blue-600 bg-blue-50 border-blue-100'
                      }`}>
                        {call.priority}
                      </span>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────
export default function ServiceCallReports() {
  const [fromDate, setFromDate] = useState(getTodayStr());
  const [toDate, setToDate] = useState(getTodayStr());
  const [employees, setEmployees] = useState([]);
  const [calls, setCalls] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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
    return [reportData.unassigned, ...filteredEmps];
  }, [reportData, search]);

  const handleViewDetails = (row) => {
    setSelectedEmp(row);
    setIsModalOpen(true);
  };

  const exportCsv = () => {
    const headers = ["Employee Name", "Department", "Role", "Total Allocated", "Resolved", "Pending/Open", "Registered/Unassigned"];
    const rows = displayRows.map(row => [
      row.name,
      row.department || "N/A",
      row.role || "N/A",
      row.allocatedCount,
      row.statusCounts["Resolved"] || 0,
      (row.statusCounts["Pending"] || 0) + (row.statusCounts["Open"] || 0),
      row.statusCounts["Registered"] || 0
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Service_Call_Report_${fromDate}_to_${toDate}.csv`;
    link.click();
  };

  const exportPdf = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-[1vw] bg-blue-50/10">
        <div className="w-[3vw] h-[3vw] border-[0.3vw] border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-[0.9vw] font-medium text-blue-600">Generating Analysis...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-[1vw] p-[0.6vw] overflow-hidden bg-blue-50/20">
      {/* Header Section */}
      <div className="bg-white border border-blue-100 rounded-[1.2vw] p-[1.2vw] shadow-sm">
        <div className="flex items-center justify-between mb-[1vw]">
          <div className="flex items-center gap-[0.8vw]">
            <div className="bg-blue-600 p-[0.6vw] rounded-[0.8vw] shadow-lg shadow-blue-200">
              <BarChart2 className="w-[1.4vw] h-[1.4vw] text-white" />
            </div>
            <div>
              <h2 className="text-[1.25vw] font-bold text-blue-950 uppercase tracking-tight">Service Call Allocation Report</h2>
              <p className="text-[0.72vw] text-blue-400 font-medium">Engineer workload analytics & distribution</p>
            </div>
          </div>
          <ExportButtons onCsv={exportCsv} onPdf={exportPdf} />
        </div>

        <div className="flex items-center gap-[1.5vw] bg-blue-50/40 p-[0.8vw] rounded-[1vw] border border-blue-50">
          <div className="flex items-center gap-[1vw]">
            <div className="flex flex-col gap-[0.2vw]">
              <label className="text-[0.6vw] font-bold text-blue-400 uppercase ml-[0.2vw] tracking-wider">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-[0.7vw] top-1/2 -translate-y-1/2 w-[0.8vw] h-[0.8vw] text-blue-300" />
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="pl-[2vw] pr-[0.8vw] py-[0.45vw] border border-blue-100 rounded-[0.6vw] text-[0.75vw] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white font-medium text-black cursor-pointer"
                />
              </div>
            </div>
            <div className="flex flex-col gap-[0.2vw]">
              <label className="text-[0.6vw] font-bold text-blue-400 uppercase ml-[0.2vw] tracking-wider">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-[0.7vw] top-1/2 -translate-y-1/2 w-[0.8vw] h-[0.8vw] text-blue-300" />
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="pl-[2vw] pr-[0.8vw] py-[0.45vw] border border-blue-100 rounded-[0.6vw] text-[0.75vw] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white font-medium text-black cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="h-[2.5vw] w-[1.5px] bg-blue-100 mx-[0.5vw]" />

          <div className="flex-1 relative">
            <Search className="absolute left-[0.8vw] top-1/2 -translate-y-1/2 w-[1vw] h-[1vw] text-blue-300" />
            <input 
              type="text"
              placeholder="Search by Employee Name or Department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-[2.4vw] pr-[1vw] py-[0.5vw] bg-white border border-blue-100 rounded-[0.8vw] text-[0.8vw] focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all placeholder:text-blue-300 font-medium text-black"
            />
          </div>
        </div>
      </div>

      {/* Main Content - Table */}
      <div className="flex-1 bg-white border border-blue-100 rounded-[1.2vw] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <Th>Employee Details</Th>
                <Th>Department</Th>
                <Th cls="text-center">Total Allocated</Th>
                <Th>Status Breakdown</Th>
                <Th cls="text-center">Action</Th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, idx) => (
                <tr 
                  key={row.userId || `row-${idx}`} 
                  className={`
                    group transition-all duration-200
                    ${row.isUnassignedRow ? 'bg-orange-50/40 hover:bg-orange-50' : 'hover:bg-blue-50/30'}
                  `}
                >
                  <Td>
                    <div className="flex items-center gap-[0.8vw]">
                      <div className={`
                        w-[2.2vw] h-[2.2vw] rounded-full flex items-center justify-center font-bold text-[0.8vw] shadow-sm border
                        ${row.isUnassignedRow ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-blue-100 text-blue-600 border-blue-200'}
                      `}>
                        {row.isUnassignedRow ? <AlertCircle className="w-[1.2vw] h-[1.2vw]" /> : row.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={`text-[0.82vw] font-bold tracking-tight ${row.isUnassignedRow ? 'text-orange-700' : 'text-black'}`}>{row.name}</div>
                        {!row.isUnassignedRow && <div className="text-[0.65vw] text-black/50 font-semibold uppercase tracking-tight">{row.role}</div>}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-black/80 font-semibold">{row.department || "—"}</span>
                  </Td>
                  <Td cls="text-center">
                    <div className={`
                      inline-flex items-center justify-center min-w-[2.8vw] h-[1.6vw] rounded-full text-[0.8vw] font-bold shadow-sm
                      ${row.allocatedCount > 0 ? (row.isUnassignedRow ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white') : 'bg-blue-50 text-blue-300 border border-blue-100'}
                    `}>
                      {row.allocatedCount}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-[0.4vw] flex-wrap">
                      {Object.entries(row.statusCounts).length > 0 ? (
                        Object.entries(row.statusCounts).map(([status, count]) => (
                          <div key={status} className="flex items-center gap-[0.3vw] bg-white border border-slate-200 rounded-[0.5vw] px-[0.5vw] py-[0.15vw] shadow-sm">
                            <span className="text-[0.65vw] font-bold text-black/40 uppercase">{status}:</span>
                            <span className="text-[0.72vw] font-bold text-black">{count}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-blue-200 font-medium text-[0.7vw]">No calls in this period</span>
                      )}
                    </div>
                  </Td>
                  <Td cls="text-center">
                    <button 
                      onClick={() => handleViewDetails(row)}
                      disabled={row.allocatedCount === 0}
                      className={`
                        inline-flex items-center gap-[0.4vw] px-[1vw] py-[0.4vw] rounded-[0.7vw] text-[0.72vw] font-semibold transition-all shadow-sm border
                        ${row.allocatedCount > 0 
                          ? (row.isUnassignedRow ? 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100 active:scale-95' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 active:scale-95') 
                          : 'bg-white text-blue-100 border-blue-50 cursor-not-allowed'}
                      `}
                    >
                      <Layers className="w-[0.9vw] h-[0.9vw]" />
                      View Details
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer Summary */}
        <div className="bg-blue-950 px-[1.5vw] py-[1.2vw] flex items-center gap-[3vw]">
          <div className="flex items-center gap-[0.8vw]">
            <div className="w-[2.2vw] h-[2.2vw] rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
              <Layers className="w-[1.1vw] h-[1.1vw] text-blue-400" />
            </div>
            <div>
              <span className="block text-[0.6vw] text-blue-300/60 uppercase font-bold tracking-widest">Total Period Calls</span>
              <span className="text-[1.1vw] font-bold text-white leading-tight">{filteredCalls.length}</span>
            </div>
          </div>

          <div className="w-[1px] h-[2.2vw] bg-blue-800/50" />

          <div className="flex items-center gap-[2vw]">
             <div className="flex items-center gap-[0.5vw] group">
                <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)] group-hover:scale-125 transition-transform" />
                <span className="text-[0.75vw] text-blue-200 font-medium tracking-tight">Resolved: <span className="text-white ml-[0.3vw] font-bold">{filteredCalls.filter(c => c.status === 'Resolved').length}</span></span>
             </div>
             <div className="flex items-center gap-[0.5vw] group">
                <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] group-hover:scale-125 transition-transform" />
                <span className="text-[0.75vw] text-blue-200 font-medium tracking-tight">Pending/Open: <span className="text-white ml-[0.3vw] font-bold">{filteredCalls.filter(c => ['Pending', 'Open'].includes(c.status)).length}</span></span>
             </div>
             <div className="flex items-center gap-[0.5vw] group">
                <div className="w-[0.5vw] h-[0.5vw] rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] group-hover:scale-125 transition-transform" />
                <span className="text-[0.75vw] text-blue-200 font-medium tracking-tight">Critical: <span className="text-white ml-[0.3vw] font-bold">{filteredCalls.filter(c => c.priority === 'Critical').length}</span></span>
             </div>
          </div>
        </div>
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
