import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Package,
  Activity,
  Shield,
  Zap,
  BarChart2,
  RefreshCw,
  ChevronRight,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";

// ── localStorage keys ──────────────────────────────────────────────────────────
const CUSTOMER_DB_KEY = "customer_db_grouped_v5";
const SERVICE_CALLS_KEY = "service_calls_v2";
const ESCALATION_KEY = "escalation_queue_v1";
const EMPLOYEES_KEY = "employees";
const PARTY_TYPES_KEY = "party_types_v1";

// ── Shared UI Components ───────────────────────────────────────────────────────

function GlassCard({ children, className = "", noPadding = false }) {
  return (
    <div
      className={`bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[1vw] relative overflow-hidden transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] hover:border-white/80 ${
        noPadding ? "" : "p-[1.2vw]"
      } ${className}`}
    >
      {/* Subtle interior glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Donut({ segments, size = 80, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 drop-shadow-md">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const dash = (seg.value / 100) * circ;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={(-offset * circ) / 100}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        );
        offset += seg.value;
        return el;
      })}
    </svg>
  );
}

function MiniBar({ values, color = "#3b82f6" }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[4px] h-[3vw] mt-[0.5vw]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-700 ease-out hover:opacity-100"
          style={{
            height: `${(v / max) * 100}%`,
            background: color,
            opacity: 0.5 + (i / values.length) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent, trend, sparkValues, delay = 0 }) {
  return (
    <GlassCard className="flex flex-col gap-[0.8vw] group">
      <div className="flex items-start justify-between">
        <div
          className="w-[2.8vw] h-[2.8vw] rounded-[0.6vw] flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300"
          style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}11)`, border: `1px solid ${accent}33` }}
        >
          <Icon style={{ color: accent }} className="w-[1.4vw] h-[1.4vw]" />
        </div>
        {trend !== undefined && (
          <span className={`text-[0.7vw] font-bold px-[0.6vw] py-[0.2vw] rounded-full border ${trend >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-500 border-rose-200"}`}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[2vw] font-black text-slate-800 leading-none tracking-tight">{value}</p>
        <p className="text-[0.8vw] font-semibold text-slate-500 mt-[0.4vw] tracking-wide">{label}</p>
        {sub && <p className="text-[0.7vw] text-slate-400 mt-[0.2vw]">{sub}</p>}
      </div>
      {sparkValues && <MiniBar values={sparkValues} color={accent} />}
    </GlassCard>
  );
}

const PRIORITY_COLORS = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e" };
const STATUS_COLORS = { Registered: "#a855f7", Pending: "#eab308", Open: "#3b82f6", Assigned: "#8b5cf6", Escalated: "#f97316", Resolved: "#22c55e", Critical: "#ef4444" };
const TYPE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#14b8a6"];

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  
  const [raw, setRaw] = useState({ customers: [], calls: [], escalations: [], employees: [], partyTypes: [] });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Auth state
  const loggedInUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("loggedInUser") || localStorage.getItem("loggedInUser") || "null");
    } catch { return null; }
  }, []);

  const isAdminOrSup = loggedInUser?.role === "Admin" || loggedInUser?.role === "Supervisor";
  const isEngineer = loggedInUser?.role === "Support Engineer" || loggedInUser?.role === "Service Engineer";

  const load = () => {
    const parse = (key) => {
      try { return JSON.parse(localStorage.getItem(key) || "[]"); } 
      catch { return []; }
    };
    setRaw({
      customers: parse(CUSTOMER_DB_KEY),
      calls: parse(SERVICE_CALLS_KEY),
      escalations: parse(ESCALATION_KEY),
      employees: parse(EMPLOYEES_KEY),
      partyTypes: parse(PARTY_TYPES_KEY),
    });
    setLastRefresh(new Date());
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  // ── Data Processing ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const { customers, calls, escalations, employees, partyTypes } = raw;

    const uniqueParties = [...new Map(customers.map(c => [c.partyCode, c])).values()];

    const typeBreakdown = partyTypes.map(pt => {
      const count = uniqueParties.filter(p => p.partyType === pt.name).length;
      return { name: pt.name, count, pct: uniqueParties.length ? Math.round((count / uniqueParties.length) * 100) : 0 };
    }).filter(t => t.count > 0);

    const callStatus = {
      total: calls.length,
      registered: calls.filter(c => c.status === "Registered").length,
      open: calls.filter(c => c.status === "Open").length,
      assigned: calls.filter(c => c.status === "Assigned").length,
      pending: calls.filter(c => c.status === "Pending").length,
      escalated: calls.filter(c => c.status === "Escalated").length,
      resolved: calls.filter(c => c.status === "Resolved").length,
      critical: calls.filter(c => c.status === "Critical_Unresolved" || (c.priority === "Critical" && c.status !== "Resolved")).length,
    };

    const escStats = {
      total: escalations.length,
      pending: escalations.filter(e => e.status === "Pending" || e.status === "Assigned").length,
      escalated: escalations.filter(e => e.status === "Escalated").length,
      resolved: escalations.filter(e => e.status === "Resolved").length,
      critical: escalations.filter(e => e.status === "Critical_Unresolved").length,
    };

    const priorities = ["Critical", "High", "Medium", "Low"].map(p => ({
      name: p, count: calls.filter(c => c.priority === p).length
    }));

    const catMap = {}; calls.forEach(c => { catMap[c.category] = (catMap[c.category] || 0) + 1; });
    const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const modeMap = {}; calls.forEach(c => { modeMap[c.mode] = (modeMap[c.mode] || 0) + 1; });
    const modes = Object.entries(modeMap).sort((a, b) => b[1] - a[1]);

    const deptMap = {}; employees.forEach(e => { deptMap[e.department] = (deptMap[e.department] || 0) + 1; });
    const depts = Object.entries(deptMap);

    const now = Date.now();
    const dayMs = 86400000;
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * dayMs;
      const dayEnd = dayStart + dayMs;
      return calls.filter(c => {
        const t = new Date(c.timestamp).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
    });

    const resRate = calls.length ? Math.round((callStatus.resolved / calls.length) * 100) : 0;

    const recent = [...calls].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    // Engineer Specific Data
    const myCalls = isEngineer ? calls.filter(c => {
      if (c.currentEngineerId === loggedInUser?.userId) return true;
      if (c.products && c.products.some(p => p._assignedEngineerId === loggedInUser?.userId)) return true;
      return false;
    }) : [];

    const myPending = myCalls.filter(c => c.status !== "Resolved");
    
    return {
      uniqueParties, typeBreakdown, callStatus, escStats, priorities, categories,
      modes, depts, last7, resRate, recent, totalItems: customers.length, myCalls, myPending
    };
  }, [raw, isEngineer, loggedInUser]);

  // ── UI Helpers ───────────────────────────────────────────────────────────────
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 18) return "Good afternoon";
    return "Good evening";
  };

  const donutSegments = stats.typeBreakdown.map((t, i) => ({ value: t.pct, color: TYPE_COLORS[i % TYPE_COLORS.length] }));

  const getPriorityBadge = (p) => {
    const classes = {
      Critical: "bg-red-100/80 text-red-700 border-red-200",
      High: "bg-orange-100/80 text-orange-700 border-orange-200",
      Medium: "bg-yellow-100/80 text-yellow-700 border-yellow-200",
      Low: "bg-green-100/80 text-green-700 border-green-200",
    }[p] || "bg-slate-100/80 text-slate-700 border-slate-200";
    return <span className={`px-[0.6vw] py-[0.15vw] rounded-full text-[0.65vw] font-bold border ${classes} backdrop-blur-sm`}>{p}</span>;
  };

  const getStatusBadge = (s) => {
    const color = STATUS_COLORS[s] || STATUS_COLORS.Open;
    return (
      <span className="px-[0.6vw] py-[0.15vw] rounded-full text-[0.65vw] font-bold border backdrop-blur-sm flex items-center gap-[0.3vw] w-max"
            style={{ background: `${color}22`, color: color, borderColor: `${color}44` }}>
        <span className="w-[0.4vw] h-[0.4vw] rounded-full" style={{ background: color }}></span>
        {s}
      </span>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto font-sans text-[0.85vw] max-h-[85vh] custom-scrollbar pb-[2vw] relative">
      
      {/* Ambient background flares */}
      <div className="fixed top-[-10vw] left-[-10vw] w-[40vw] h-[40vw] bg-blue-400/20 rounded-full blur-[8vw] pointer-events-none z-[-1]" />
      <div className="fixed bottom-[-10vw] right-[-5vw] w-[30vw] h-[30vw] bg-indigo-400/20 rounded-full blur-[8vw] pointer-events-none z-[-1]" />
      <div className="fixed top-[20vw] right-[20vw] w-[20vw] h-[20vw] bg-emerald-400/10 rounded-full blur-[6vw] pointer-events-none z-[-1]" />

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-[2vw] mt-[0.5vw]">
        <div>
          <h1 className="text-[2vw] font-black text-slate-800 tracking-tight leading-tight">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{loggedInUser?.name || "Akira User"}</span>.
          </h1>
          <p className="text-[0.85vw] font-medium text-slate-500 mt-[0.2vw] flex items-center gap-[0.5vw]">
            <Calendar className="w-[1vw] h-[1vw]" /> 
            Here's what's happening today.
          </p>
        </div>
        
        <div className="flex items-center gap-[1vw]">
          {isEngineer && (
            <div className="flex items-center gap-[0.5vw] bg-white/60 backdrop-blur-md px-[1vw] py-[0.5vw] rounded-full border border-white shadow-sm">
              <span className="relative flex h-[0.8vw] w-[0.8vw]">
                {stats.myPending.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-[0.8vw] w-[0.8vw] ${stats.myPending.length > 0 ? "bg-orange-500" : "bg-emerald-500"}`}></span>
              </span>
              <span className="font-bold text-slate-700 text-[0.8vw]">{stats.myPending.length} Tasks Pending</span>
            </div>
          )}
          
          <button onClick={load} className="flex items-center gap-[0.4vw] text-[0.75vw] font-bold text-slate-600 hover:text-blue-600 bg-white/80 backdrop-blur-md border border-white/60 shadow-sm rounded-full px-[1vw] py-[0.6vw] cursor-pointer transition-all hover:shadow-md active:scale-95">
            <RefreshCw className="w-[0.9vw] h-[0.9vw]" />
            Live Sync • {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </button>
        </div>
      </div>

      {/* ── Role Specific Dashboards ── */}
      {isEngineer ? (
        <div className="flex flex-col gap-[1.5vw]">
          {/* Engineer Top Stats */}
          <div className="grid grid-cols-4 gap-[1.2vw]">
            <StatCard label="My Total Calls" value={stats.myCalls.length} sub="All time assigned" icon={Layers} accent="#3b82f6" />
            <StatCard label="Pending Action" value={stats.myPending.length} sub="Requires attention" icon={Clock} accent="#f59e0b" />
            <StatCard label="Critical Escalations" value={stats.myPending.filter(c => c.status === "Critical_Unresolved" || c.priority === "Critical").length} sub="High priority" icon={AlertTriangle} accent="#ef4444" />
            <StatCard label="Resolved by Me" value={stats.myCalls.filter(c => c.status === "Resolved").length} sub="Successfully closed" icon={CheckCircle} accent="#10b981" />
          </div>
          
          {/* My Action Queue */}
          <GlassCard noPadding className="flex flex-col">
            <div className="px-[1.5vw] py-[1.2vw] border-b border-slate-200/50 flex items-center justify-between bg-white/40">
              <div className="flex items-center gap-[0.6vw]">
                <div className="w-[2vw] h-[2vw] rounded-[0.5vw] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <Zap className="w-[1vw] h-[1vw] text-indigo-600" />
                </div>
                <h2 className="text-[1.1vw] font-black text-slate-800">My Action Queue</h2>
              </div>
              <button onClick={() => navigate('/serviceCallResponse')} className="flex items-center gap-[0.3vw] text-[0.75vw] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                Open Workspace <ArrowRight className="w-[0.8vw] h-[0.8vw]" />
              </button>
            </div>
            <div className="p-[0.5vw]">
              {stats.myPending.length === 0 ? (
                <div className="py-[4vw] flex flex-col items-center justify-center text-slate-400">
                  <CheckCircle className="w-[3vw] h-[3vw] text-emerald-400 mb-[1vw]" />
                  <p className="text-[1vw] font-bold text-slate-600">You're all caught up!</p>
                  <p className="text-[0.8vw]">No pending calls in your queue.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      {["Call Info", "Customer", "Category", "Priority", "Status"].map((h) => (
                        <th key={h} className="px-[1vw] py-[0.8vw] text-[0.75vw] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/50">
                    {stats.myPending.slice(0, 10).map((call, i) => (
                      <tr key={i} className="hover:bg-white/60 transition-colors group cursor-pointer" onClick={() => navigate('/serviceCallResponse')}>
                        <td className="px-[1vw] py-[0.8vw]">
                          <p className="font-mono text-[0.85vw] font-bold text-indigo-600">{call.callNumber}</p>
                          <p className="text-[0.7vw] text-slate-500 mt-[0.2vw]">{new Date(call.dateTime).toLocaleString()}</p>
                        </td>
                        <td className="px-[1vw] py-[0.8vw]">
                          <p className="text-[0.8vw] font-bold text-slate-700 truncate max-w-[12vw]">{call.customerName || "—"}</p>
                        </td>
                        <td className="px-[1vw] py-[0.8vw]"><span className="text-[0.75vw] font-medium text-slate-600 bg-slate-100/80 px-[0.6vw] py-[0.2vw] rounded-md border border-slate-200">{call.category || "—"}</span></td>
                        <td className="px-[1vw] py-[0.8vw]">{getPriorityBadge(call.priority)}</td>
                        <td className="px-[1vw] py-[0.8vw]">{getStatusBadge(call.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </GlassCard>
        </div>
      ) : (
        /* ── Admin / Supervisor Global View ── */
        <div className="flex flex-col gap-[1.5vw]">
          {/* KPI Cards */}
          <div className="grid grid-cols-5 gap-[1.2vw]">
            <StatCard label="Total Customers" value={stats.uniqueParties.length} sub={`${stats.totalItems} linked records`} icon={Users} accent="#6366f1" sparkValues={[2,4,3,6,5,8,7]} />
            <StatCard label="Service Calls" value={stats.callStatus.total} sub={`${stats.resRate}% resolution rate`} icon={Phone} accent="#3b82f6" sparkValues={stats.last7} />
            <StatCard label="Total Escalated" value={stats.escStats.escalated} sub="Active escalations" icon={ArrowUpRight} accent="#f59e0b" />
            <StatCard label="Critical Calls" value={stats.escStats.critical} sub="Immediate SLA breach" icon={Zap} accent="#ef4444" />
            <StatCard label="Team Strength" value={raw.employees.length} sub={`${stats.depts.length} active departments`} icon={Shield} accent="#10b981" />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-3 gap-[1.2vw]">
            {/* Call Status Breakdown */}
            <GlassCard className="col-span-1 flex flex-col">
              <div className="flex items-center gap-[0.6vw] mb-[1.5vw]">
                <Activity className="w-[1.2vw] h-[1.2vw] text-blue-500" />
                <h2 className="text-[1vw] font-black text-slate-800">Call Status</h2>
              </div>
              <div className="space-y-[1vw] flex-1 flex flex-col justify-center">
                {[
                  { label: "Registered", val: stats.callStatus.registered, color: STATUS_COLORS.Registered },
                  { label: "Open", val: stats.callStatus.open, color: STATUS_COLORS.Open },
                  { label: "Assigned", val: stats.callStatus.assigned, color: STATUS_COLORS.Assigned },
                  { label: "Pending", val: stats.callStatus.pending, color: STATUS_COLORS.Pending },
                  { label: "Resolved", val: stats.callStatus.resolved, color: STATUS_COLORS.Resolved },
                ].map(({ label, val, color }) => {
                  const pct = stats.callStatus.total ? Math.round((val / stats.callStatus.total) * 100) : 0;
                  return (
                    <div key={label} className="group">
                      <div className="flex justify-between items-center mb-[0.4vw]">
                        <span className="text-[0.8vw] text-slate-600 font-bold tracking-wide">{label}</span>
                        <span className="text-[0.85vw] font-black text-slate-800">{val} <span className="text-slate-400 font-medium text-[0.7vw]">({pct}%)</span></span>
                      </div>
                      <div className="w-full h-[0.5vw] bg-slate-100/80 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-110" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Customer Types Donut */}
            <GlassCard className="col-span-1 flex flex-col">
              <div className="flex items-center gap-[0.6vw] mb-[1vw]">
                <Package className="w-[1.2vw] h-[1.2vw] text-indigo-500" />
                <h2 className="text-[1vw] font-black text-slate-800">Segments</h2>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center">
                {stats.uniqueParties.length === 0 ? (
                  <p className="text-slate-400 text-[0.9vw] font-medium">No customer data</p>
                ) : (
                  <>
                    <div className="relative flex-shrink-0 mb-[1.5vw] group">
                      <Donut segments={donutSegments} size={140} stroke={16} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center transition-transform group-hover:scale-110">
                        <span className="text-[1.8vw] font-black text-slate-800 leading-none">{stats.uniqueParties.length}</span>
                        <span className="text-[0.7vw] font-bold text-slate-400 tracking-widest uppercase mt-[0.2vw]">Total</span>
                      </div>
                    </div>
                    <div className="w-full grid grid-cols-2 gap-x-[1vw] gap-y-[0.8vw]">
                      {stats.typeBreakdown.slice(0, 4).map((t, i) => (
                        <div key={t.name} className="flex items-center gap-[0.5vw] bg-slate-50/50 rounded-lg p-[0.4vw] border border-slate-200/50">
                          <div className="w-[0.7vw] h-[0.7vw] rounded-full shadow-sm" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                          <div className="flex flex-col">
                            <span className="text-[0.65vw] font-bold text-slate-500 uppercase tracking-wider">{t.name}</span>
                            <span className="text-[0.8vw] font-black text-slate-800">{t.pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
            
            {/* Dept Performance */}
            <GlassCard className="col-span-1 flex flex-col">
              <div className="flex items-center gap-[0.6vw] mb-[1.5vw]">
                <Shield className="w-[1.2vw] h-[1.2vw] text-emerald-500" />
                <h2 className="text-[1vw] font-black text-slate-800">Team Distribution</h2>
              </div>
              <div className="space-y-[1vw] flex-1 overflow-y-auto custom-scrollbar pr-[0.5vw]">
                {stats.depts.length === 0 ? (
                  <p className="text-[0.8vw] text-slate-400 text-center py-[2vw]">No active departments</p>
                ) : (
                  stats.depts.map(([dept, count], i) => {
                    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];
                    const c = colors[i % colors.length];
                    return (
                      <div key={dept} className="flex items-center justify-between p-[0.8vw] rounded-[0.6vw] border border-slate-200/60 bg-white/40 hover:bg-white/80 transition-colors">
                        <div className="flex items-center gap-[0.8vw]">
                          <div className="w-[2vw] h-[2vw] rounded-[0.5vw] flex items-center justify-center text-white text-[0.8vw] font-black shadow-sm" style={{ background: c }}>
                            {count}
                          </div>
                          <span className="text-[0.8vw] font-bold text-slate-700 truncate max-w-[10vw]">{dept}</span>
                        </div>
                        <div className="flex gap-[0.3vw]">
                          {Array.from({ length: Math.min(count, 5) }).map((_, j) => (
                            <div key={j} className="w-[0.5vw] h-[0.5vw] rounded-full shadow-sm" style={{ background: c, opacity: 0.6 + j * 0.1 }} />
                          ))}
                          {count > 5 && <span className="text-[0.6vw] font-bold text-slate-400 ml-[0.3vw]">+{count - 5}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>
          </div>

          {/* Bottom Table Row */}
          <div className="grid grid-cols-4 gap-[1.2vw]">
            <GlassCard noPadding className="col-span-3 flex flex-col">
              <div className="px-[1.5vw] py-[1.2vw] border-b border-slate-200/50 flex items-center justify-between bg-white/40">
                <div className="flex items-center gap-[0.6vw]">
                  <Clock className="w-[1.2vw] h-[1.2vw] text-blue-500" />
                  <h2 className="text-[1.1vw] font-black text-slate-800">Global Recent Activity</h2>
                </div>
              </div>
              <div className="p-[0.5vw]">
                {stats.recent.length === 0 ? (
                  <p className="text-center py-[3vw] text-slate-400 text-[0.9vw] font-medium">No service calls recorded globally yet.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        {["Call No.", "Customer", "Category", "Priority", "Status"].map((h) => (
                          <th key={h} className="px-[1vw] py-[0.8vw] text-[0.75vw] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {stats.recent.map((call, i) => (
                        <tr key={i} className="hover:bg-white/60 transition-colors">
                          <td className="px-[1vw] py-[0.8vw] font-mono text-[0.8vw] font-bold text-blue-600">{call.callNumber}</td>
                          <td className="px-[1vw] py-[0.8vw] text-[0.8vw] font-bold text-slate-700 truncate max-w-[12vw]">{call.customerName || "—"}</td>
                          <td className="px-[1vw] py-[0.8vw]"><span className="text-[0.75vw] font-medium text-slate-600 bg-slate-100/80 px-[0.6vw] py-[0.2vw] rounded-md border border-slate-200">{call.category || "—"}</span></td>
                          <td className="px-[1vw] py-[0.8vw]">{getPriorityBadge(call.priority)}</td>
                          <td className="px-[1vw] py-[0.8vw]">{getStatusBadge(call.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </GlassCard>

            {/* SLA / Resolution Metric */}
            <GlassCard className="col-span-1 flex flex-col justify-between bg-gradient-to-br from-indigo-600 to-blue-700 border-none !text-white shadow-xl">
              <div>
                <h2 className="text-[1.1vw] font-black text-white/90 mb-[0.5vw] flex items-center gap-[0.5vw]">
                  <CheckCircle className="w-[1.2vw] h-[1.2vw]" /> Resolution SLA
                </h2>
                <p className="text-[0.8vw] text-blue-100 font-medium">Overall service efficiency.</p>
              </div>
              
              <div className="flex flex-col items-center justify-center my-[2vw]">
                <div className="relative">
                   <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90 drop-shadow-2xl">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#fff" strokeWidth="12" strokeDasharray={`${(stats.resRate/100) * 314} 314`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[2.2vw] font-black text-white leading-none">{stats.resRate}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 rounded-[0.8vw] p-[1vw] border border-white/20 backdrop-blur-md">
                <div className="flex justify-between items-center mb-[0.5vw]">
                  <span className="text-[0.75vw] font-bold text-blue-100 uppercase tracking-widest">Resolved</span>
                  <span className="text-[0.9vw] font-black">{stats.callStatus.resolved}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[0.75vw] font-bold text-blue-100 uppercase tracking-widest">Open/Pending</span>
                  <span className="text-[0.9vw] font-black text-orange-200">{stats.callStatus.total - stats.callStatus.resolved}</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
