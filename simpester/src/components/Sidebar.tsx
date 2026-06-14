import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

const NAV = [
  { to: "/", icon: "dashboard", label: "Overview", end: true },
  { to: "/entities", icon: "list_alt", label: "Entity List", end: false },
  { to: "/settings", icon: "settings", label: "Settings", end: false },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/10 bg-[#0b0910]/70 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-6 py-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
          <Icon name="hub" className="text-[22px]" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold leading-none tracking-tight">
            Simpester
          </h1>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
            Elite Control
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4 py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "border-l-2 border-primary bg-primary/10 text-white"
                  : "border-l-2 border-transparent text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.icon}
                  filled={isActive}
                  className="text-[20px]"
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface">
          <Icon name="account_circle" className="text-[22px]" />
          Profile
        </button>
      </div>
    </aside>
  );
}
