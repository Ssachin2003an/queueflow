import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink shadow-sm shadow-black/[.015] transition placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:opacity-55",
        invalid ? "border-danger" : "border-line",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-2 block text-[12px] font-semibold text-ink", className)} {...props} />
  );
}
