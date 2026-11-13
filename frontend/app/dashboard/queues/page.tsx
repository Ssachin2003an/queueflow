"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CirclePlus, Layers3, Search, SlidersHorizontal } from "lucide-react";
import type { QueueSummary } from "@queueflow/shared";
import { api } from "@/lib/api";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { Input } from "@/components/ui/input";

export default function QueuesPage() {
  const [queues, setQueues] = useState<QueueSummary[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "name-asc" | "name-desc" | "most-tokens">("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ items: QueueSummary[] }>(
        `/queues?limit=100${status !== "all" ? `&status=${status}` : ""}`,
      );
      if (request === requestRef.current) setQueues(result.items);
    } catch (e) {
      if (request === requestRef.current)
        setError(e instanceof Error ? e.message : "Could not load queues.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [status]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current += 1;
    };
  }, [load]);
  const filtered = useMemo(
    () =>
      queues
        .filter((queue) => queue.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) =>
          sort === "name-asc"
            ? a.name.localeCompare(b.name)
            : sort === "name-desc"
              ? b.name.localeCompare(a.name)
              : sort === "most-tokens"
                ? (b.tokenCount ?? 0) - (a.tokenCount ?? 0)
                : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [queues, search, sort],
  );

  return (
    <div>
      <PageHeading
        eyebrow="QueueFlow / Workspace"
        title="Queues, in order."
        description="Create a service line, manage its state and follow each person through the visit."
        action={
          <Button size="sm" asChild>
            <Link href="/dashboard/queues/create">
              <CirclePlus size={14} />
              Create queue
            </Link>
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-[410px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search queues…"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
            <SlidersHorizontal size={13} />
            Status
          </span>
          {["all", "active", "paused", "closed"].map((item) => (
            <button
              key={item}
              onClick={() => setStatus(item)}
              className={`rounded-lg px-2.5 py-2 text-[9px] font-semibold capitalize transition ${status === item ? "bg-ink text-surface" : "bg-surface text-muted hover:bg-surface-soft hover:text-ink"}`}
            >
              {item}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-[10px] text-muted">
            Sort
            <select
              aria-label="Sort queues"
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[9px] font-medium text-ink"
            >
              <option value="newest">Newest</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="most-tokens">Most tokens</option>
            </select>
          </label>
        </div>
      </div>
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
      {loading && !queues.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((queue) => (
            <Link
              key={queue.id ?? queue._id}
              href={`/dashboard/queues/${queue.id ?? queue._id}`}
              className="group surface-card block p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[var(--shadow)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-[13px] border border-line bg-surface-soft text-muted transition group-hover:bg-accent-soft group-hover:text-accent-strong">
                  <Layers3 size={17} />
                </span>
                <StatusBadge status={queue.status} />
              </div>
              <h3 className="mt-5 text-[14px] font-semibold tracking-[-.025em] text-ink">
                {queue.name}
              </h3>
              <p className="mt-1.5 line-clamp-2 min-h-8 text-[10px] leading-5 text-muted">
                {queue.description || "A dedicated line for people waiting to be helped."}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <div className="flex gap-4">
                  <span className="text-[9px] text-muted">
                    <strong className="font-mono-ui text-[12px] font-semibold text-ink">
                      {queue.waitingCount ?? "—"}
                    </strong>
                    <span className="ml-1">waiting</span>
                  </span>
                  <span className="text-[9px] text-muted">
                    <strong className="font-mono-ui text-[12px] font-semibold text-ink">
                      {queue.tokenCount ?? 0}
                    </strong>
                    <span className="ml-1">tokens</span>
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent-strong">
                  Open queue{" "}
                  <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface-card">
          <EmptyState
            title={
              search || status !== "all" ? "No matching queues" : "Your first line starts here"
            }
            description={
              search || status !== "all"
                ? "Try another search or status filter."
                : "Create a queue, choose a clear name and let QueueFlow keep the order visible."
            }
            action={
              !search && status === "all" ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/queues/create">
                    <CirclePlus size={13} />
                    Create your first queue
                  </Link>
                </Button>
              ) : undefined
            }
            icon={<Layers3 size={17} />}
          />
        </div>
      )}
    </div>
  );
}
