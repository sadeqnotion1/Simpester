import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[260px]">
        <Outlet />
      </div>
    </div>
  );
}
