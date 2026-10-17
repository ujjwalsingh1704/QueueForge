import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { api } from "../lib/api";
import type { Counts, User } from "../types";

export interface LayoutCtx { refreshCounts: () => void }

export default function Layout({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const refreshCounts = useCallback(() => { api.counts().then(setCounts).catch(() => {}); }, []);

  useEffect(() => {
    refreshCounts();
    const id = setInterval(refreshCounts, 5000);
    return () => clearInterval(id);
  }, [refreshCounts]);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} counts={counts} onLogout={onLogout} />
      <main className="min-w-0 flex-1">
        <Outlet context={{ refreshCounts } satisfies LayoutCtx} />
      </main>
    </div>
  );
}
