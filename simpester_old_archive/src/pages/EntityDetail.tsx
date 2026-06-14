import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Topbar } from "../components/Topbar";
import { PageBody } from "../components/PageBody";
import { GlassPanel } from "../components/GlassPanel";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { Toggle } from "../components/Toggle";

const TABS = [
  { key: "general", label: "General", icon: "info" },
  { key: "logs", label: "Logs", icon: "terminal" },
  { key: "metrics", label: "Metrics", icon: "monitoring" },
  { key: "security", label: "Security", icon: "shield" },
];

const RESOURCES = [
  { label: "CPU Usage", value: 45, color: "bg-accent" },
  { label: "Memory (32GB)", value: 68, color: "bg-tertiary" },
  { label: "Storage (1TB NVMe)", value: 22, color: "bg-success" },
];

export function EntityDetail() {
  const { id } = useParams();
  const nodeName = "SYS-NODE-042";
  const [tab, setTab] = useState("general");
  const [autoScaling, setAutoScaling] = useState(true);
  const [debugLogging, setDebugLogging] = useState(false);
  const [maintenance, setMaintenance] = useState(false);

  return (
    <>
      <Topbar title="" search={null} />
      <PageBody>
        {/* Breadcrumb */}
        <div className="-mt-2 flex items-center gap-1 text-sm text-on-surface-variant">
          <Link to="/entities" className="hover:text-on-surface">
            Entities
          </Link>
          <Icon name="chevron_right" className="text-[18px]" />
          <span className="text-on-surface">{id ?? nodeName}</span>
        </div>

        {/* Header */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant">
              <StatusBadge status="Online" />
              <span className="inline-flex items-center gap-1">
                <Icon name="calendar_today" className="text-[14px]" /> Created:
                Oct 24, 2023
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon name="memory" className="text-[14px]" /> Cluster: Alpha-7
              </span>
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">
              {nodeName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary">
              <Icon name="stop_circle" className="text-[18px]" /> Stop
            </button>
            <button className="btn-secondary">
              <Icon name="download" className="text-[18px]" /> Export
            </button>
            <button className="btn-primary">
              <Icon name="play_arrow" className="text-[18px]" /> Run Diagnostics
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-6 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-primary text-white"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon
                name={t.icon}
                className="text-[18px]"
                filled={tab === t.key}
              />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content grid */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <GlassPanel className="p-6">
              <div className="flex items-center gap-2">
                <Icon name="dns" className="text-[20px] text-primary" />
                <h3 className="font-display text-lg font-semibold">
                  System Overview
                </h3>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
                {[
                  ["Architecture", "x86_64"],
                  ["OS Version", "Ubuntu 22.04 LTS"],
                  ["Kernel", "5.15.0-generic"],
                  ["Uptime", "42d 16h 22m"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="field-label">{k}</p>
                    <p className="mt-1 text-sm font-medium text-on-surface">
                      {v}
                    </p>
                  </div>
                ))}
              </div>
            </GlassPanel>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                  <Icon name="memory" className="text-[20px] text-primary" />
                  <h3 className="font-display text-lg font-semibold">
                    Resource Allocation
                  </h3>
                </div>
                <div className="mt-5 space-y-4">
                  {RESOURCES.map((r) => (
                    <div key={r.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant">
                          {r.label}
                        </span>
                        <span className="font-semibold text-on-surface">
                          {r.value}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full ${r.color}`}
                          style={{ width: `${r.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>

              <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                  <Icon name="router" className="text-[20px] text-primary" />
                  <h3 className="font-display text-lg font-semibold">
                    Network Interfaces
                  </h3>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    { icon: "lan", name: "eth0", ip: "192.168.1.104" },
                    { icon: "vpn_key", name: "tun0", ip: "10.8.0.14" },
                  ].map((n) => (
                    <div
                      key={n.name}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          name={n.icon}
                          className="text-[18px] text-on-surface-variant"
                        />
                        <div>
                          <p className="text-sm font-medium">{n.name}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {n.ip}
                          </p>
                        </div>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-success animate-pulseGlow" />
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <GlassPanel className="p-6">
              <h3 className="font-display text-lg font-semibold">
                Quick Configuration
              </h3>
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-scaling</span>
                  <Toggle
                    checked={autoScaling}
                    onChange={setAutoScaling}
                    label="Auto-scaling"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Debug Logging</span>
                  <Toggle
                    checked={debugLogging}
                    onChange={setDebugLogging}
                    label="Debug Logging"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Maintenance Mode</span>
                  <Toggle
                    checked={maintenance}
                    onChange={setMaintenance}
                    label="Maintenance Mode"
                  />
                </div>
              </div>
            </GlassPanel>

            <div className="rounded-xl border border-error/30 bg-error/5 p-6">
              <div className="flex items-center gap-2 text-error">
                <Icon name="warning" className="text-[20px]" />
                <h3 className="font-display text-lg font-semibold">
                  Danger Zone
                </h3>
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                Once you delete an entity, there is no going back. Please be
                certain.
              </p>
              <button className="btn mt-4 w-full border border-error/40 bg-error/10 text-error hover:bg-error/20">
                Delete Entity
              </button>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
