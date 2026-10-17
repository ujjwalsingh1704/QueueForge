export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export const formatFull = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export const toLocalInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** "Tomorrow, 10:00 AM" style quick options for Send later */
export function quickTimes(): { label: string; date: Date }[] {
  const at = (h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d; };
  return [
    { label: "Tomorrow, 10:00 AM", date: at(10) },
    { label: "Tomorrow, 11:00 AM", date: at(11) },
    { label: "Tomorrow, 3:00 PM", date: at(15) },
  ];
}
