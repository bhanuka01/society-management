import * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = {
  default: "border-transparent bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30",
  secondary: "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700/80",
  destructive: "border-transparent bg-rose-950/40 text-rose-400 border-rose-900/50 hover:bg-rose-900/50",
  outline: "text-zinc-300 border-zinc-700/70",
  success: "border-transparent bg-emerald-950/40 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/50",
  warning: "border-transparent bg-amber-950/40 text-amber-400 border-amber-900/50 hover:bg-amber-900/50",
};

function Badge({ className, variant = "default", ...props }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2",
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
