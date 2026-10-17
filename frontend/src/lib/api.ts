import type { Counts, EmailDetail, EmailItem, ScheduleRequest, User } from "../types";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong", res.status);
  return data as T;
}

export const api = {
  me: () => req<User>("/auth/me"),
  logout: () => req<{ ok: true }>("/auth/logout", { method: "POST" }),
  counts: () => req<Counts>("/api/emails/counts"),
  listEmails: (status: "scheduled" | "sent") => req<EmailItem[]>(`/api/emails?status=${status}`),
  getEmail: (id: string) => req<EmailDetail>(`/api/emails/${id}`),
  search: (q: string) => req<EmailItem[]>(`/api/emails/search?q=${encodeURIComponent(q)}`),
  schedule: (body: ScheduleRequest) =>
    req<{ scheduled: number }>("/api/emails/schedule", { method: "POST", body: JSON.stringify(body) }),
  slackStatus: () => req<{ connected: boolean; channel: string | null }>("/api/slack/status"),
  slackDisconnect: () => req<{ connected: boolean; channel: string | null }>("/api/slack", { method: "DELETE" }),
};
