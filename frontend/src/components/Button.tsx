import type { ButtonHTMLAttributes } from "react";

type Variant = "solid" | "outline" | "soft" | "ghost";
const styles: Record<Variant, string> = {
  solid: "bg-brand text-white hover:bg-brand-dark disabled:opacity-60",
  outline: "border border-brand text-brand hover:bg-brand-soft disabled:opacity-60",
  soft: "bg-brand-soft text-ink hover:bg-[#d9eee1] disabled:opacity-60",
  ghost: "text-muted hover:bg-field disabled:opacity-60",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; loading?: boolean }

export function Button({ variant = "solid", loading, children, className = "", disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${styles[variant]} ${className}`}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
