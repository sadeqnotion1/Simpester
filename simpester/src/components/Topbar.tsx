import type { ReactNode } from "react";
import { Icon } from "./Icon";

type TopbarProps = {
  title: string;
  search?: string | null;
  actions?: ReactNode;
};

export function Topbar({ title, search = "Search...", actions }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-bg/60 px-6 py-5 backdrop-blur-xl md:px-8">
      <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
        {title}
      </h2>
      <div className="flex items-center gap-3">
        {search && (
          <div className="relative hidden sm:block">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
            />
            <input className="input w-56 pl-9 lg:w-72" placeholder={search} />
          </div>
        )}
        {actions}
        <button className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface">
          <Icon name="notifications" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-container ring-2 ring-white/10" />
      </div>
    </header>
  );
}
