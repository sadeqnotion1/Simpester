import { useState } from "react";
import { Topbar } from "../components/Topbar";
import { PageBody } from "../components/PageBody";
import { GlassPanel } from "../components/GlassPanel";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { PerformanceChart } from "../components/PerformanceChart";
import { ACTIVITY, KPIS, THROUGHPUT } from "../lib/data";

const RANGES = ["1H", "24H", "7D"] as const;

export function Overview() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("24H");

  return (
    <>
      <Topbar title="Dashboard Overview" search="Search systems..." />
      <PageBody>
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((kpi) => (
            <GlassPanel key={kpi.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="field-label">{kpi.label}</span>
                <Icon
                  name={kpi.icon}
                  className="text-[20px] text-on-surface-variant"
                />
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-display text-4xl font-bold leading-none tracking-tight">
                  {kpi.value}
                </span>
                {kpi.unit && (
                  <span className="mb-0.5 text-lg font-medium text-on-surface-variant">
                    {kpi.unit}
                  </span>
                )}
                {kpi.trend && (
                  <span className="mb-1 ml-1 inline-flex items-center gap-0.5 text-xs font-semibold text-success">
                    <Icon
                      name={kpi.trendIcon ?? "trending_up"}
                      className="text-[14px]"
                    />
                    {kpi.trend}
                  </span>
                )}
                {kpi.badge && (
                  <span className="mb-1 ml-1">
                    <StatusBadge status={kpi.badge} showDot={false} />
                  </span>
                )}
              </div>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${kpi.barColor}`}
                  style={{ width: `${kpi.bar}%` }}
                />
              </div>
            </GlassPanel>
          ))}
        </div>

        {/* Chart + activity */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <GlassPanel className="flex flex-col p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Network Performance
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Throughput over the last 24 hours
                </p>
              </div>
              <div className="flex rounded-lg border border-white/10 bg-black/20 p-1">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      range === r
                        ? "bg-primary/20 text-white"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-1 gap-3">
              <div className="flex flex-col justify-between py-1 text-[10px] text-on-surface-variant">
                <span>10k</span>
                <span>5k</span>
                <span>0</span>
              </div>
              <div className="h-[260px] flex-1">
                <PerformanceChart data={THROUGHPUT[range]} />
              </div>
            </div>
            <div className="ml-9 mt-2 flex justify-between text-[10px] text-on-surface-variant">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>Now</span>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">
                Recent Activity
              </h3>
              <button className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:underline">
                View All
              </button>
            </div>
            <ul className="mt-5 space-y-5">
              {ACTIVITY.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Icon
                      name={item.icon}
                      className="text-[15px] text-on-surface-variant"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-on-surface-variant">
                        {item.time}
                      </span>
                      <StatusBadge status={item.status} showDot={false} />
                    </div>
                    <p className="mt-1 text-sm leading-snug text-on-surface">
                      {item.body.text}
                      {item.body.strong && (
                        <strong className="font-semibold text-white">
                          {item.body.strong}
                        </strong>
                      )}
                      {item.body.tail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>
      </PageBody>
    </>
  );
}
