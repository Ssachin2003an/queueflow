"use client";

import { ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHeading } from "@/components/page-heading";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/ui/primitives";

export default function SettingsPage() {
  const { manager } = useAuth();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        eyebrow="QueueFlow / Workspace"
        title="Keep it comfortable."
        description="Manage your workspace preferences and see the manager identity attached to this session."
      />
      <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3 border-b border-line pb-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
              <UserRound size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Manager profile</h2>
              <p className="mt-1 text-[10px] text-muted">Your private account details.</p>
            </div>
          </div>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="eyebrow">Full name</dt>
              <dd className="mt-1.5 text-[12px] font-medium text-ink">{manager?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Email</dt>
              <dd className="mt-1.5 text-[12px] font-medium text-ink">{manager?.email ?? "—"}</dd>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3.5">
              <div className="flex gap-2.5">
                <ShieldCheck size={15} className="mt-0.5 text-accent" />
                <p className="text-[10px] leading-5 text-muted">
                  Your password is stored as a one-way hash. It is never returned to this screen or
                  included in public queue responses.
                </p>
              </div>
            </div>
          </dl>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3 border-b border-line pb-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface-soft text-muted">
              <span className="text-lg">◐</span>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Appearance</h2>
              <p className="mt-1 text-[10px] text-muted">Choose a theme for your queue desk.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-canvas p-3.5">
            <div>
              <p className="text-[11px] font-medium text-ink">Light or dark mode</p>
              <p className="mt-1 text-[9px] text-muted">Preference is saved in this browser.</p>
            </div>
            <ThemeToggle />
          </div>
        </Card>
      </div>
    </div>
  );
}
