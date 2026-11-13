"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";

export type Period = "today" | "7d" | "30d" | "custom";
export type DateRange = { period: Period; from?: string; to?: string };

export function periodRange(period: Period, from?: string, to?: string) {
  if (period === "custom") {
    const start = from ? new Date(`${from}T00:00:00`) : undefined;
    const end = to ? new Date(`${to}T23:59:59.999`) : undefined;
    return {
      from: start && !Number.isNaN(start.getTime()) ? start.toISOString() : undefined,
      to: end && !Number.isNaN(end.getTime()) ? end.toISOString() : undefined,
    };
  }
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  if (period === "today") start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - (period === "7d" ? 6 : 29));
  return { from: start.toISOString(), to: end.toISOString() };
}

export function TimeFilter({
  value,
  onChangeAction,
}: {
  value: DateRange;
  onChangeAction: (value: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const options: Array<{ id: Period; label: string }> = [
    { id: "today", label: "Today" },
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "custom", label: "Custom range" },
  ];
  const selected = options.find((option) => option.id === value.period)?.label ?? "Last 7 days";
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);
  const selectedDays =
    draft.from && draft.to && !invalidRange
      ? Math.floor(
          (Date.parse(`${draft.to}T00:00:00Z`) - Date.parse(`${draft.from}T00:00:00Z`)) /
            86_400_000,
        ) + 1
      : 0;
  const rangeTooLong = selectedDays > 366;
  return (
    <div className="relative">
      <button
        onClick={() => {
          setDraft(value);
          setOpen((current) => !current);
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[10px] font-semibold text-ink hover:bg-surface-soft"
        aria-expanded={open}
      >
        <CalendarDays size={13} className="text-muted" />
        {selected}
        <ChevronDown size={12} className="text-muted" />
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Close date filter"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-40 w-[min(310px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow)]">
            <div className="grid grid-cols-2 gap-1">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    if (option.id === "custom") {
                      setDraft({ ...value, period: "custom" });
                      return;
                    }
                    onChangeAction({ period: option.id });
                    setOpen(false);
                  }}
                  className={`rounded-lg px-3 py-2.5 text-left text-[10px] font-medium ${value.period === option.id ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-surface-soft hover:text-ink"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {draft.period === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line p-2 pt-3">
                <label className="text-[9px] text-muted">
                  From
                  <input
                    type="date"
                    value={draft.from ?? ""}
                    onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                    className="mt-1 block w-full rounded-lg border border-line bg-canvas px-2 py-2 text-[10px] text-ink"
                  />
                </label>
                <label className="text-[9px] text-muted">
                  To
                  <input
                    type="date"
                    value={draft.to ?? ""}
                    onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                    className="mt-1 block w-full rounded-lg border border-line bg-canvas px-2 py-2 text-[10px] text-ink"
                  />
                </label>
                {invalidRange && (
                  <p className="col-span-2 text-[9px] text-danger">
                    Choose a start date on or before the end date.
                  </p>
                )}
                {rangeTooLong && (
                  <p className="col-span-2 text-[9px] text-danger">
                    Choose no more than 366 calendar days.
                  </p>
                )}
                <button
                  disabled={invalidRange || rangeTooLong || !draft.from || !draft.to}
                  onClick={() => {
                    onChangeAction(draft);
                    setOpen(false);
                  }}
                  className="col-span-2 rounded-lg bg-accent px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-45"
                >
                  Apply range
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
