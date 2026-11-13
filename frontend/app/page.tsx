import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  MoveUpRight,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlowMark, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: Workflow,
    number: "01",
    title: "One clear line",
    body: "Give every visitor a place in the flow. Create queues for your team, location, or service — then keep the order clear.",
  },
  {
    icon: Radio,
    number: "02",
    title: "Call with confidence",
    body: "Move the next person into service in one click. Every connected screen catches up instantly.",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "Know your pace",
    body: "See wait and service times from real token history, so small improvements become visible.",
  },
];

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-canvas">
      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <header className="flex h-[78px] items-center justify-between border-b border-line/80">
          <Wordmark />
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
            <a
              href="#how-it-works"
              className="text-[13px] font-medium text-muted transition hover:text-ink"
            >
              How it works
            </a>
            <a
              href="#features"
              className="text-[13px] font-medium text-muted transition hover:text-ink"
            >
              Features
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <ThemeToggle
              showLabel
              className="border border-line bg-surface/70 hover:bg-surface-soft"
            />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">
                <span className="sm:hidden">Create</span>
                <span className="hidden sm:inline">Create your workspace</span>
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          </div>
        </header>

        <section className="relative grid min-h-[640px] items-center gap-12 py-16 lg:min-h-[690px] lg:grid-cols-[.92fr_1.08fr] lg:gap-12 lg:py-20">
          <div className="pointer-events-none absolute -left-56 top-12 size-[560px] rounded-full bg-accent/5 blur-[110px]" />
          <div className="relative z-10 max-w-[610px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted shadow-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/40" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              Queue operations, in a better rhythm
            </div>
            <h1 className="max-w-[660px] text-[clamp(3.3rem,7.3vw,6.35rem)] font-semibold leading-[.94] tracking-[-.075em] text-ink">
              Make waiting
              <br />
              feel{" "}
              <span className="relative inline-block text-accent">
                well handled
                <span className="absolute -bottom-2 left-1 h-[7px] w-[93%] rounded-full bg-accent/20" />
              </span>
              .
            </h1>
            <p className="mt-7 max-w-[460px] text-[16px] leading-[1.8] text-muted sm:text-[17px]">
              A calmer way to run service queues. Keep every token in order, call the next person
              with confidence, and see how your team is moving.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/register">
                  Open your queue <ArrowRight size={16} />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <a href="#how-it-works">
                  See how it works <ArrowDown size={15} />
                </a>
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-accent" /> Clear token history
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-accent" /> Live display screen
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-accent" /> Real operational analytics
              </span>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-[620px] lg:ml-auto lg:mr-0">
            <div className="absolute -right-6 -top-6 size-24 rounded-full border border-accent/20" />
            <div className="absolute -bottom-8 -left-8 size-36 rounded-full border border-line/70" />
            <div className="relative overflow-hidden rounded-[24px] border border-line bg-surface p-2.5 shadow-[0_28px_90px_rgba(26,45,37,.12)]">
              <div className="grid-paper absolute inset-0 opacity-[.42]" />
              <div className="relative overflow-hidden rounded-[17px] border border-line/80 bg-canvas">
                <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2.5">
                    <FlowMark size={27} />
                    <div>
                      <p className="text-[11px] font-semibold text-ink">Northside studio</p>
                      <p className="text-[9px] text-muted">Queue overview · illustrative preview</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent-soft px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-accent-strong">
                    <span className="size-1.5 rounded-full bg-accent" /> Active
                  </span>
                </div>
                <div className="grid gap-3 p-3.5 sm:grid-cols-[1fr_1.15fr] sm:p-4">
                  <div className="flex flex-col gap-3">
                    <div className="rounded-[14px] border border-accent/20 bg-accent-soft p-4">
                      <div className="flex items-center justify-between">
                        <span className="eyebrow text-accent-strong">Now serving</span>
                        <AudioLines size={15} className="text-accent-strong" />
                      </div>
                      <p className="mt-4 font-mono-ui text-[39px] font-medium leading-none tracking-[-.07em] text-ink">
                        Q<span className="text-accent">018</span>
                      </p>
                      <p className="mt-2 text-[10px] text-muted">Service is in progress</p>
                    </div>
                    <div className="rounded-[14px] border border-line bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <span className="eyebrow">Next in line</span>
                        <span className="font-mono-ui text-[10px] text-muted">03 ahead</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {["Q019", "Q020", "Q021"].map((token, i) => (
                          <div
                            key={token}
                            className="flex items-center gap-2.5 rounded-[9px] bg-canvas px-2.5 py-2"
                          >
                            <span
                              className={`font-mono-ui text-[10px] font-semibold ${i === 0 ? "text-accent-strong" : "text-muted"}`}
                            >
                              {token}
                            </span>
                            <span className="h-px flex-1 bg-line" />
                            <span className="text-[9px] text-muted">
                              {i === 0 ? "Up next" : `Position ${i + 2}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[14px] border border-line bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="eyebrow">Flow at a glance</p>
                        <p className="mt-1 text-[10px] text-muted">
                          Illustrative sample, not live data
                        </p>
                      </div>
                      <Clock3 size={15} className="text-muted" />
                    </div>
                    <div className="mt-5 flex h-[143px] items-end gap-2 border-b border-line px-1">
                      {[37, 54, 46, 77, 61, 86, 68, 94, 73, 82, 58, 70].map((height, i) => (
                        <div
                          key={`${height}-${i}`}
                          className={`relative flex-1 rounded-t-[4px] ${i === 7 ? "bg-accent" : "bg-accent/15"}`}
                          style={{ height: `${height}%` }}
                        >
                          <span className="absolute inset-x-0 bottom-0 h-[38%] rounded-t-[4px] bg-accent/20" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[9px] text-muted">
                      <span>09:00</span>
                      <span>11:00</span>
                      <span>13:00</span>
                      <span>15:00</span>
                    </div>
                    <div className="mt-5 flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                          <Users size={14} />
                        </span>
                        <span className="text-[10px] text-muted">People waiting</span>
                      </div>
                      <span className="font-mono-ui text-sm font-semibold text-ink">04</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-line bg-surface px-4 py-2.5 text-[9px] text-muted">
                  <span>One organized line. Fewer question marks.</span>
                  <span className="font-mono-ui">QF / 01</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-3 top-[44%] hidden rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow)] sm:flex sm:items-center sm:gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                <MoveUpRight size={15} />
              </span>
              <span>
                <span className="block text-[10px] font-semibold text-ink">
                  The order stays clear
                </span>
                <span className="mt-0.5 block text-[9px] text-muted">
                  Every position, accounted for
                </span>
              </span>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-line py-20 sm:py-24">
          <div className="grid gap-9 lg:grid-cols-[.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="eyebrow">A better service rhythm</p>
              <h2 className="mt-4 max-w-[440px] text-3xl font-semibold leading-tight tracking-[-.055em] text-ink sm:text-[42px]">
                A simple line can change the whole experience.
              </h2>
              <p className="mt-4 max-w-[390px] text-sm leading-7 text-muted">
                QueueFlow gives managers one reliable place to guide each visit — from the first
                token to the last service note.
              </p>
              <a
                href="#features"
                className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold text-accent-strong hover:gap-3"
              >
                Explore the system <ChevronRight size={14} />
              </a>
            </div>
            <div className="grid divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0 md:border-y-0">
              {features.map(({ icon: Icon, number, title, body }) => (
                <article key={number} className="py-6 md:px-5 md:first:pl-0 md:last:pr-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-ui text-[10px] text-muted/80">{number}</span>
                    <Icon size={17} className="text-accent" />
                  </div>
                  <h3 className="mt-8 text-[15px] font-semibold tracking-[-.025em] text-ink">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-[12px] leading-6 text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="features"
          className="relative mb-20 overflow-hidden rounded-[26px] bg-[#14201c] px-6 py-12 text-white sm:px-10 sm:py-14 lg:px-16"
        >
          <div className="absolute right-[-55px] top-[-125px] size-[360px] rounded-full border border-white/10" />
          <div className="absolute right-[-15px] top-[-80px] size-[280px] rounded-full border border-white/10" />
          <div className="absolute inset-y-0 right-0 hidden w-[45%] bg-gradient-to-l from-accent/10 to-transparent lg:block" />
          <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] text-white/70">
                <Sparkles size={12} className="text-[#5fe0bd]" />
                Designed for the moments between arrivals
              </div>
              <h2 className="mt-5 max-w-[640px] text-[clamp(2rem,4vw,3.1rem)] font-semibold leading-[1.03] tracking-[-.06em]">
                Keep your team in sync.
                <br />
                <span className="text-[#78e2c4]">Keep people moving.</span>
              </h2>
              <p className="mt-4 max-w-[500px] text-[13px] leading-6 text-white/65">
                Make every handoff visible, every position understandable, and every improvement
                measurable.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                variant="secondary"
                size="lg"
                className="border-white/20 bg-white text-[#14201c] hover:bg-white/90"
                asChild
              >
                <Link href="/register">
                  Create your first queue <ArrowRight size={15} />
                </Link>
              </Button>
              <div className="flex items-center justify-center gap-2 text-[10px] text-white/50">
                <ShieldCheck size={13} /> Your queue. Your control.
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col items-start justify-between gap-4 border-t border-line py-6 sm:flex-row sm:items-center">
          <Wordmark compact />
          <p className="text-[10px] text-muted">
            A clearer line, from first hello to service complete.
          </p>
          <div className="flex gap-4 text-[10px] text-muted">
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-ink">
              Create workspace
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
