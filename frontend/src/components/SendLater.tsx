import { useState } from "react";
import { Button } from "./Button";
import { quickTimes, toLocalInput } from "../lib/format";

export function SendLater({ onCancel, onDone }: { onCancel: () => void; onDone: (d: Date) => void }) {
  const [value, setValue] = useState(toLocalInput(new Date(Date.now() + 3600_000)));
  return (
    <div className="absolute right-0 top-10 z-20 w-64 rounded-lg border border-line bg-white p-3 shadow-lg">
      <div className="mb-2 text-sm font-medium">Send later</div>
      <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)}
        className="mb-2 w-full rounded-md border border-line bg-field px-2 py-1.5 text-sm" />
      <ul className="mb-3 text-sm">
        {quickTimes().map((q) => (
          <li key={q.label}>
            <button type="button" onClick={() => setValue(toLocalInput(q.date))}
              className="w-full rounded px-2 py-1.5 text-left text-muted hover:bg-field hover:text-ink">{q.label}</button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onDone(new Date(value))}>Done</Button>
      </div>
    </div>
  );
}
