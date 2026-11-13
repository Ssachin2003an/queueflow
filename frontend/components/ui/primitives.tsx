import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

const badgeColors: Record<string, string> = {
  active: "border-accent/20 bg-accent-soft text-accent-strong",
  waiting: "border-warning/20 bg-warning-soft text-warning",
  serving: "border-accent/20 bg-accent-soft text-accent-strong",
  completed: "border-line bg-surface-soft text-muted",
  cancelled: "border-danger/20 bg-danger-soft text-danger",
  paused: "border-warning/20 bg-warning-soft text-warning",
  closed: "border-line bg-surface-soft text-muted",
  called: "border-accent/20 bg-accent-soft text-accent-strong",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize tracking-wide",
        badgeColors[status] ?? "border-line bg-surface-soft text-muted",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ["active", "serving", "called"].includes(status)
            ? "bg-accent"
            : status === "cancelled"
              ? "bg-danger"
              : status === "paused" || status === "waiting"
                ? "bg-warning"
                : "bg-muted/60",
        )}
      />
      {status}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn("block animate-pulse rounded-lg bg-surface-soft", className)}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-soft text-accent">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/20 bg-danger-soft/50 px-5 py-4 text-sm text-danger">
      <p>{message}</p>
      {retry && (
        <button onClick={retry} className="mt-2 text-xs font-bold underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}
