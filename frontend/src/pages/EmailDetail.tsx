import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Avatar } from "../components/Avatar";
import { BackIcon } from "../components/Icons";
import { useToast } from "../components/Toast";
import { formatFull } from "../lib/format";
import type { EmailDetail as Detail } from "../types";

export default function EmailDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [mail, setMail] = useState<Detail | null>(null);

  useEffect(() => {
    api.getEmail(id!).then(setMail).catch((e) => { toast(e.message, "error"); nav(-1); });
  }, [id, nav, toast]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-4">
      <div className="mb-6 flex items-center gap-3 border-b border-line pb-3">
        <button aria-label="Back" onClick={() => nav(-1)} className="rounded p-1 hover:bg-field"><BackIcon /></button>
        <h1 className="truncate text-base font-medium">{mail ? `${mail.to_email} | ${mail.subject}` : "Loading…"}</h1>
      </div>
      {mail && (
        <article>
          <div className="mb-4 flex items-start gap-3">
            <Avatar name={mail.sender_email} />
            <div className="text-sm">
              <div className="font-medium">{mail.sender_email}</div>
              <div className="text-muted">to {mail.to_email} · {formatFull(mail.sent_at ?? mail.scheduled_at)}</div>
            </div>
            <span className="ml-auto text-xs capitalize text-muted">{mail.status}</span>
          </div>
          <div className="mb-3 text-lg font-semibold">{mail.subject}</div>
          {/* sandboxed: user-authored HTML can't run scripts in our origin */}
          <iframe title="Email body" sandbox="" srcDoc={mail.body} className="h-96 w-full rounded-lg border border-line" />
          {mail.error && <p className="mt-3 text-sm text-red-600">Delivery failed: {mail.error}</p>}
          {mail.preview_url && (
            <a href={mail.preview_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brand underline">
              Open Ethereal preview
            </a>
          )}
        </article>
      )}
    </div>
  );
}
