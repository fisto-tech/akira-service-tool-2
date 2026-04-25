import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";

// ── localStorage keys (same as rest of app) ───────────────────────────────────
const CUSTOMER_DB_KEY = "customer_db_grouped_v5";
const SERVICE_CALLS_KEY = "service_calls_v2";
const ESCALATION_KEY = "escalation_queue_v1";
const EMPLOYEES_KEY = "employees";
const PARTY_TYPES_KEY = "party_types_v1";

// ── Tiny donut SVG ────────────────────────────────────────────────────────────
function Donut({ segments, size = 80, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;

  let offset = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
    >
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={stroke}
      />
      {segments.map((seg, i) => {
        const dash = (seg.value / 100) * circ;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={(-offset * circ) / 100}
            strokeLinecap="butt"
          />
        );
        offset += seg.value;
        return el;
      })}
    </svg>
  );
}

// ── Mini sparkline bar chart ──────────────────────────────────────────────────
function MiniBar({ values, color = "#3b82f6" }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-[2.5vw]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${(v / max) * 100}%`,
            background: color,
            opacity: 0.4 + (i / values.length) * 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
  sparkValues,
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm flex flex-col gap-[0.6vw] hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div
          className={`w-[2.4vw] h-[2.4vw] rounded-[0.5vw] flex items-center justify-center`}
          style={{ background: accent + "18" }}
        >
          <Icon style={{ color: accent }} className="w-[1.2vw] h-[1.2vw]" />
        </div>
        {trend !== undefined && (
          <span
            className={`text-[0.7vw] font-semibold px-[0.5vw] py-[0.2vw] rounded-full ${trend >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}
          >
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[1.8vw] font-bold text-gray-800 leading-none">
          {value}
        </p>
        <p className="text-[0.75vw] font-semibold text-gray-500 mt-[0.3vw]">
          {label}
        </p>
        {sub && <p className="text-[0.7vw] text-gray-400 mt-[0.15vw]">{sub}</p>}
      </div>
      {sparkValues && <MiniBar values={sparkValues} color={accent} />}
    </div>
  );
}

// ── Pill badge ────────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span
      className="text-[0.68vw] font-semibold px-[0.6vw] py-[0.2vw] rounded-full"
      style={{ background: color + "18", color }}
    >
      {label}
    </span>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [raw, setRaw] = useState({
    customers: [],
    calls: [],
    escalations: [],
    employees: [],
    partyTypes: [],
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = () => {
    const parse = (key) => {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]");
      } catch {
        return [];
      }
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

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const { customers, calls, escalations, employees, partyTypes } = raw;

    // Unique customers
    const uniqueParties = [
      ...new Map(customers.map((c) => [c.partyCode, c])).values(),
    ];

    // Customer type breakdown
    const typeBreakdown = partyTypes.map((pt) => {
      const count = uniqueParties.filter((p) => p.partyType === pt.name).length;
      return {
        name: pt.name,
        count,
        pct: uniqueParties.length
          ? Math.round((count / uniqueParties.length) * 100)
          : 0,
      };
    });

    // Service call statuses
    const callStatus = {
      total: calls.length,
      open: calls.filter((c) => c.status === "Open").length,
      assigned: calls.filter((c) => c.status === "Assigned").length,
      escalated: calls.filter((c) => c.status === "Escalated").length,
      resolved: calls.filter((c) => c.status === "Resolved").length,
      critical: calls.filter((c) => c.status === "Critical_Unresolved").length,
    };

    // Escalation queue
    const escStats = {
      total: escalations.length,
      pending: escalations.filter(
        (e) => e.status === "Pending" || e.status === "Assigned",
      ).length,
      escalated: escalations.filter((e) => e.status === "Escalated").length,
      resolved: escalations.filter((e) => e.status === "Resolved").length,
      critical: escalations.filter((e) => e.status === "Critical_Unresolved")
        .length,
    };

    // Priority breakdown
    const priorities = ["Critical", "High", "Medium", "Low"].map((p) => ({
      name: p,
      count: calls.filter((c) => c.priority === p).length,
    }));

    // Category breakdown
    const catMap = {};
    calls.forEach((c) => {
      catMap[c.category] = (catMap[c.category] || 0) + 1;
    });
    const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    // Mode breakdown
    const modeMap = {};
    calls.forEach((c) => {
      modeMap[c.mode] = (modeMap[c.mode] || 0) + 1;
    });
    const modes = Object.entries(modeMap).sort((a, b) => b[1] - a[1]);

    // Warranty breakdown
    const inWarranty = customers.filter(
      (c) => c.warrantyStatus === "In Warranty" || !c.warrantyStatus,
    ).length;
    const outWarranty = customers.filter(
      (c) => c.warrantyStatus === "Out of Warranty",
    ).length;

    // Employees by dept
    const deptMap = {};
    employees.forEach((e) => {
      deptMap[e.department] = (deptMap[e.department] || 0) + 1;
    });
    const depts = Object.entries(deptMap);

    // Last 7 days call volume (simulated from timestamps)
    const now = Date.now();
    const dayMs = 86400000;
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const dayStart = now - (6 - i) * dayMs;
      const dayEnd = dayStart + dayMs;
      return calls.filter((c) => {
        const t = new Date(c.timestamp).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
    });

    // Resolution rate
    const resRate = calls.length
      ? Math.round((callStatus.resolved / calls.length) * 100)
      : 0;

    // Recent calls
    const recent = [...calls]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    return {
      uniqueParties,
      typeBreakdown,
      callStatus,
      escStats,
      priorities,
      categories,
      modes,
      depts,
      last7,
      resRate,
      recent,
      totalItems: customers.length,
    };
  }, [raw]);

  const TYPE_COLORS = [
    "#6366f1",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ec4899",
    "#14b8a6",
  ];
  const PRIORITY_COLORS = {
    Critical: "#ef4444",
    High: "#f97316",
    Medium: "#eab308",
    Low: "#22c55e",
  };
  const STATUS_COLORS = {
    Open: "#94a3b8",
    Assigned: "#3b82f6",
    Escalated: "#f97316",
    Resolved: "#22c55e",
    Critical: "#ef4444",
  };

  const donutSegments = stats.typeBreakdown.map((t, i) => ({
    value: t.pct,
    color: TYPE_COLORS[i % TYPE_COLORS.length],
  }));

  const getPriorityBg = (p) =>
    ({
      Critical: "bg-red-50 text-red-600",
      High: "bg-orange-50 text-orange-600",
      Medium: "bg-yellow-50 text-yellow-600",
      Low: "bg-green-50 text-green-600",
    })[p] || "bg-gray-50 text-gray-600";

  return (
    <div className="w-full h-full overflow-y-auto font-sans text-[0.85vw] ">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-[1.5vw]">
        <div>
          <h1 className="text-[1.4vw] font-bold text-gray-800 tracking-tight">
            Overview
          </h1>
          <p className="text-[0.75vw] text-gray-400 mt-[0.15vw]">
            Live data · refreshes every 5s
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-[0.4vw] text-[0.75vw] text-gray-500 hover:text-gray-800 border border-gray-200 bg-white rounded-[0.4vw] px-[0.8vw] py-[0.4vw] cursor-pointer transition-colors"
        >
          <RefreshCw className="w-[0.85vw] h-[0.85vw]" />
          {lastRefresh.toLocaleTimeString()}
        </button>
      </div>

      {/* ── Row 1: Top KPI cards ── */}
      <div className="grid grid-cols-5 gap-[1vw] mb-[1.2vw]">
        <StatCard
          label="Total Customers"
          value={stats.uniqueParties.length}
          sub={`${stats.totalItems} item records`}
          icon={Users}
          accent="#6366f1"
          sparkValues={[2, 4, 3, 6, 5, 8, (stats.uniqueParties.length % 8) + 1]}
        />
        <StatCard
          label="Service Calls"
          value={stats.callStatus.total}
          sub={`${stats.resRate}% resolved`}
          icon={Phone}
          accent="#3b82f6"
          sparkValues={stats.last7}
        />
        <StatCard
          label="Escalated"
          value={stats.escStats.escalated}
          sub="Active escalations"
          icon={ArrowUpRight}
          accent="#f97316"
        />
        <StatCard
          label="Critical"
          value={stats.escStats.critical}
          sub="Needs immediate action"
          icon={Zap}
          accent="#ef4444"
        />
        <StatCard
          label="Team Members"
          value={raw.employees.length}
          sub={`${stats.depts.length} departments`}
          icon={Shield}
          accent="#10b981"
        />
      </div>

      {/* ── Row 2: Call status + Customer types ── */}
      <div className="grid grid-cols-3 gap-[1vw] mb-[1.2vw]">
        {/* Call Status Breakdown */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-1">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <Activity className="w-[1vw] h-[1vw] text-blue-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Call Status
            </h2>
          </div>
          <div className="space-y-[0.65vw]">
            {[
              {
                label: "Open",
                val: stats.callStatus.open,
                color: STATUS_COLORS.Open,
              },
              {
                label: "Assigned",
                val: stats.callStatus.assigned,
                color: STATUS_COLORS.Assigned,
              },
              {
                label: "Escalated",
                val: stats.callStatus.escalated,
                color: STATUS_COLORS.Escalated,
              },
              {
                label: "Resolved",
                val: stats.callStatus.resolved,
                color: STATUS_COLORS.Resolved,
              },
              {
                label: "Critical",
                val: stats.callStatus.critical,
                color: STATUS_COLORS.Critical,
              },
            ].map(({ label, val, color }) => {
              const pct = stats.callStatus.total
                ? Math.round((val / stats.callStatus.total) * 100)
                : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-[0.2vw]">
                    <span className="text-[0.75vw] text-gray-600 font-medium">
                      {label}
                    </span>
                    <span className="text-[0.75vw] font-bold text-gray-700">
                      {val}{" "}
                      <span className="text-gray-400 font-normal">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-[0.4vw] bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Type Donut */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-1">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <Users className="w-[1vw] h-[1vw] text-indigo-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Customer Types
            </h2>
          </div>
          {stats.uniqueParties.length === 0 ? (
            <div className="flex items-center justify-center h-[8vw] text-gray-300 text-[0.8vw]">
              No customer data
            </div>
          ) : (
            <div className="flex items-center gap-[1.2vw]">
              <div className="relative flex-shrink-0">
                <Donut
                  segments={
                    donutSegments.length
                      ? donutSegments
                      : [{ value: 100, color: "#e2e8f0" }]
                  }
                  size={90}
                  stroke={12}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[1vw] font-bold text-gray-800">
                    {stats.uniqueParties.length}
                  </span>
                  <span className="text-[0.55vw] text-gray-400">total</span>
                </div>
              </div>
              <div className="flex-1 space-y-[0.5vw]">
                {stats.typeBreakdown.map((t, i) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-[0.4vw]">
                      <div
                        className="w-[0.6vw] h-[0.6vw] rounded-full flex-shrink-0"
                        style={{
                          background: TYPE_COLORS[i % TYPE_COLORS.length],
                        }}
                      />
                      <span className="text-[0.75vw] text-gray-600">
                        {t.name}
                      </span>
                    </div>
                    <span className="text-[0.75vw] font-bold text-gray-700">
                      {t.count}{" "}
                      <span className="text-gray-400 font-normal text-[0.7vw]">
                        {t.pct}%
                      </span>
                    </span>
                  </div>
                ))}
                {stats.typeBreakdown.length === 0 && (
                  <p className="text-[0.75vw] text-gray-400">
                    No types configured
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-1">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <AlertTriangle className="w-[1vw] h-[1vw] text-orange-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Priority Split
            </h2>
          </div>
          <div className="space-y-[0.65vw]">
            {stats.priorities.map(({ name, count }) => {
              const pct = stats.callStatus.total
                ? Math.round((count / stats.callStatus.total) * 100)
                : 0;
              const color = PRIORITY_COLORS[name];
              return (
                <div key={name}>
                  <div className="flex justify-between items-center mb-[0.2vw]">
                    <div className="flex items-center gap-[0.4vw]">
                      <div
                        className="w-[0.5vw] h-[0.5vw] rounded-full"
                        style={{ background: color }}
                      />
                      <span className="text-[0.75vw] text-gray-600 font-medium">
                        {name}
                      </span>
                    </div>
                    <span className="text-[0.75vw] font-bold text-gray-700">
                      {count}{" "}
                      <span className="text-gray-400 font-normal">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-[0.4vw] bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.callStatus.total === 0 && (
              <p className="text-[0.75vw] text-gray-400 text-center py-[1vw]">
                No calls recorded yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Call trend + Category + Mode + Team ── */}
      <div className="grid grid-cols-4 gap-[1vw] mb-[1.2vw]">
        {/* 7-Day Call Volume */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-1">
          <div className="flex items-center gap-[0.5vw] mb-[0.6vw]">
            <TrendingUp className="w-[1vw] h-[1vw] text-blue-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Last 7 Days
            </h2>
          </div>
          <p className="text-[1.4vw] font-bold text-gray-800">
            {stats.last7.reduce((a, b) => a + b, 0)}
          </p>
          <p className="text-[0.7vw] text-gray-400 mb-[0.8vw]">calls logged</p>
          <MiniBar
            values={stats.last7.length ? stats.last7 : [0, 0, 0, 0, 0, 0, 0]}
            color="#3b82f6"
          />
          <div className="flex justify-between mt-[0.3vw]">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span
                key={i}
                className="text-[0.6vw] text-gray-400 flex-1 text-center"
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Call Category */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-1">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <BarChart2 className="w-[1vw] h-[1vw] text-violet-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Call Categories
            </h2>
          </div>
          <div className="space-y-[0.55vw]">
            {stats.categories.length === 0 && (
              <p className="text-[0.75vw] text-gray-400 text-center py-[1vw]">
                No calls yet
              </p>
            )}
            {stats.categories.slice(0, 4).map(([cat, count], i) => {
              const pct = stats.callStatus.total
                ? Math.round((count / stats.callStatus.total) * 100)
                : 0;
              const colors = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"];
              return (
                <div key={cat}>
                  <div className="flex justify-between mb-[0.2vw]">
                    <span className="text-[0.72vw] text-gray-600 truncate max-w-[60%]">
                      {cat}
                    </span>
                    <span className="text-[0.72vw] font-bold text-gray-700">
                      {count}
                    </span>
                  </div>
                  <div className="w-full h-[0.35vw] bg-gray-100 rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: colors[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Call Mode */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-1">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <Phone className="w-[1vw] h-[1vw] text-teal-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Mode of Call
            </h2>
          </div>
          <div className="space-y-[0.55vw]">
            {stats.modes.length === 0 && (
              <p className="text-[0.75vw] text-gray-400 text-center py-[1vw]">
                No calls yet
              </p>
            )}
            {stats.modes.slice(0, 5).map(([mode, count], i) => {
              const pct = stats.callStatus.total
                ? Math.round((count / stats.callStatus.total) * 100)
                : 0;
              const colors = [
                "#14b8a6",
                "#06b6d4",
                "#0ea5e9",
                "#38bdf8",
                "#7dd3fc",
              ];
              return (
                <div key={mode} className="flex items-center gap-[0.6vw]">
                  <div
                    className="w-[0.45vw] h-[0.45vw] rounded-full flex-shrink-0"
                    style={{ background: colors[i] }}
                  />
                  <span className="text-[0.72vw] text-gray-600 flex-1">
                    {mode}
                  </span>
                  <div className="w-[4vw] h-[0.35vw] bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: colors[i] }}
                    />
                  </div>
                  <span className="text-[0.72vw] font-bold text-gray-700 w-[1.5vw] text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Departments */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-1">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <Shield className="w-[1vw] h-[1vw] text-green-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">Team</h2>
          </div>
          {stats.depts.length === 0 ? (
            <p className="text-[0.75vw] text-gray-400 text-center py-[1vw]">
              No employees found
            </p>
          ) : (
            <div className="space-y-[0.5vw]">
              {stats.depts.map(([dept, count], i) => {
                const colors = [
                  "#10b981",
                  "#3b82f6",
                  "#f59e0b",
                  "#ef4444",
                  "#6366f1",
                ];
                return (
                  <div key={dept} className="flex items-center justify-between">
                    <div className="flex items-center gap-[0.5vw]">
                      <div
                        className="w-[1.6vw] h-[1.6vw] rounded-[0.3vw] flex items-center justify-center text-white text-[0.6vw] font-bold"
                        style={{ background: colors[i % colors.length] }}
                      >
                        {count}
                      </div>
                      <span className="text-[0.72vw] text-gray-600 truncate max-w-[8vw]">
                        {dept}
                      </span>
                    </div>
                    <div className="flex gap-[0.2vw]">
                      {Array.from({ length: Math.min(count, 5) }).map(
                        (_, j) => (
                          <div
                            key={j}
                            className="w-[0.55vw] h-[0.55vw] rounded-full"
                            style={{
                              background: colors[i % colors.length],
                              opacity: 0.6 + j * 0.1,
                            }}
                          />
                        ),
                      )}
                      {count > 5 && (
                        <span className="text-[0.6vw] text-gray-400 ml-[0.2vw]">
                          +{count - 5}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-[0.8vw] pt-[0.8vw] border-t border-gray-100">
            <p className="text-[1vw] font-bold text-gray-800">
              {raw.employees.length}{" "}
              <span className="text-[0.7vw] font-normal text-gray-400">
                total staff
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 4: Recent Calls + Escalation Status ── */}
      <div className="grid grid-cols-5 gap-[1vw]">
        {/* Recent Calls */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-3">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <Clock className="w-[1vw] h-[1vw] text-blue-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Recent Service Calls
            </h2>
          </div>
          {stats.recent.length === 0 ? (
            <div className="text-center py-[2vw] text-gray-300 text-[0.8vw]">
              No service calls recorded yet
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "Call No.",
                    "Customer",
                    "Mode",
                    "Category",
                    "Priority",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="pb-[0.5vw] text-[0.7vw] font-semibold text-gray-400 uppercase tracking-wide pr-[0.8vw]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recent.map((call, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-[0.55vw] pr-[0.8vw] font-mono text-[0.72vw] text-blue-600 font-semibold">
                      {call.callNumber}
                    </td>
                    <td className="py-[0.55vw] pr-[0.8vw] text-[0.72vw] text-gray-700 truncate max-w-[8vw]">
                      {call.customerName || "—"}
                    </td>
                    <td className="py-[0.55vw] pr-[0.8vw] text-[0.72vw] text-gray-500">
                      {call.mode || "—"}
                    </td>
                    <td className="py-[0.55vw] pr-[0.8vw] text-[0.72vw] text-gray-500 truncate max-w-[8vw]">
                      {call.category || "—"}
                    </td>
                    <td className="py-[0.55vw] pr-[0.8vw]">
                      <span
                        className={`text-[0.65vw] font-semibold px-[0.5vw] py-[0.15vw] rounded-full ${getPriorityBg(call.priority)}`}
                      >
                        {call.priority}
                      </span>
                    </td>
                    <td className="py-[0.55vw]">
                      <span
                        className={`text-[0.65vw] font-semibold px-[0.5vw] py-[0.15vw] rounded-full`}
                        style={{
                          background:
                            (STATUS_COLORS[call.status] || "#94a3b8") + "18",
                          color: STATUS_COLORS[call.status] || "#94a3b8",
                        }}
                      >
                        {call.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Escalation Summary */}
        <div className="bg-white border border-gray-100 rounded-[0.7vw] p-[1.2vw] shadow-sm col-span-2">
          <div className="flex items-center gap-[0.5vw] mb-[1vw]">
            <ArrowUpRight className="w-[1vw] h-[1vw] text-orange-500" />
            <h2 className="text-[0.85vw] font-bold text-gray-700">
              Escalation Overview
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-[0.7vw] mb-[1vw]">
            {[
              {
                label: "Total in Queue",
                value: stats.escStats.total,
                color: "#6366f1",
              },
              {
                label: "Pending",
                value: stats.escStats.pending,
                color: "#eab308",
              },
              {
                label: "Escalated",
                value: stats.escStats.escalated,
                color: "#f97316",
              },
              {
                label: "Resolved",
                value: stats.escStats.resolved,
                color: "#22c55e",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-[0.5vw] p-[0.8vw]"
                style={{
                  background: color + "0d",
                  border: `1px solid ${color}22`,
                }}
              >
                <p className="text-[1.2vw] font-bold" style={{ color }}>
                  {value}
                </p>
                <p className="text-[0.7vw] text-gray-500 mt-[0.1vw]">{label}</p>
              </div>
            ))}
          </div>

          {/* Resolution rate ring */}
          <div className="border-t border-gray-100 pt-[0.8vw] flex items-center gap-[1vw]">
            <div className="relative">
              <Donut
                segments={
                  stats.callStatus.total
                    ? [
                        { value: stats.resRate, color: "#22c55e" },
                        { value: 100 - stats.resRate, color: "#f1f5f9" },
                      ]
                    : [{ value: 100, color: "#f1f5f9" }]
                }
                size={60}
                stroke={8}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[0.75vw] font-bold text-gray-700">
                  {stats.resRate}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[0.8vw] font-bold text-gray-700">
                Resolution Rate
              </p>
              <p className="text-[0.7vw] text-gray-400">
                {stats.callStatus.resolved} of {stats.callStatus.total} calls
                resolved
              </p>
              {stats.escStats.critical > 0 && (
                <p className="text-[0.68vw] text-red-500 font-semibold mt-[0.2vw] flex items-center gap-[0.3vw]">
                  <Zap className="w-[0.7vw] h-[0.7vw]" />{" "}
                  {stats.escStats.critical} critical unresolved
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPriorityBg(p) {
  return (
    {
      Critical: "bg-red-50 text-red-600",
      High: "bg-orange-50 text-orange-600",
      Medium: "bg-yellow-50 text-yellow-700",
      Low: "bg-green-50 text-green-600",
    }[p] || "bg-gray-50 text-gray-600"
  );
}
