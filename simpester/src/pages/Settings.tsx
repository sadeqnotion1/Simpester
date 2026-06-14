import { useState } from "react";
import { Topbar } from "../components/Topbar";
import { PageBody } from "../components/PageBody";
import { GlassPanel } from "../components/GlassPanel";
import { Icon } from "../components/Icon";
import { Toggle } from "../components/Toggle";

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-6 border-t border-white/10 pt-6">{children}</div>
    </GlassPanel>
  );
}

export function Settings() {
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const apiKey = "sk_live_••••••••••••••••••••••••••••••••••••";

  return (
    <>
      <Topbar title="System Settings" search={null} />
      <PageBody>
        <div className="mx-auto max-w-3xl space-y-5 pb-28">
          <Section
            title="Account Profile"
            description="Manage your administrative identity and primary contact."
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label">Full Name</label>
                <input
                  className="input mt-2"
                  defaultValue="Administrator Alpha"
                />
              </div>
              <div>
                <label className="field-label">Email Address</label>
                <input
                  className="input mt-2"
                  defaultValue="admin@simpester.net"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Alerts & Notifications"
            description="Configure global alert thresholds and delivery methods."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Critical System Alerts</p>
                  <p className="text-xs text-on-surface-variant">
                    Immediate notification on core subsystem failure.
                  </p>
                </div>
                <Toggle
                  checked={criticalAlerts}
                  onChange={setCriticalAlerts}
                  label="Critical System Alerts"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Weekly Telemetry Digest</p>
                  <p className="text-xs text-on-surface-variant">
                    Aggregated statistics sent via secure channel.
                  </p>
                </div>
                <Toggle
                  checked={weeklyDigest}
                  onChange={setWeeklyDigest}
                  label="Weekly Telemetry Digest"
                />
              </div>
            </div>
          </Section>

          <Section
            title="API Authentication"
            description="Manage integration keys for external protocol access."
            action={
              <button className="btn-secondary">
                <Icon name="add" className="text-[18px]" /> Generate
              </button>
            }
          >
            <label className="field-label">Production Key (v2)</label>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm">
                {showKey ? apiKey : "\u2022".repeat(40)}
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(apiKey)}
                className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
                aria-label="Copy key"
              >
                <Icon name="content_copy" className="text-[18px]" />
              </button>
              <button
                onClick={() => setShowKey((v) => !v)}
                className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
                aria-label="Toggle key visibility"
              >
                <Icon
                  name={showKey ? "visibility_off" : "visibility"}
                  className="text-[18px]"
                />
              </button>
            </div>
          </Section>
        </div>

        {/* Sticky save bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-bg/70 backdrop-blur-xl lg:left-[260px]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-4">
            <span className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="h-2 w-2 rounded-full bg-tertiary animate-pulseGlow" />
              Unsaved changes detected.
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary">Discard</button>
              <button className="btn-primary">
                <Icon name="save" className="text-[18px]" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
