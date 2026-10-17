import { Link } from "react-router-dom";
import type { EmailItem } from "../types";
import { formatDateTime } from "../lib/format";

const tag: Record<EmailItem["status"], { cls: string; label: (e: EmailItem) => string }> = {
  scheduled: { cls: "bg-tag text-tag-ink", label: (e) => `Scheduled for ${formatDateTime(e.scheduled_at)}` },
  processing: { cls: "bg-blue-100 text-blue-700", label: () => "Sending" },
  sent: { cls: "bg-brand-soft text-brand-dark", label: () => "Sent" },
  failed: { cls: "bg-red-100 text-red-700", label: () => "Failed" },
};

export function EmailRow({ e }: { e: EmailItem }) {
  const t = tag[e.status];
  const when = e.sent_at ?? e.scheduled_at;
  return (
    <Link to={`/email/${e.id}`} className="flex items-center gap-4 border-b border-line px-4 py-3 text-sm hover:bg-field/60">
      <span className="w-48 shrink-0 truncate">To: {e.to_email}</span>
      <span className={`shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${t.cls}`}>{t.label(e)}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{e.subject}</span>
        <span className="text-muted"> - {e.preview}</span>
      </span>
      <span className="shrink-0 text-xs text-muted">{formatDateTime(when)}</span>
    </Link>
  );
}
