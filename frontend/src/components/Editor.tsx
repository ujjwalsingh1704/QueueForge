import { useRef } from "react";

const tools: { label: string; title: string; cmd: string; arg?: string; cls?: string }[] = [
  { label: "↶", title: "Undo", cmd: "undo" },
  { label: "↷", title: "Redo", cmd: "redo" },
  { label: "B", title: "Bold", cmd: "bold", cls: "font-bold" },
  { label: "I", title: "Italic", cmd: "italic", cls: "italic" },
  { label: "U", title: "Underline", cmd: "underline", cls: "underline" },
  { label: "S", title: "Strikethrough", cmd: "strikeThrough", cls: "line-through" },
  { label: "1.", title: "Numbered list", cmd: "insertOrderedList" },
  { label: "•", title: "Bulleted list", cmd: "insertUnorderedList" },
];

/** Minimal rich-text editor; outputs HTML which the worker sends as the email body. */
export function Editor({ onChange }: { onChange: (html: string, text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const run = (cmd: string, arg?: string) => { document.execCommand(cmd, false, arg); ref.current?.focus(); emit(); };
  const emit = () => onChange(ref.current?.innerHTML ?? "", ref.current?.innerText ?? "");

  return (
    <div className="rounded-lg border border-line bg-field/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
        {tools.map((t) => (
          <button key={t.title} type="button" title={t.title} aria-label={t.title}
            onMouseDown={(e) => { e.preventDefault(); run(t.cmd, t.arg); }}
            className={`grid size-7 place-items-center rounded text-sm text-muted hover:bg-white hover:text-ink ${t.cls ?? ""}`}>
            {t.label}
          </button>
        ))}
        <button type="button" title="Insert link" aria-label="Insert link"
          onMouseDown={(e) => { e.preventDefault(); const u = prompt("Link URL"); if (u) run("createLink", u); }}
          className="grid size-7 place-items-center rounded text-sm text-muted hover:bg-white hover:text-ink">🔗</button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit}
        role="textbox" aria-multiline="true" aria-label="Email body"
        className="min-h-72 px-4 py-3 text-sm outline-none empty:before:text-muted empty:before:content-['Type_your_reply...']" />
    </div>
  );
}
