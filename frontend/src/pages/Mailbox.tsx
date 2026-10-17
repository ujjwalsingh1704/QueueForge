import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { EmailRow } from "../components/EmailRow";
import { RefreshIcon, SearchIcon } from "../components/Icons";
import type { EmailItem } from "../types";
import type { LayoutCtx } from "./Layout";

type Kind = "scheduled" | "sent";
const inKind = (k: Kind) => (e: EmailItem) =>
  (k === "sent" ? ["sent", "failed"] : ["scheduled", "processing"]).includes(e.status);

export default function Mailbox({ kind }: { kind: Kind }) {
  const toast = useToast();
  const { refreshCounts } = useOutletContext<LayoutCtx>();
  const [items, setItems] = useState<EmailItem[] | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim();

  const load = useCallback(async (silent = false) => {
    if (!silent) setItems(null);
    try {
      const data = q ? (await api.search(q)).filter(inKind(kind)) : await api.listEmails(kind);
      setItems(data);
    } catch (e) {
      toast((e as Error).message, "error");
      setItems((cur) => cur ?? []);
    }
  }, [kind, q, toast]);

  useEffect(() => {
    const t = setTimeout(() => load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    const id = setInterval(() => load(true), 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-field px-4 py-2 text-muted">
          <SearchIcon width={16} height={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
            className="w-full bg-transparent text-sm text-ink outline-none" />
        </label>
        <button aria-label="Refresh" onClick={() => { load(); refreshCounts(); }}
          className="rounded-full p-2 text-muted hover:bg-field"><RefreshIcon /></button>
      </div>

      {items === null ? (
        <div className="space-y-2 p-4" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 animate-pulse rounded bg-field" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-24 text-center">
          <p className="font-medium">{q ? "No matches" : kind === "sent" ? "Nothing sent yet" : "Nothing scheduled"}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? "Try a different search." : kind === "sent" ? "Delivered emails show up here." : "Use Compose to schedule your first batch."}
          </p>
        </div>
      ) : (
        items.map((e) => <EmailRow key={e.id} e={e} />)
      )}
    </div>
  );
}
