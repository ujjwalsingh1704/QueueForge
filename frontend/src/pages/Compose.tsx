import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { extractEmails } from "../lib/csv";
import { Button } from "../components/Button";
import { Editor } from "../components/Editor";
import { SendLater } from "../components/SendLater";
import { useToast } from "../components/Toast";
import { BackIcon, ClockIcon } from "../components/Icons";

const label = "w-28 shrink-0 text-sm text-muted";
const small = "w-16 rounded-md bg-field px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-brand/30";

export default function Compose() {
  const nav = useNavigate();
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [delay, setDelay] = useState("2");
  const [limit, setLimit] = useState("");
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);

  const addRecipients = (list: string[]) => setRecipients((r) => [...new Set([...r, ...list])]);
  const commitDraft = () => { addRecipients(extractEmails(draft)); setDraft(""); };
  const onKey = (e: KeyboardEvent) => {
    if (["Enter", ",", " "].includes(e.key) && draft.trim()) { e.preventDefault(); commitDraft(); }
    if (e.key === "Backspace" && !draft) setRecipients((r) => r.slice(0, -1));
  };

  async function send(at?: Date) {
    const pending = draft.trim() ? [...recipients, ...extractEmails(draft)] : recipients;
    if (!pending.length) return toast("Add at least one recipient", "error");
    if (!subject.trim()) return toast("Add a subject", "error");
    if (!text.trim()) return toast("Write a message first", "error");
    const start = at ?? new Date(Date.now() + 5000);
    if (at && at.getTime() < Date.now()) return toast("Pick a time in the future", "error");
    setBusy(true);
    try {
      const res = await api.schedule({
        subject, body: html, recipients: [...new Set(pending)], startTime: start.toISOString(),
        delaySeconds: Number(delay) || 0, hourlyLimit: limit ? Number(limit) : undefined,
      });
      toast(`Scheduled ${res.scheduled} email${res.scheduled === 1 ? "" : "s"}`);
      nav("/scheduled");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      setLater(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-4">
      <div className="mb-6 flex items-center gap-3 border-b border-line pb-3">
        <button aria-label="Back" onClick={() => nav(-1)} className="rounded p-1 hover:bg-field"><BackIcon /></button>
        <h1 className="flex-1 text-base font-medium">Compose New Email</h1>
        <div className="relative flex items-center gap-2">
          <button aria-label="Send later" onClick={() => setLater((v) => !v)} className="rounded p-2 text-muted hover:bg-field"><ClockIcon /></button>
          <Button variant="outline" loading={busy} onClick={() => send()}>Send</Button>
          {later && <SendLater onCancel={() => setLater(false)} onDone={send} />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={label}>From</span>
          <span className="rounded-full bg-field px-3 py-1 text-sm">Rotating Ethereal senders</span>
        </div>

        <div className="flex items-start gap-3">
          <span className={`${label} pt-1.5`}>To</span>
          <div className="flex min-h-9 flex-1 flex-wrap items-center gap-1.5 border-b border-line pb-1">
            {recipients.map((r) => (
              <span key={r} className="flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs">
                {r}
                <button aria-label={`Remove ${r}`} onClick={() => setRecipients((l) => l.filter((x) => x !== r))} className="text-muted hover:text-ink">×</button>
              </span>
            ))}
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={commitDraft}
              placeholder={recipients.length ? "" : "recipient@example.com"} className="min-w-40 flex-1 bg-transparent py-1 text-sm outline-none" />
          </div>
          <label className="cursor-pointer whitespace-nowrap pt-1.5 text-sm text-brand hover:underline">
            + Upload List
            <input type="file" accept=".csv,.txt" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const found = extractEmails(await f.text());
              addRecipients(found);
              toast(`${found.length} email address${found.length === 1 ? "" : "es"} found in ${f.name}`);
              e.target.value = "";
            }} />
          </label>
        </div>
        {recipients.length > 0 && <p className="pl-[7.75rem] text-xs text-muted">{recipients.length} recipient{recipients.length === 1 ? "" : "s"}</p>}

        <div className="flex items-center gap-3">
          <span className={label}>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
            className="flex-1 border-b border-line py-1.5 text-sm outline-none focus:border-brand" />
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <label className="flex items-center gap-3 text-sm text-muted">
            <span className={label}>Delay between 2 emails</span>
            <input type="number" min={0} value={delay} onChange={(e) => setDelay(e.target.value)} className={small} />
            <span className="text-xs">sec</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-muted">
            Hourly Limit
            <input type="number" min={1} value={limit} placeholder="Default" onChange={(e) => setLimit(e.target.value)} className={small} />
          </label>
        </div>

        <Editor onChange={(h, t) => { setHtml(h); setText(t); }} />
      </div>
    </div>
  );
}
