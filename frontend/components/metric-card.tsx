import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <article
      className={`surface-card group relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] sm:p-5 ${accent ? "border-accent/20" : ""}`}
    >
      {accent && (
        <div className="absolute -right-6 -top-6 size-24 rounded-full bg-accent/5 blur-2xl" />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted sm:text-[11px]">{label}</p>
          <p className="mt-3 truncate font-mono-ui text-[28px] font-medium leading-none tracking-[-.07em] text-ink sm:text-[31px]">
            {value}
          </p>
        </div>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${accent ? "border-accent/15 bg-accent-soft text-accent-strong" : "border-line bg-surface-soft text-muted"}`}
        >
          <Icon size={16} strokeWidth={1.8} />
        </span>
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-2">
        <p className="truncate text-[9px] text-muted">{hint}</p>
        {trend && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold ${trend.positive ? "text-accent-strong" : "text-warning"}`}
          >
            {trend.positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend.value}
          </span>
        )}
      </div>
    </article>
  );
}
