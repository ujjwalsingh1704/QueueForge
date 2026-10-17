import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "./Toast";

export function SlackButton() {
  const [state, setState] = useState<{ connected: boolean; channel: string | null } | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.slackStatus().then(setState).catch(() => setState({ connected: false, channel: null }));
    const p = new URLSearchParams(window.location.search).get("slack");
    if (p === "connected") toast("Slack connected");
    if (p === "error") toast("Couldn't connect Slack. Try again.", "error");
  }, [toast]);

  if (!state) return null;
  const cls = "w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-field";

  return state.connected ? (
    <button className={cls} onClick={async () => {
      try { setState(await api.slackDisconnect()); toast("Slack disconnected"); }
      catch (e) { toast((e as Error).message, "error"); }
    }}>
      Slack {state.channel ?? ""} · Disconnect
    </button>
  ) : (
    <button className={cls} onClick={() => (window.location.href = "/api/slack/connect")}>Connect Slack</button>
  );
}
