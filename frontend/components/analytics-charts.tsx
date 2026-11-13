"use client";

import { Activity, BarChart3, Clock3, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeSeriesPoint } from "@queueflow/shared";
import { Card, CardContent, CardHeader, EmptyState } from "@/components/ui/primitives";
import { formatDuration } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 11,
  boxShadow: "0 8px 22px rgba(0,0,0,.08)",
};
const axisTick = { fill: "var(--muted)", fontSize: 9 };

type TrendRow = {
  _id?: string;
  date?: string;
  label?: string;
  total?: number;
  completed?: number;
  cancelled?: number;
  averageMs?: number | null;
  samples?: number;
  averageWaitMinutes?: number | null;
  waiting?: number;
  served?: number;
  queueLength?: number;
};

function niceDate(value: string) {
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = calendarDate
    ? new Date(
        Date.UTC(Number(calendarDate[1]), Number(calendarDate[2]) - 1, Number(calendarDate[3]), 12),
      )
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
        date,
      );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-line bg-canvas/55 px-6 text-center text-[11px] leading-5 text-muted">
      {message}
    </div>
  );
}

export function TokenActivityChart({ data }: { data: TrendRow[] }) {
  const rows = data.map((item) => ({
    ...item,
    dateLabel: niceDate(item._id ?? item.date ?? ""),
    total: item.total ?? item.waiting ?? 0,
    completed: item.completed ?? item.served ?? 0,
  }));
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <p className="eyebrow">Token movement</p>
          <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">
            Arrivals & completion
          </h3>
        </div>
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <Activity size={15} />
        </span>
      </CardHeader>
      <CardContent className="pt-5">
        {rows.length ? (
          <div className="h-[235px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 5, right: 2, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="arrivalsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.015} />
                  </linearGradient>
                  <linearGradient id="completeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8fa9a0" stopOpacity={0.17} />
                    <stop offset="95%" stopColor="#8fa9a0" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="dateLabel"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    value,
                    name === "completed" ? "Completed" : "Tokens created",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="created"
                  stroke="var(--accent)"
                  strokeWidth={2.2}
                  fill="url(#arrivalsFill)"
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="completed"
                  stroke="#8fa9a0"
                  strokeWidth={1.7}
                  fill="url(#completeFill)"
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmpty message="Token activity will appear here as people move through your queues." />
        )}
        <div className="mt-3 flex items-center gap-4 text-[9px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-accent" />
            Created
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-[#8fa9a0]" />
            Completed
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function WaitTimeChart({ data }: { data: TrendRow[] }) {
  const rows = data
    .map((item) => ({
      ...item,
      dateLabel: niceDate(item._id ?? item.date ?? ""),
      average: item.averageWaitMinutes ?? (item.averageMs == null ? null : item.averageMs / 60000),
    }))
    .filter((item) => item.average !== null);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <p className="eyebrow">Experience signal</p>
          <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">
            Average wait time
          </h3>
        </div>
        <span className="flex size-8 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <Clock3 size={15} />
        </span>
      </CardHeader>
      <CardContent className="pt-5">
        {rows.length ? (
          <div className="h-[235px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 6, left: -19, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="dateLabel"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${Math.round(value)}m`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatDuration(Number(value)), "Average wait"]}
                />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="#c58b3a"
                  strokeWidth={2.2}
                  dot={{ r: 2.8, fill: "#c58b3a", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmpty message="Wait-time trends will become available after tokens have a recorded service start." />
        )}
        <p className="mt-3 text-[9px] text-muted">Measured from token creation to service start.</p>
      </CardContent>
    </Card>
  );
}

export function StatusDonut({
  waiting,
  serving,
  completed,
  cancelled,
}: {
  waiting: number;
  serving: number;
  completed: number;
  cancelled: number;
}) {
  const data = [
    { name: "Waiting", value: waiting, color: "#c58b3a" },
    { name: "Serving", value: serving, color: "#11a889" },
    { name: "Completed", value: completed, color: "#82958d" },
    { name: "Cancelled", value: cancelled, color: "#d55a58" },
  ].filter((item) => item.value > 0);
  const total = waiting + serving + completed + cancelled;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <p className="eyebrow">Queue status</p>
          <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">
            Token distribution
          </h3>
        </div>
        <span className="flex size-8 items-center justify-center rounded-xl bg-surface-soft text-muted">
          <BarChart3 size={15} />
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        {total ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-[180px] w-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={77}
                    paddingAngle={3}
                    stroke="none"
                  >
                    <Cell fill="#c58b3a" />
                    <Cell fill="#11a889" />
                    <Cell fill="#82958d" />
                    <Cell fill="#d55a58" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono-ui text-[24px] font-semibold tracking-tight text-ink">
                  {total}
                </span>
                <span className="text-[9px] text-muted">total tokens</span>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-x-3 gap-y-3">
              {[
                { name: "Waiting", value: waiting, color: "#c58b3a" },
                { name: "Serving", value: serving, color: "#11a889" },
                { name: "Completed", value: completed, color: "#82958d" },
                { name: "Cancelled", value: cancelled, color: "#d55a58" },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 text-[10px] text-muted">{item.name}</span>
                  <span className="font-mono-ui text-[11px] font-semibold text-ink">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[190px] flex-col items-center justify-center text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface-soft text-muted">
              <TrendingUp size={16} />
            </span>
            <p className="mt-3 text-[11px] font-semibold text-ink">No token activity yet</p>
            <p className="mt-1 text-[9px] text-muted">
              Distribution will update from real queue activity.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function QueueLengthChart({ data }: { data: TrendRow[] }) {
  const rows = data.map((item) => ({
    ...item,
    dateLabel: niceDate(item._id ?? item.date ?? ""),
    length: item.queueLength ?? 0,
  }));
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <p className="eyebrow">Live queue pressure</p>
          <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">
            Waiting-line length
          </h3>
        </div>
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <TrendingUp size={15} />
        </span>
      </CardHeader>
      <CardContent className="pt-5">
        {rows.length ? (
          <div className="h-[235px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="queueLengthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="dateLabel"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [value, "Waiting at day end"]}
                />
                <Area
                  type="monotone"
                  dataKey="length"
                  stroke="var(--accent)"
                  strokeWidth={2.2}
                  fill="url(#queueLengthFill)"
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmpty message="Queue-length trends will appear as real token activity is recorded." />
        )}
        <p className="mt-3 text-[9px] text-muted">
          Daily ending queue length reconstructed from arrivals, service starts and cancellations.
        </p>
      </CardContent>
    </Card>
  );
}

export function PeakHoursChart({ data }: { data: Array<{ hour: number; count: number }> }) {
  const rows = data.map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat("en", { hour: "numeric", hour12: true, timeZone: "UTC" }).format(
      new Date(Date.UTC(2020, 0, 1, item.hour)),
    ),
  }));
  const hasSamples = rows.some((item) => item.count > 0);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <p className="eyebrow">Arrival patterns</p>
          <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">Peak hours</h3>
        </div>
        <span className="flex size-8 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <Clock3 size={15} />
        </span>
      </CardHeader>
      <CardContent className="pt-5">
        {hasSamples ? (
          <div className="h-[235px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [value, "Tokens added"]}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ChartEmpty message="Arrival patterns will appear after your first tokens are added." />
        )}
        <p className="mt-3 text-[9px] text-muted">
          Hour of day in your selected time zone, based on actual token creation events.
        </p>
      </CardContent>
    </Card>
  );
}
