"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AudioLines,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  Layers3,
  Link2,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  personSchema,
  queueSchema,
  type PersonInput,
  type QueueInput,
  type QueueSummary,
  type QueueToken,
} from "@queueflow/shared";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLiveQueue } from "@/hooks/use-live-queue";

function tokenLabel(value: string | number | undefined) {
  if (value == null) return "—";
  const raw = String(value);
  return raw.startsWith("Q") ? raw : `Q${raw.padStart(3, "0")}`;
}
type QueueRecord = QueueSummary & {
  _id?: string;
  tokenCounter?: number;
  servingTokenId?: string | null;
  publicId: string;
};
type TokenResult = { items: QueueToken[]; total: number; page: number; limit: number };
const WAITING_PAGE_SIZE = 100;
const HISTORY_PAGE_SIZE = 20;
function FieldError({ children }: { children?: string }) {
  return children ? <p className="mt-1.5 text-[10px] text-danger">{children}</p> : null;
}

function AddPersonDialog({
  queueId,
  onCreated,
}: {
  queueId: string;
  onCreated: (token: QueueToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<PersonInput>({
    resolver: zodResolver(personSchema),
    defaultValues: { personName: "", phone: "" },
  });
  const submit = async (input: PersonInput) => {
    try {
      const result = await api<QueueToken>(`/queues/${queueId}/tokens`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      onCreated(result);
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error("Could not add person", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} />
          Add person
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[min(440px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-[17px] font-semibold tracking-[-.04em] text-ink">
                Add someone to the line
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-[11px] text-muted">
                QueueFlow creates their next token and position automatically.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1.5 text-muted hover:bg-surface-soft"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={form.handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
            <div>
              <Label htmlFor="person-name">
                Person’s name <span className="text-danger">*</span>
              </Label>
              <Input
                id="person-name"
                autoFocus
                placeholder="e.g. Jamie Chen"
                invalid={Boolean(form.formState.errors.personName)}
                {...form.register("personName")}
              />
              <FieldError>{form.formState.errors.personName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="person-phone">
                Phone <span className="font-normal text-muted">(optional)</span>
              </Label>
              <Input
                id="person-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 010 1234"
                invalid={Boolean(form.formState.errors.phone)}
                {...form.register("phone")}
              />
              <FieldError>{form.formState.errors.phone?.message}</FieldError>
            </div>
            <div className="rounded-xl border border-line bg-canvas px-3.5 py-3 text-[10px] leading-5 text-muted">
              Contact details are private to managers. The public display only shows token numbers.
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Add to queue
                </>
              )}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditQueueDialog({
  queue,
  onSaved,
}: {
  queue: QueueRecord;
  onSaved: (queue: QueueRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<QueueInput>({
    resolver: zodResolver(queueSchema),
    defaultValues: { name: queue.name, description: queue.description ?? "" },
  });
  useEffect(() => {
    form.reset({ name: queue.name, description: queue.description ?? "" });
  }, [queue.name, queue.description, form, open]);
  const submit = async (input: QueueInput) => {
    try {
      const saved = await api<QueueRecord>(`/queues/${queue.id ?? queue._id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      onSaved(saved);
      setOpen(false);
      toast.success("Queue details saved");
    } catch (error) {
      toast.error("Could not update queue", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Settings2 size={13} />
          Edit
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[min(440px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-[17px] font-semibold tracking-[-.04em] text-ink">
                Edit queue details
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[11px] text-muted">
                Changes apply to the manager and public display labels.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-lg p-1.5 text-muted hover:bg-surface-soft"
              >
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-4" noValidate>
            <div>
              <Label htmlFor="edit-queue-name">
                Queue name <span className="text-danger">*</span>
              </Label>
              <Input
                id="edit-queue-name"
                {...form.register("name")}
                invalid={Boolean(form.formState.errors.name)}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="edit-queue-description">Description</Label>
              <textarea
                id="edit-queue-description"
                rows={3}
                maxLength={240}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
                {...form.register("description")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function QueueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queueId = params.id;
  const [queue, setQueue] = useState<QueueRecord | null>(null);
  const [waiting, setWaiting] = useState<QueueToken[]>([]);
  const [nextToken, setNextToken] = useState<QueueToken | null>(null);
  const [queueWaitingCount, setQueueWaitingCount] = useState(0);
  const [waitingTotal, setWaitingTotal] = useState(0);
  const [waitingPage, setWaitingPage] = useState(1);
  const [serving, setServing] = useState<QueueToken | null>(null);
  const [history, setHistory] = useState<QueueToken[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyStatus, setHistoryStatus] = useState<"all" | "completed" | "cancelled">("all");
  const [historySearchDraft, setHistorySearchDraft] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [waitingSearchDraft, setWaitingSearchDraft] = useState("");
  const [waitingSearch, setWaitingSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(0);
  const [confirm, setConfirm] = useState<{
    kind: "cancel" | "close" | "delete";
    token?: QueueToken;
  } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHistorySearch(historySearchDraft.trim());
      setHistoryPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [historySearchDraft]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setWaitingSearch(waitingSearchDraft.trim());
      setWaitingPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [waitingSearchDraft]);
  const load = useCallback(async () => {
    if (!queueId) return;
    const request = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const historyParams = new URLSearchParams({
        status: historyStatus,
        limit: String(HISTORY_PAGE_SIZE),
        page: String(historyPage),
      });
      if (historySearch) historyParams.set("search", historySearch);
      const waitingParams = new URLSearchParams({
        status: "waiting",
        limit: String(WAITING_PAGE_SIZE),
        page: String(waitingPage),
      });
      if (waitingSearch) waitingParams.set("search", waitingSearch);
      const [q, waitResult, firstResult, serviceResult, calledResult, historyResult] =
        await Promise.all([
          api<QueueRecord>(`/queues/${queueId}`),
          api<TokenResult>(`/queues/${queueId}/tokens?${waitingParams.toString()}`),
          api<TokenResult>(`/queues/${queueId}/tokens?status=waiting&limit=1&page=1`),
          api<TokenResult>(`/queues/${queueId}/tokens?status=serving&limit=5`),
          api<TokenResult>(`/queues/${queueId}/tokens?status=called&limit=5`),
          api<TokenResult>(`/queues/${queueId}/tokens?${historyParams.toString()}`),
        ]);
      if (request !== requestRef.current) return;
      const waitingLastPage = Math.max(1, Math.ceil(waitResult.total / WAITING_PAGE_SIZE));
      const historyLastPage = Math.max(1, Math.ceil(historyResult.total / HISTORY_PAGE_SIZE));
      if (waitingPage > waitingLastPage || historyPage > historyLastPage) {
        setWaitingPage(Math.min(waitingPage, waitingLastPage));
        setHistoryPage(Math.min(historyPage, historyLastPage));
        return;
      }
      setQueue(q);
      setWaiting(waitResult.items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
      setWaitingTotal(waitResult.total);
      setQueueWaitingCount(firstResult.total);
      setNextToken(firstResult.items[0] ?? null);
      setServing(serviceResult.items[0] ?? calledResult.items[0] ?? null);
      setHistory(historyResult.items);
      setHistoryTotal(historyResult.total);
    } catch (e) {
      if (request === requestRef.current)
        setError(e instanceof Error ? e.message : "Could not load this queue.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [queueId, historyStatus, historySearch, historyPage, waitingSearch, waitingPage]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current += 1;
    };
  }, [load]);
  const liveUpdate = useCallback(() => {
    void load();
  }, [load]);
  const connected = useLiveQueue({ queueId, onUpdate: liveUpdate });
  const visibleWaiting = waiting;
  const onPersonCreated = (token: QueueToken) => {
    toast.success(`${tokenLabel(token.tokenNumber)} added`, {
      description: `${token.personName} is now in the queue.`,
    });
    setWaitingSearchDraft("");
    setWaitingPage(Math.max(1, Math.ceil((queueWaitingCount + 1) / WAITING_PAGE_SIZE)));
  };
  const callNext = async () => {
    if (!queue) return;
    setBusy(true);
    try {
      const result = await api<{ token: QueueToken | null }>(`/queues/${queueId}/call-next`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!result.token)
        toast.message("No one is waiting", { description: "This queue is clear for now." });
      else
        toast.success(`${tokenLabel(result.token.tokenNumber)} called`, {
          description: `${result.token.personName} is ready for service.`,
        });
      await load();
    } catch (e) {
      toast.error("Could not call the next person", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const completeService = async () => {
    if (!serving) return;
    setBusy(true);
    try {
      await api(`/tokens/${serving.id ?? serving._id}/complete`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      toast.success("Service completed", {
        description: `${tokenLabel(serving.tokenNumber)} is now in history.`,
      });
      await load();
    } catch (e) {
      toast.error("Could not complete service", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const move = async (token: QueueToken, direction: -1 | 1) => {
    const id = token.id ?? token._id;
    const position = token.position;
    const currentIndex = waiting.findIndex((item) => (item.id ?? item._id) === id);
    const target = (position ?? -1) + direction;
    const totalWaiting = queue?.waitingCount ?? waitingTotal;
    if (!id || position == null || currentIndex < 0 || target < 0 || target >= totalWaiting) return;
    const previous = waiting;
    const reordered = [...waiting];
    const adjacentIndex = reordered.findIndex((item) => item.position === target);
    if (adjacentIndex >= 0) {
      [reordered[currentIndex], reordered[adjacentIndex]] = [
        { ...reordered[adjacentIndex], position },
        { ...reordered[currentIndex], position: target },
      ];
      setWaiting(reordered);
    }
    try {
      await api(`/tokens/${id}/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ position: target }),
      });
      await load();
    } catch (e) {
      setWaiting(previous);
      toast.error("Order could not be changed", {
        description:
          e instanceof Error
            ? e.message
            : "The queue may have changed elsewhere. Refreshing the order.",
      });
      void load();
    }
  };
  const updateStatus = async (status: "active" | "paused" | "closed") => {
    setBusy(true);
    try {
      const updated = await api<QueueRecord>(`/queues/${queueId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setQueue(updated);
      toast.success(status === "active" ? "Queue activated" : `Queue ${status}`);
      await load();
    } catch (e) {
      toast.error("Could not update queue", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const performConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "cancel" && confirm.token) {
        await api(`/tokens/${confirm.token.id ?? confirm.token._id}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({}),
        });
        toast.success("Token cancelled");
        await load();
      }
      if (confirm.kind === "close") await updateStatus("closed");
      if (confirm.kind === "delete") {
        await api(`/queues/${queueId}`, { method: "DELETE" });
        toast.success("Queue deleted");
        router.replace("/dashboard/queues");
      }
    } catch (e) {
      toast.error("Action could not be completed", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const copyDisplayLink = async () => {
    if (!queue?.publicId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/display/${queue.publicId}`);
      toast.success("Display link copied");
    } catch {
      toast.error("Could not copy the display link");
    }
  };

  if (loading && !queue)
    return (
      <div className="space-y-5">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  if (error && !queue)
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/queues">
            <ArrowLeft size={14} />
            All queues
          </Link>
        </Button>
        <ErrorState
          message={error}
          retry={() => {
            setLoading(true);
            void load();
          }}
        />
      </div>
    );
  if (!queue) return null;
  const tokenCount = queue.tokenCount ?? queue.tokenCounter ?? 0;
  const canCall = queue.status === "active" && !serving;
  const totalWaiting = queueWaitingCount;
  const waitingPages = Math.max(1, Math.ceil(waitingTotal / WAITING_PAGE_SIZE));
  const historyPages = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE));
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/queues">
            <ArrowLeft size={14} />
            All queues
          </Link>
        </Button>
        <span className="inline-flex items-center gap-1.5 text-[9px] text-muted">
          <span className={`size-1.5 rounded-full ${connected ? "bg-accent" : "bg-muted/50"}`} />
          {connected ? "Live sync connected" : "Sync reconnects automatically"}
        </span>
      </div>
      <PageHeading
        eyebrow="QueueFlow / Queue desk"
        title={queue.name}
        description={queue.description || "A clear, live view of the people in this service line."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EditQueueDialog queue={queue} onSaved={setQueue} />
            <Button variant="secondary" size="sm" onClick={copyDisplayLink}>
              <Link2 size={13} />
              Display link
            </Button>
            {queue.status === "active" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void updateStatus("paused")}
                disabled={busy}
              >
                <Pause size={13} />
                Pause
              </Button>
            ) : (
              <Button size="sm" onClick={() => void updateStatus("active")} disabled={busy}>
                <Play size={13} />
                {queue.status === "closed" ? "Activate" : "Resume"}
              </Button>
            )}
          </div>
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorState
            message={error}
            retry={() => {
              setLoading(true);
              void load();
            }}
          />
        </div>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface-card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <Users size={15} />
          </span>
          <span>
            <span className="block font-mono-ui text-[18px] font-semibold leading-none text-ink">
              {totalWaiting}
            </span>
            <span className="mt-1 block text-[9px] text-muted">waiting</span>
          </span>
        </div>
        <div className="surface-card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <AudioLines size={15} />
          </span>
          <span>
            <span className="block font-mono-ui text-[18px] font-semibold leading-none text-ink">
              {serving ? 1 : 0}
            </span>
            <span className="mt-1 block text-[9px] text-muted">in service</span>
          </span>
        </div>
        <div className="surface-card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-surface-soft text-muted">
            <CheckCircle2 size={15} />
          </span>
          <span>
            <span className="block font-mono-ui text-[18px] font-semibold leading-none text-ink">
              {historyTotal}
            </span>
            <span className="mt-1 block text-[9px] text-muted">history shown</span>
          </span>
        </div>
        <div className="surface-card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-surface-soft text-muted">
            <Clock3 size={15} />
          </span>
          <span>
            <span className="block font-mono-ui text-[18px] font-semibold leading-none text-ink">
              {tokenCount}
            </span>
            <span className="mt-1 block text-[9px] text-muted">tokens created</span>
          </span>
        </div>
      </div>
      <section className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <Card className="relative overflow-hidden border-accent/15 bg-[linear-gradient(135deg,var(--surface),var(--accent-soft))] p-5 sm:p-6">
          <div className="absolute -right-8 -top-8 size-32 rounded-full border border-accent/10" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="eyebrow text-accent-strong">Currently serving</p>
              <p className="mt-1 text-[10px] text-muted">One person at a time, clearly called.</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-xl border border-accent/15 bg-surface/80 text-accent-strong">
              <AudioLines size={16} />
            </span>
          </div>
          {serving ? (
            <div className="relative mt-6">
              <p className="font-mono-ui text-[55px] font-medium leading-none tracking-[-.09em] text-ink sm:text-[64px]">
                {tokenLabel(serving.tokenNumber)}
              </p>
              <p className="mt-2 text-[13px] font-semibold text-ink">{serving.personName}</p>
              <p className="mt-1 text-[10px] text-muted">
                Service started{" "}
                {formatRelativeTime(
                  serving.serviceStartedAt ?? serving.calledAt ?? serving.createdAt,
                )}
              </p>
              <Button
                size="sm"
                className="mt-5"
                onClick={() => void completeService()}
                disabled={busy}
              >
                <Check size={13} />
                Complete service
              </Button>
            </div>
          ) : (
            <div className="relative mt-6 flex min-h-[113px] flex-col justify-center">
              <p className="text-[13px] font-semibold text-ink">Ready for the next person</p>
              <p className="mt-1 text-[10px] text-muted">
                {nextToken
                  ? `${tokenLabel(nextToken.tokenNumber)} is at the top of the line.`
                  : "No one is waiting right now."}
              </p>
            </div>
          )}
        </Card>
        <Card className="flex flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Next in line</p>
              <h3 className="mt-1.5 text-[17px] font-semibold tracking-[-.04em] text-ink">
                Keep the flow moving.
              </h3>
              <p className="mt-1 text-[10px] text-muted">
                The first waiting token is assigned to service.
              </p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
              <Play size={15} />
            </span>
          </div>
          <div className="mt-5 rounded-xl border border-line bg-canvas p-3.5">
            {nextToken ? (
              <div className="flex items-center gap-3">
                <span className="font-mono-ui text-[19px] font-semibold tracking-tight text-accent-strong">
                  {tokenLabel(nextToken.tokenNumber)}
                </span>
                <span className="h-7 w-px bg-line" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-ink">
                    {nextToken.personName}
                  </span>
                  <span className="mt-1 block text-[9px] text-muted">
                    Position 1 · {formatRelativeTime(nextToken.createdAt)}
                  </span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <CircleHelp size={14} />
                Your waiting list is clear.
              </div>
            )}
          </div>
          <Button
            size="lg"
            className="mt-4 w-full justify-between px-4"
            onClick={() => void callNext()}
            disabled={!canCall || busy || !nextToken}
          >
            {busy ? (
              <>
                <LoaderCircle size={15} className="animate-spin" />
                Working…
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-2">
                  <AudioLines size={15} />
                  Call next token
                </span>
                <span className="rounded-md bg-white/15 px-2 py-1 font-mono-ui text-[10px]">
                  {canCall
                    ? tokenLabel(nextToken?.tokenNumber)
                    : queue.status !== "active"
                      ? queue.status
                      : "Serving"}
                </span>
              </>
            )}
          </Button>
          {queue.status !== "active" && (
            <p className="mt-2 text-center text-[9px] text-warning">
              Activate this queue to call or add tokens.
            </p>
          )}
        </Card>
      </section>
      <section className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-[-.025em] text-ink">Waiting list</h3>
                <span className="rounded-full border border-line bg-surface-soft px-2 py-0.5 font-mono-ui text-[9px] text-muted">
                  {waitingSearch ? waitingTotal : totalWaiting}
                </span>
              </div>
              <p className="mt-1 text-[9px] text-muted">
                Move someone up or down to change their priority.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:w-[180px] sm:flex-none">
                <Search
                  size={12}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  aria-label="Search waiting tokens"
                  value={waitingSearchDraft}
                  onChange={(event) => setWaitingSearchDraft(event.target.value)}
                  placeholder="Find name or token…"
                  className="h-8 rounded-lg pl-8 text-[10px]"
                />
              </div>
              <AddPersonDialog queueId={queueId} onCreated={onPersonCreated} />
            </div>
          </div>
          {visibleWaiting.length ? (
            <div className="divide-y divide-line">
              {visibleWaiting.map((token) => (
                <motion.div
                  layout
                  key={token.id ?? token._id}
                  className={`group grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition sm:grid-cols-[40px_minmax(0,1fr)_auto_auto] sm:px-5 ${token.position === 0 ? "bg-accent-soft/30" : "hover:bg-canvas/70"}`}
                >
                  <span
                    className={`font-mono-ui text-[12px] font-semibold ${token.position === 0 ? "text-accent-strong" : "text-muted"}`}
                  >
                    {String((token.position ?? 0) + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-ui text-[11px] font-semibold text-ink">
                        {tokenLabel(token.tokenNumber)}
                      </span>
                      {token.position === 0 && (
                        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-accent-strong">
                          Next
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[10px] text-muted">{token.personName}</p>
                  </div>
                  <span className="hidden text-[9px] text-muted sm:block">
                    {formatRelativeTime(token.createdAt)}
                  </span>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${token.personName} up`}
                      title="Move up"
                      disabled={(token.position ?? 0) === 0 || busy}
                      onClick={() => void move(token, -1)}
                    >
                      <ArrowUp size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${token.personName} down`}
                      title="Move down"
                      disabled={(token.position ?? 0) >= totalWaiting - 1 || busy}
                      onClick={() => void move(token, 1)}
                    >
                      <ArrowDown size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label={`Cancel ${tokenLabel(token.tokenNumber)}`}
                      title="Cancel token"
                      onClick={() => setConfirm({ kind: "cancel", token })}
                    >
                      <X size={13} />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={waitingSearch ? "No people match that search" : "No one is waiting"}
              description={
                waitingSearch
                  ? "Try a token number or another name."
                  : queue.status === "active"
                    ? "Add someone to create the first token in this line."
                    : "Activate the queue when you are ready to welcome new people."
              }
              action={
                !waitingSearch && queue.status === "active" ? (
                  <AddPersonDialog queueId={queueId} onCreated={onPersonCreated} />
                ) : undefined
              }
              icon={<Users size={16} />}
            />
          )}
          <div className="flex flex-col gap-3 border-t border-line bg-canvas/60 px-4 py-3 text-[9px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>
              Showing {waitingTotal ? (waitingPage - 1) * WAITING_PAGE_SIZE + 1 : 0}–
              {Math.min(waitingPage * WAITING_PAGE_SIZE, waitingTotal)} of {waitingTotal}
              {waitingSearch ? " matching tokens" : " waiting tokens"}
            </span>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="inline-flex items-center gap-1">
                <span
                  className={`size-1.5 rounded-full ${connected ? "bg-accent" : "bg-muted/50"}`}
                />
                {connected ? "Live" : "Reconnecting"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={waitingPage <= 1 || loading}
                  onClick={() => setWaitingPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <span aria-live="polite" className="min-w-12 text-center">
                  {waitingPage}/{waitingPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={waitingPage >= waitingPages || loading}
                  onClick={() => setWaitingPage((page) => page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Public display</p>
                <h3 className="mt-1 text-sm font-semibold text-ink">A screen for your visitors.</h3>
              </div>
              <ExternalLink size={15} className="text-muted" />
            </div>
            <p className="mt-2 text-[10px] leading-5 text-muted">
              Share a read-only screen that shows the current token and how many people are waiting.
            </p>
            <Link
              href={`/display/${queue.publicId}`}
              target="_blank"
              className="mt-4 flex items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2.5 text-[10px] font-semibold text-accent-strong hover:bg-surface-soft"
            >
              <span className="truncate">/display/{queue.publicId}</span>
              <ExternalLink size={12} />
            </Link>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => void copyDisplayLink()}
            >
              <Copy size={12} />
              Copy public display link
            </Button>
          </Card>
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Token history</p>
                <h3 className="mt-1 text-sm font-semibold text-ink">Recent queue activity</h3>
              </div>
              <CheckCircle2 size={15} className="shrink-0 text-muted" />
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Input
                aria-label="Search token history"
                value={historySearchDraft}
                onChange={(event) => setHistorySearchDraft(event.target.value)}
                placeholder="Name or token number"
                className="h-8 min-w-0 rounded-lg text-[9px]"
              />
              <select
                aria-label="Filter token history"
                value={historyStatus}
                onChange={(event) => {
                  setHistoryStatus(event.target.value as typeof historyStatus);
                  setHistoryPage(1);
                }}
                className="h-8 rounded-lg border border-line bg-surface px-2 text-[9px] text-ink"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {history.length ? (
              <div className="mt-3 max-h-[310px] divide-y divide-line overflow-y-auto">
                {history.map((token) => (
                  <div
                    key={token.id ?? token._id}
                    className="flex items-center justify-between gap-2 py-2.5 first:pt-0"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono-ui text-[9px] font-semibold text-muted">
                        {tokenLabel(token.tokenNumber)}
                      </span>
                      <span className="min-w-0 truncate text-[9px] text-ink">
                        {token.personName}
                        {token.phone ? (
                          <span className="ml-1 text-muted">· {token.phone}</span>
                        ) : null}
                      </span>
                    </div>
                    <span className="shrink-0 text-[8px] text-muted">
                      {token.status} ·{" "}
                      {formatRelativeTime(
                        token.completedAt ?? token.cancelledAt ?? token.createdAt,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-canvas px-3 py-4 text-center text-[10px] text-muted">
                {historySearch
                  ? "No tokens match your search."
                  : "No tokens match this status yet."}
              </p>
            )}
            {historyTotal > 0 && (
              <div className="mt-3 flex items-center justify-between gap-2 text-[8px] text-muted">
                <span>
                  Showing {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–
                  {Math.min(historyPage * HISTORY_PAGE_SIZE, historyTotal)} of {historyTotal}
                </span>
                {historyPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={historyPage <= 1 || loading}
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    >
                      Previous
                    </Button>
                    <span aria-live="polite" className="min-w-8 text-center">
                      {historyPage}/{historyPages}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={historyPage >= historyPages || loading}
                      onClick={() => setHistoryPage((page) => page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Queue settings</p>
              <MoreHorizontal size={15} className="text-muted" />
            </div>
            <div className="mt-3 space-y-2">
              <button
                onClick={() =>
                  queue.status === "active"
                    ? void updateStatus("paused")
                    : void updateStatus("active")
                }
                disabled={busy}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2.5 text-left text-[10px] font-medium text-ink disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  {queue.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                  {queue.status === "active"
                    ? "Pause incoming tokens"
                    : queue.status === "paused"
                      ? "Resume queue"
                      : "Activate queue"}
                </span>
                <StatusBadge status={queue.status} />
              </button>
              <button
                onClick={() => setConfirm({ kind: "close" })}
                disabled={queue.status === "closed" || busy}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-medium text-warning hover:bg-warning-soft disabled:opacity-50"
              >
                <X size={13} />
                Close queue
              </button>
              <button
                onClick={() => setConfirm({ kind: "delete" })}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-medium text-danger hover:bg-danger-soft"
              >
                <Trash2 size={13} />
                Delete queue and its history
              </button>
            </div>
          </Card>
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.kind === "cancel"
            ? `Cancel ${tokenLabel(confirm.token?.tokenNumber)}?`
            : confirm?.kind === "close"
              ? "Close this queue?"
              : "Delete this queue?"
        }
        description={
          confirm?.kind === "cancel"
            ? "This token will be removed from the waiting list and recorded as cancelled."
            : confirm?.kind === "close"
              ? "New tokens and service calls will stop until the queue is active again."
              : "This removes the queue, its tokens and related activity history. This action cannot be undone."
        }
        confirmLabel={
          confirm?.kind === "cancel"
            ? "Cancel token"
            : confirm?.kind === "close"
              ? "Close queue"
              : "Delete permanently"
        }
        destructive
        onConfirm={() => void performConfirm()}
        busy={busy}
      />
    </div>
  );
}
