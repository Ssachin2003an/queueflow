"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Layers3,
  Plus,
  Radio,
  Timer,
  Users,
  UserRoundCheck,
} from "lucide-react";
import type { ActivityItem, QueueSummary } from "@queueflow/shared";
import { api } from "@/lib/api";
import { formatDuration, formatRelativeTime, formatNumber } from "@/lib/utils";
import { analyticsQuery, trendsQuery } from "@/lib/analytics";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
} from "@/components/ui/primitives";
import { MetricCard } from "@/components/metric-card";
import { TimeFilter, type DateRange } from "@/components/time-filter";
import { TokenActivityChart, WaitTimeChart, StatusDonut } from "@/components/analytics-charts";
import { useLiveQueue } from "@/hooks/use-live-queue";

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
  recentActivity: Array<ActivityItem & { occurredAt?: string }>;
};
type Trend = { _id: string; total: number; completed: number; cancelled: number };
type Wait = { _id: string; averageMs: number | null; samples: number };
type LoadData = { overview: Overview; trends: Trend[]; waits: Wait[]; queues: QueueSummary[] };

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>({ period: "7d" });
  const [data, setData] = useState<LoadData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const [overview, trends, waits, queues] = await Promise.all([
        api<Overview>(`/analytics/overview${analyticsQuery(range)}`),
        api<Trend[]>(`/analytics/trends${trendsQuery(range)}`),
        api<Wait[]>(`/analytics/wait-times${analyticsQuery(range)}`),
        api<{ items: QueueSummary[] }>("/queues?limit=6"),
      ]);
      if (request === requestRef.current)
        setData({ overview, trends, waits, queues: queues.items });
    } catch (e) {
      if (request === requestRef.current)
        setError(e instanceof Error ? e.message : "Could not load dashboard data.");
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
  const onUpdate = useCallback(() => {
    void load();
  }, [load]);
  const connected = useLiveQueue({
    queueId: data?.queues[0]?.id ?? data?.queues[0]?._id,
    onUpdate,
  });
  const metric = data?.overview;

  return (
    <div>
      <PageHeading
        eyebrow="QueueFlow / Workspace"
        title="The service, at a glance."
        description="A live view of the people, pace and movement across your queues."
        action={
          <>
            <TimeFilter value={range} onChangeAction={setRange} />
            <Button size="sm" asChild>
              <Link href="/dashboard/queues/create">
                <Plus size={14} />
                New queue
              </Link>
            </Button>
          </>
        }
      />
      {error && (
        <div className="mb-5">
          <ErrorState
            message={error}
            retry={() => {
              setLoading(true);
              void load();
            }}
          />
        </div>
      )}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        <span className={`relative flex size-2 ${connected ? "" : "opacity-40"}`}>
          <span
            className={`absolute inline-flex size-full rounded-full ${connected ? "animate-ping bg-accent/35" : "bg-muted/30"}`}
          />
          <span
            className={`relative inline-flex size-2 rounded-full ${connected ? "bg-accent" : "bg-muted/50"}`}
          />
        </span>
        <span className="text-[10px] font-medium text-ink">
          {connected ? "Live updates are on" : "Queue desk"}
        </span>
        <span className="text-[10px] text-muted">
          {connected
            ? "• Changes arrive in real time"
            : "• Data syncs when you open or refresh this view"}
        </span>
        <span className="ml-auto hidden text-[9px] text-muted sm:block">
          {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())}{" "}
          local
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Queue metrics">
        {loading && !metric ? (
          Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[130px]" />)
        ) : (
          <>
            <MetricCard
              label="Active queues"
              value={metric?.activeQueues ?? "—"}
              hint={`${metric?.queues ?? "—"} queues in your workspace`}
              icon={Layers3}
              accent
            />
            <MetricCard
              label="Tokens generated"
              value={formatNumber(metric?.totalTokens)}
              hint="Within the selected period"
              icon={Activity}
            />
            <MetricCard
              label="Waiting now"
              value={formatNumber(metric?.waiting)}
              hint="People in the line"
              icon={Users}
            />
            <MetricCard
              label="In service"
              value={formatNumber(metric?.serving)}
              hint="Being helped right now"
              icon={Radio}
            />
            <MetricCard
              label="Completed"
              value={formatNumber(metric?.completed)}
              hint="Service completed"
              icon={CheckCircle2}
            />
            <MetricCard
              label="Cancelled"
              value={formatNumber(metric?.cancelled)}
              hint="Removed from the line"
              icon={UserRoundCheck}
            />
            <MetricCard
              label="Average wait"
              value={
                metric?.averageWaitMs == null ? "—" : formatDuration(metric.averageWaitMs / 60000)
              }
              hint={
                metric?.averageWaitMs == null
                  ? "No completed wait sample in this period"
                  : "Arrival to service start"
              }
              icon={Clock3}
            />
            <MetricCard
              label="Longest wait"
              value={
                metric?.longestWaitMs == null ? "—" : formatDuration(metric.longestWaitMs / 60000)
              }
              hint={
                metric?.longestWaitMs == null
                  ? "No wait sample in this period"
                  : "Longest observed in period"
              }
              icon={Clock3}
            />
            <MetricCard
              label="Average service"
              value={
                metric?.averageServiceMs == null
                  ? "—"
                  : formatDuration(metric.averageServiceMs / 60000)
              }
              hint={
                metric?.averageServiceMs == null
                  ? "No completed service sample in this period"
                  : "Service start to completion"
              }
              icon={Timer}
            />
          </>
        )}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <TokenActivityChart data={data?.trends ?? []} />
        <StatusDonut
          waiting={metric?.waiting ?? 0}
          serving={metric?.serving ?? 0}
          completed={metric?.completed ?? 0}
          cancelled={metric?.cancelled ?? 0}
        />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <WaitTimeChart data={data?.waits ?? []} />
        <Card>
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <div>
              <p className="eyebrow">A closer look</p>
              <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">
                Your queues
              </h3>
            </div>
            <Link
              href="/dashboard/queues"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-strong hover:gap-2"
            >
              All queues <ArrowRight size={12} />
            </Link>
          </div>
          <CardContent className="pt-4">
            {loading && !data ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : data?.queues.length ? (
              <div className="space-y-2">
                {data.queues.slice(0, 4).map((queue) => (
                  <Link
                    href={`/dashboard/queues/${queue.id ?? queue._id}`}
                    key={queue.id ?? queue._id}
                    className="flex items-center gap-3 rounded-xl border border-transparent bg-canvas px-3 py-3 transition hover:border-line hover:bg-surface"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted">
                      <Layers3 size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-ink">
                        {queue.name}
                      </span>
                      <span className="mt-1 block text-[9px] text-muted">
                        {queue.waitingCount ?? "—"} waiting · {queue.tokenCount ?? 0} tokens
                      </span>
                    </span>
                    <StatusBadge status={queue.status} />
                    <ChevronRightIcon />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No queues yet"
                description="Create your first service queue and add a person to start tracking real flow."
                action={
                  <Button size="sm" asChild>
                    <Link href="/dashboard/queues/create">
                      <Plus size={13} />
                      Create a queue
                    </Link>
                  </Button>
                }
                icon={<Layers3 size={17} />}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <div>
              <p className="eyebrow">The latest movement</p>
              <h3 className="mt-1.5 text-sm font-semibold tracking-[-.025em] text-ink">
                Recent activity
              </h3>
            </div>
            <span className="flex size-8 items-center justify-center rounded-xl bg-surface-soft text-muted">
              <Activity size={15} />
            </span>
          </div>
          <CardContent className="pt-4">
            {data?.overview.recentActivity?.length ? (
              <div className="divide-y divide-line">
                {data.overview.recentActivity.slice(0, 6).map((item, index) => (
                  <div
                    key={item.id ?? item.timestamp ?? item.occurredAt ?? index}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                      <Activity size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-ink">
                        {item.description}
                      </p>
                      <p className="mt-1 truncate text-[9px] text-muted">
                        {item.queueName ?? "Queue activity"}
                        {item.tokenNumber ? ` · ${item.tokenNumber}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[9px] text-muted">
                      {(item.occurredAt ?? item.timestamp)
                        ? formatRelativeTime(item.occurredAt ?? item.timestamp!)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No activity to show"
                description="Queue and token updates will appear here as they happen."
                icon={<Activity size={16} />}
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ChevronRightIcon() {
  return <ArrowRight size={13} className="text-muted" />;
}
