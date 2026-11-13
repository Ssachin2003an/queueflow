"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Clock3, Gauge, Timer, Users } from "lucide-react";
import type { QueueSummary } from "@queueflow/shared";
import { api } from "@/lib/api";
import { analyticsQuery, trendsQuery } from "@/lib/analytics";
import { PageHeading } from "@/components/page-heading";
import { TimeFilter, type DateRange } from "@/components/time-filter";
import { MetricCard } from "@/components/metric-card";
import {
  TokenActivityChart,
  WaitTimeChart,
  StatusDonut,
  QueueLengthChart,
  PeakHoursChart,
} from "@/components/analytics-charts";
import { Card, CardContent, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { formatDuration, formatNumber } from "@/lib/utils";

type Overview = {
  queues: number;
  activeQueues: number;
  totalTokens: number;
  waiting: number;
  serving: number;
  completed: number;
  cancelled: number;
  averageWaitMs: number | null;
  longestWaitMs: number | null;
  averageServiceMs: number | null;
  queueUtilization: number | null;
  queueUtilizationLabel: string;
};
type Trend = {
  _id: string;
  total: number;
  completed: number;
  cancelled: number;
  queueLength: number;
};
type Wait = { _id: string; averageMs: number | null; samples: number };
type QueueRow = { _id: string; count: number; avgWait?: number | null; waitSamples: number };
type PeakHour = { hour: number; count: number };

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>({ period: "30d" });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [waits, setWaits] = useState<Wait[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [queues, setQueues] = useState<Array<QueueSummary & { metrics?: QueueRow[] }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const [summary, daily, waitTimes, arrivals, queueResult] = await Promise.all([
        api<Overview>(`/analytics/overview${analyticsQuery(range)}`),
        api<Trend[]>(`/analytics/trends${trendsQuery(range)}`),
        api<Wait[]>(`/analytics/wait-times${analyticsQuery(range)}`),
        api<PeakHour[]>(`/analytics/peak-hours${analyticsQuery(range)}`),
        api<{ items: QueueSummary[] }>("/queues?limit=100"),
      ]);
      const queueMetrics = await Promise.all(
        queueResult.items.map(async (queue) => ({
          ...queue,
          metrics: await api<QueueRow[]>(
            `/analytics/queues/${queue.id ?? queue._id}${analyticsQuery(range)}`,
          ).catch(() => []),
        })),
      );
      if (request !== requestRef.current) return;
      setOverview(summary);
      setTrends(daily);
      setWaits(waitTimes);
      setPeakHours(arrivals);
      setQueues(queueMetrics);
    } catch (e) {
      if (request === requestRef.current)
        setError(e instanceof Error ? e.message : "Could not load analytics.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current += 1;
    };
  }, [load]);
  const onRetry = () => {
    setLoading(true);
    void load();
  };
  const utilization =
    overview?.queueUtilization == null ? null : Number(overview.queueUtilization.toFixed(1));

  return (
    <div>
      <PageHeading
        eyebrow="QueueFlow / Insights"
        title="Measure the rhythm."
        description="Waiting and service times are calculated from real token lifecycle events. Incomplete samples stay unavailable, not zero."
        action={<TimeFilter value={range} onChangeAction={setRange} />}
      />
      {error && (
        <div className="mb-5">
          <ErrorState message={error} retry={onRetry} />
        </div>
      )}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {loading && !overview ? (
          Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-[128px]" />)
        ) : (
          <>
            <MetricCard
              label="Tokens generated"
              value={formatNumber(overview?.totalTokens)}
              hint="Within selected range"
              icon={Activity}
            />
            <MetricCard
              label="Average wait"
              value={
                overview?.averageWaitMs == null
                  ? "—"
                  : formatDuration(overview.averageWaitMs / 60000)
              }
              hint={
                overview?.averageWaitMs == null
                  ? "No service-start sample available"
                  : "Arrival → service start"
              }
              icon={Clock3}
              accent
            />
            <MetricCard
              label="Longest wait"
              value={
                overview?.longestWaitMs == null
                  ? "—"
                  : formatDuration(overview.longestWaitMs / 60000)
              }
              hint={
                overview?.longestWaitMs == null
                  ? "No wait sample available"
                  : "Longest observed in period"
              }
              icon={Timer}
            />
            <MetricCard
              label="Average service"
              value={
                overview?.averageServiceMs == null
                  ? "—"
                  : formatDuration(overview.averageServiceMs / 60000)
              }
              hint={
                overview?.averageServiceMs == null
                  ? "No completed service sample"
                  : "Service start → completion"
              }
              icon={Users}
            />
            <MetricCard
              label="Currently waiting"
              value={formatNumber(overview?.waiting)}
              hint="Live waiting count"
              icon={Activity}
            />
            <MetricCard
              label="Completed service"
              value={formatNumber(overview?.completed)}
              hint="Tokens completed in range"
              icon={Gauge}
            />
            <MetricCard
              label="Cancelled"
              value={formatNumber(overview?.cancelled)}
              hint="Tokens removed from the line"
              icon={Activity}
            />
            <MetricCard
              label="Active queues"
              value={formatNumber(overview?.activeQueues)}
              hint={`${overview?.queues ?? 0} queues in workspace`}
              icon={Gauge}
            />
            <MetricCard
              label="Avg. waiting / active queue"
              value={utilization == null ? "—" : `${utilization} people`}
              hint="A throughput measure; no queue capacity is assumed."
              icon={Gauge}
            />
          </>
        )}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <TokenActivityChart data={trends} />
        <WaitTimeChart data={waits} />
        <QueueLengthChart data={trends} />
        <PeakHoursChart data={peakHours} />
      </section>
      <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <StatusDonut
          waiting={overview?.waiting ?? 0}
          serving={overview?.serving ?? 0}
          completed={overview?.completed ?? 0}
          cancelled={overview?.cancelled ?? 0}
        />
        <Card>
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <p className="eyebrow">Operational comparison</p>
            <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">
              Queue performance
            </h3>
            <p className="mt-1 text-[10px] text-muted">
              Token volume and measured average waiting time per queue.
            </p>
          </div>
          <CardContent className="pt-4">
            {queues.length ? (
              <div className="space-y-3">
                {queues.map((queue) => {
                  const total = queue.metrics?.reduce((sum, item) => sum + item.count, 0) ?? 0;
                  const waitValues =
                    queue.metrics
                      ?.filter((item) => item.avgWait != null && item.waitSamples > 0)
                      .map((item) => ({ value: item.avgWait!, count: item.waitSamples })) ?? [];
                  const samples = waitValues.reduce((sum, item) => sum + item.count, 0);
                  const averageWaitMs = samples
                    ? waitValues.reduce((sum, item) => sum + item.value * item.count, 0) / samples
                    : null;
                  return (
                    <div
                      key={queue.id ?? queue._id}
                      className="rounded-xl border border-line bg-canvas px-3.5 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[11px] font-semibold text-ink">
                          {queue.name}
                        </span>
                        <span className="font-mono-ui text-[10px] text-muted">{total} tokens</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-soft">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{
                            width: `${Math.min(100, overview?.totalTokens ? (total / overview.totalTokens) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[9px] text-muted">
                        <span>{queue.status}</span>
                        <span>
                          Avg wait:{" "}
                          {averageWaitMs == null ? "—" : formatDuration(averageWaitMs / 60000)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No queues yet"
                description="Queue performance comparisons appear after you create queues and record activity."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
