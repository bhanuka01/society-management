import * as React from "react";
import { cn } from "../../lib/utils";

const Progress = React.forwardRef(({ className, value = 0, max = 100, ...props }, ref) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / (max || 1)) * 100)));

  return (
    <div
      ref={ref}
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/80 border border-zinc-700/50", className)}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500 ease-in-out"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
});
Progress.displayName = "Progress";

export { Progress };
