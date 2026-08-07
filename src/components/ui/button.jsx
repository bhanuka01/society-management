import * as React from "react";
import { cn } from "../../lib/utils";

const buttonVariants = {
  default: "bg-indigo-600 text-white shadow hover:bg-indigo-500 active:bg-indigo-700",
  secondary: "bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700 active:bg-zinc-800",
  outline: "border border-zinc-700 bg-transparent text-zinc-200 shadow-sm hover:bg-zinc-800/80 hover:text-white",
  ghost: "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
  destructive: "bg-rose-600 text-white shadow-sm hover:bg-rose-500",
};

const buttonSizes = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8 text-base",
  icon: "h-9 w-9 p-0 flex items-center justify-center",
};

const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50",
          buttonVariants[variant] || buttonVariants.default,
          buttonSizes[size] || buttonSizes.default,
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
