"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Info, Layers3 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { queueSchema, type QueueInput, type QueueSummary } from "@queueflow/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { PageHeading } from "@/components/page-heading";

export default function CreateQueuePage() {
  const router = useRouter();
  const form = useForm<QueueInput>({
    resolver: zodResolver(queueSchema),
    defaultValues: { name: "", description: "" },
  });
  const queueName = useWatch({ control: form.control, name: "name" });
  const queueDescription = useWatch({ control: form.control, name: "description" });
  const onSubmit = async (input: QueueInput) => {
    try {
      const result = await api<QueueSummary>("/queues", {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success("Queue created", {
        description: `${input.name} is ready for its first person.`,
      });
      router.push(`/dashboard/queues/${result.id ?? result._id}`);
    } catch (error) {
      toast.error("Queue could not be created", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow="QueueFlow / Queues"
        title="Create a queue."
        description="Give the line a clear name. You can edit its details or pause arrivals whenever you need."
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/queues">
              <ArrowLeft size={14} />
              All queues
            </Link>
          </Button>
        }
      />
      <Card className="p-5 sm:p-7">
        <div className="mb-7 flex items-center gap-3 border-b border-line pb-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <Layers3 size={17} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Queue details</h2>
            <p className="mt-1 text-[10px] text-muted">
              Name and description are visible to managers.
            </p>
          </div>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="queue-name">
              Queue name <span className="text-danger">*</span>
            </Label>
            <Input
              id="queue-name"
              placeholder="e.g. Customer support"
              maxLength={80}
              invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            <div className="mt-1.5 flex justify-between">
              <p className="text-[10px] text-danger">{form.formState.errors.name?.message}</p>
              <span className="text-[9px] text-muted">{queueName?.length ?? 0}/80</span>
            </div>
          </div>
          <div>
            <Label htmlFor="queue-description">
              Description <span className="font-normal text-muted">(optional)</span>
            </Label>
            <textarea
              id="queue-description"
              rows={4}
              maxLength={240}
              placeholder="A short note to help your team understand this line."
              className={`w-full resize-y rounded-xl border bg-surface px-3.5 py-3 text-sm text-ink shadow-sm placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 ${form.formState.errors.description ? "border-danger" : "border-line"}`}
              {...form.register("description")}
            />
            <div className="mt-1.5 flex justify-between">
              <p className="text-[10px] text-danger">
                {form.formState.errors.description?.message}
              </p>
              <span className="text-[9px] text-muted">{queueDescription?.length ?? 0}/240</span>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-accent/15 bg-accent-soft/60 p-3.5">
            <Info size={15} className="mt-0.5 shrink-0 text-accent-strong" />
            <p className="text-[10px] leading-5 text-accent-strong">
              QueueFlow assigns a private manager ID and a separate public display identifier. Token
              numbers are generated from an atomic queue counter.
            </p>
          </div>
          <div className="flex flex-col-reverse justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
            <Button type="button" variant="ghost" asChild>
              <Link href="/dashboard/queues">Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Creating…
                </>
              ) : (
                <>
                  <Check size={14} />
                  Create queue
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
