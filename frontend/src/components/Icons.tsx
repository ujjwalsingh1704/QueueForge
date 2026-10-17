import type { SVGProps } from "react";

const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
type P = SVGProps<SVGSVGElement>;

export const BackIcon = (p: P) => <svg {...base} {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
export const SearchIcon = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
export const RefreshIcon = (p: P) => <svg {...base} {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>;
export const ClockIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const ClockListIcon = (p: P) => <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>;
export const SendIcon = (p: P) => <svg {...base} {...p}><path d="m22 2-7 20-4-9-9-4zM22 2 11 13" /></svg>;
