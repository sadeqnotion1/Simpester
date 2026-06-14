import type { ReactNode } from "react";

export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">{children}</div>
  );
}
