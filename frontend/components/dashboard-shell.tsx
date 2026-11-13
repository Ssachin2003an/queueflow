"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  X,
  Layers3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { ActivityItem } from "@queueflow/shared";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/queues", label: "Queues", icon: Layers3 },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];
const settingsNav = { href: "/dashboard/settings", label: "Settings", icon: Settings2 };
const pageTitle: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/queues": "Queues",
  "/dashboard/queues/create": "Create queue",
  "/dashboard/analytics": "Analytics",
  "/dashboard/settings": "Settings",
};

function SidebarContent({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { manager, logout } = useAuth();
  const doLogout = async () => {
    await logout();
    toast.success("You’re signed out");
    router.replace("/login");
  };
  const navLink = (item: (typeof nav)[number]) => {
    const active =
      item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={close}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium transition ${active ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-surface-soft hover:text-ink"}`}
      >
        <span
          className={`absolute inset-y-2 left-0 w-[2px] rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
        />
        <Icon size={16} strokeWidth={active ? 2.3 : 1.8} />
        <span className="flex-1">{item.label}</span>
        {item.href === "/dashboard/queues" && (
          <ChevronRight size={13} className="opacity-0 transition group-hover:opacity-70" />
        )}
      </Link>
    );
  };
  return (
    <div className="flex h-full flex-col px-3.5 py-5">
      <div className="flex items-center justify-between px-2">
        <Wordmark href="/dashboard" compact />
        <span className="rounded-md border border-line px-1.5 py-1 font-mono-ui text-[8px] text-muted">
          BETA
        </span>
      </div>
      <div className="mt-8 px-2">
        <p className="eyebrow mb-2.5">Workspace</p>
        <div className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-left">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-[10px] font-bold text-white">
            {manager?.name?.[0]?.toUpperCase() ?? "Q"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold text-ink">
              {manager?.name ? `${manager.name}’s workspace` : "My workspace"}
            </span>
            <span className="mt-0.5 block text-[9px] text-muted">Manager account</span>
          </span>
          <span className="rounded-md border border-line px-1.5 py-1 text-[8px] text-muted">
            Workspace
          </span>
        </div>
      </div>
      <nav className="mt-8 space-y-1" aria-label="Dashboard navigation">
        {nav.map(navLink)}
      </nav>
      <div className="mt-8">
        <p className="eyebrow mb-2.5 px-3">Manage</p>
        {navLink(settingsNav)}
      </div>
      <div className="mt-auto">
        <div className="mb-3 rounded-xl border border-line bg-surface-soft/70 p-3">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-accent" />
            <span className="text-[10px] font-semibold text-ink">QueueFlow, in sync</span>
          </div>
          <p className="mt-1.5 text-[9px] leading-4 text-muted">
            Changes update across your connected queue screens.
          </p>
        </div>
        <button
          onClick={doLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-medium text-muted transition hover:bg-danger-soft hover:text-danger"
        >
          <LogOut size={15} />
          Sign out
        </button>
        <div className="mt-3 flex items-center justify-between border-t border-line px-2 pt-4">
          <span className="text-[9px] text-muted">QueueFlow · v1.0</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const toggleFeed = () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setError(false);
    void api<{ recentActivity?: ActivityItem[] }>("/analytics/overview")
      .then((result) => setActivity(result.recentActivity ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Recent activity notifications"
        title="Recent activity"
        aria-expanded={open}
        onClick={toggleFeed}
      >
        <Bell size={15} />
      </Button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-40 w-[min(350px,calc(100vw-24px))] rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Activity feed</p>
                <h2 className="mt-1 text-[13px] font-semibold text-ink">Recent queue updates</h2>
              </div>
              <Activity size={15} className="text-accent" />
            </div>
            {loading ? (
              <p className="py-8 text-center text-[10px] text-muted">Loading recent activity…</p>
            ) : error ? (
              <p className="py-8 text-center text-[10px] text-muted">
                Activity is temporarily unavailable.
              </p>
            ) : activity.length ? (
              <div className="mt-3 max-h-[330px] divide-y divide-line overflow-y-auto">
                {activity.slice(0, 8).map((item, index) => (
                  <div key={item.id ?? item.timestamp ?? index} className="py-3 first:pt-2">
                    <p className="text-[10px] font-medium leading-4 text-ink">{item.description}</p>
                    <p className="mt-1 text-[9px] text-muted">
                      {item.queueName ?? "Queue activity"}
                      {item.timestamp ? ` · ${formatRelativeTime(item.timestamp)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[10px] text-muted">No queue activity yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { manager, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const signOut = async () => {
    await logout();
    toast.success("You’re signed out");
    router.replace("/login");
  };
  useEffect(() => {
    if (!loading && !manager) router.replace("/login");
  }, [loading, manager, router]);
  const title = pageTitle[pathname] ?? (pathname.includes("/queues/") ? "Queue desk" : "Overview");

  if (loading || !manager)
    return (
      <div className="min-h-screen bg-canvas p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-36 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[242px] border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>
      <div className="lg:pl-[242px]">
        <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </Button>
            <span className="hidden text-[11px] text-muted sm:inline">Workspace</span>
            <ChevronRight size={13} className="hidden text-muted/70 sm:inline" />
            <h1 className="truncate text-[12px] font-semibold text-ink sm:text-sm">{title}</h1>
            {pathname.includes("/queues/") && !pathname.includes("/create") && (
              <span className="hidden rounded-full border border-accent/20 bg-accent-soft px-2 py-1 text-[9px] font-semibold text-accent-strong md:inline">
                Live queue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[9px] text-muted md:flex">
              <Command size={11} /> Queue desk
            </div>
            <NotificationBell />
            <ThemeToggle />
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <div className="relative">
              <button
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
                aria-label="Open manager profile"
                className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-surface-soft"
              >
                <span className="hidden max-w-[125px] truncate text-[10px] font-medium text-ink sm:inline">
                  {manager.name}
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-[#dff4ed] text-[11px] font-bold text-[#16755f] dark:bg-[#203c33] dark:text-[#8fe0c9]">
                  {manager.name.charAt(0).toUpperCase()}
                </span>
              </button>
              {profileOpen && (
                <>
                  <button
                    className="fixed inset-0 z-30 cursor-default"
                    aria-label="Close profile menu"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-11 z-40 w-56 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow)]">
                    <div className="border-b border-line px-3 py-2.5">
                      <p className="truncate text-[10px] font-semibold text-ink">{manager.name}</p>
                      <p className="mt-1 truncate text-[9px] text-muted">{manager.email}</p>
                    </div>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setProfileOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[10px] text-muted hover:bg-surface-soft hover:text-ink"
                    >
                      <Settings2 size={13} />
                      Account settings
                    </Link>
                    <button
                      onClick={() => void signOut()}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] text-danger hover:bg-danger-soft"
                    >
                      <LogOut size={13} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9 lg:py-9">
          {children}
        </main>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              aria-label="Close navigation overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lg:hidden"
            />
            <motion.aside
              initial={{ x: -290 }}
              animate={{ x: 0 }}
              exit={{ x: -290 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-line bg-surface lg:hidden"
            >
              <div className="absolute right-3 top-3 z-10">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X size={16} />
                </Button>
              </div>
              <SidebarContent close={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
