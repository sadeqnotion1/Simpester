type StatusBadgeProps = {
  status: string;
  showDot?: boolean;
};

const STYLES: Record<string, string> = {
  active: "text-success border-success/30 bg-success/10",
  online: "text-success border-success/30 bg-success/10",
  success: "text-success border-success/30 bg-success/10",
  syncing: "text-tertiary border-tertiary/30 bg-tertiary/10",
  warning: "text-tertiary border-tertiary/30 bg-tertiary/10",
  system: "text-primary border-primary/30 bg-primary/10",
  offline: "text-on-surface-variant border-white/15 bg-white/5",
  critical: "text-error border-error/30 bg-error/10",
  error: "text-error border-error/30 bg-error/10",
};

export function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const cls = STYLES[status.toLowerCase()] ?? STYLES.offline;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      {showDot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {status}
    </span>
  );
}
