import { NavLink, useNavigate } from "react-router-dom";
import type { Counts, User } from "../types";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { SlackButton } from "./SlackButton";
import { ClockListIcon, SendIcon } from "./Icons";

export function Sidebar({ user, counts, onLogout }: { user: User; counts: Counts | null; onLogout: () => void }) {
  const nav = useNavigate();
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? "bg-brand-soft font-medium" : "text-ink hover:bg-field"}`;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line p-4">
      <div className="mb-4 text-2xl font-extrabold tracking-tight">OUTBOX</div>

      <div className="flex items-center gap-3 rounded-lg bg-field p-2">
        <Avatar src={user.avatar} name={user.name ?? user.email} />
        <div className="min-w-0 text-xs leading-tight">
          <div className="truncate font-medium">{user.name}</div>
          <div className="truncate text-muted">{user.email}</div>
        </div>
      </div>

      <Button variant="outline" className="mt-3 w-full" onClick={() => nav("/compose")}>Compose</Button>

      <div className="mb-1 mt-5 px-3 text-xs text-muted">Mails</div>
      <nav className="space-y-1">
        <NavLink to="/scheduled" className={item}>
          <ClockListIcon width={16} height={16} /> <span className="flex-1">Scheduled</span>
          <span className="text-xs text-muted">{counts?.scheduled ?? ""}</span>
        </NavLink>
        <NavLink to="/sent" className={item}>
          <SendIcon width={16} height={16} /> <span className="flex-1">Sent</span>
          <span className="text-xs text-muted">{counts?.sent ?? ""}</span>
        </NavLink>
      </nav>

      <div className="mt-auto space-y-1 pt-6">
        <SlackButton />
        <button onClick={onLogout} className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-field">Log out</button>
      </div>
    </aside>
  );
}
