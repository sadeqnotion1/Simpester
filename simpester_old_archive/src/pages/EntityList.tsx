import { Link } from "react-router-dom";
import { Topbar } from "../components/Topbar";
import { PageBody } from "../components/PageBody";
import { GlassPanel } from "../components/GlassPanel";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import { ENTITIES } from "../lib/data";

export function EntityList() {
  return (
    <>
      <Topbar title="Manage Entities" search="Global Search..." />
      <PageBody>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
            />
            <input className="input pl-9" placeholder="Search entities..." />
          </div>
          <button className="btn-secondary">
            <Icon name="filter_list" className="text-[18px]" />
            Status
            <Icon name="arrow_drop_down" className="text-[18px]" />
          </button>
          <button className="btn-secondary">
            <Icon name="category" className="text-[18px]" />
            Type
            <Icon name="arrow_drop_down" className="text-[18px]" />
          </button>
          <button className="btn-primary">
            <Icon name="add" className="text-[18px]" />
            New Entity
          </button>
        </div>

        {/* Table */}
        <GlassPanel className="mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-on-surface-variant">
                  <th className="px-6 py-4 font-semibold">Entity Name</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Last Active</th>
                  <th className="px-6 py-4 font-semibold">Value</th>
                  <th className="px-6 py-4 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {ENTITIES.map((entity) => (
                  <tr
                    key={entity.id}
                    className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                          <Icon
                            name={entity.icon}
                            className="text-[18px] text-primary"
                          />
                        </div>
                        <div>
                          <Link
                            to={`/entities/${entity.id}`}
                            className="font-medium text-on-surface hover:text-primary"
                          >
                            {entity.name}
                          </Link>
                          <p className="text-[11px] text-on-surface-variant">
                            ID: {entity.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {entity.type}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={entity.status} />
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {entity.lastActive}
                    </td>
                    <td className="px-6 py-4 font-medium">{entity.value}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1 text-on-surface-variant">
                        <button className="rounded-md p-1.5 hover:bg-white/10 hover:text-on-surface">
                          <Icon name="visibility" className="text-[18px]" />
                        </button>
                        <button className="rounded-md p-1.5 hover:bg-white/10 hover:text-on-surface">
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        <button className="rounded-md p-1.5 hover:bg-error/10 hover:text-error">
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer / pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 text-sm text-on-surface-variant">
            <span>
              Showing <span className="text-on-surface">1</span> to{" "}
              <span className="text-on-surface">4</span> of{" "}
              <span className="text-on-surface">24</span> results
            </span>
            <div className="flex items-center gap-1">
              <button className="rounded-md p-1.5 hover:bg-white/10 hover:text-on-surface">
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
              <button className="h-8 w-8 rounded-md bg-primary/20 text-sm font-semibold text-white">
                1
              </button>
              <button className="h-8 w-8 rounded-md hover:bg-white/10 hover:text-on-surface">
                2
              </button>
              <button className="h-8 w-8 rounded-md hover:bg-white/10 hover:text-on-surface">
                3
              </button>
              <span className="px-1">...</span>
              <button className="rounded-md p-1.5 hover:bg-white/10 hover:text-on-surface">
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>
          </div>
        </GlassPanel>
      </PageBody>
    </>
  );
}
