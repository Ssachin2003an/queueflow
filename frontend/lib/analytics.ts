import type { DateRange } from "@/components/time-filter";
import { periodRange } from "@/components/time-filter";

export function analyticsQuery(range: DateRange) {
  const { from, to } = periodRange(range.period, range.from, range.to);
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  return params.toString() ? `?${params.toString()}` : "";
}

export function trendsQuery(range: DateRange) {
  const days = trendDays(range);
  const dates = analyticsQuery(range);
  return `?days=${days}${dates ? `&${dates.slice(1)}` : ""}`;
}

export function trendDays(range: DateRange) {
  if (range.period === "today") return 1;
  if (range.period === "30d") return 30;
  if (range.period === "custom" && range.from && range.to) {
    const days =
      Math.ceil(
        (new Date(`${range.to}T00:00:00`).getTime() -
          new Date(`${range.from}T00:00:00`).getTime()) /
          86400000,
      ) + 1;
    return Math.min(90, Math.max(1, days));
  }
  return 7;
}
