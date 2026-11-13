"use client";

import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  Bell,
  BellOff,
  Clock3,
  ExternalLink,
  Layers3,
  Radio,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueToken } from "@queueflow/shared";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { FlowMark, Wordmark } from "@/components/brand";
import { StatusBadge } from "@/components/ui/primitives";
import { useLiveQueue } from "@/hooks/use-live-queue";

type PublicQueue = {
  id: string;
  name: string;
  publicId: string;
  status: "active" | "paused" | "closed";
};
type PublicData = {
  queue: PublicQueue;
  waiting: number;
  current: QueueToken | null;
  recent: QueueToken[];
  estimatedWaitMinutes: number | null;
};

function label(number: string | number | undefined) {
  if (number == null) return "—";
  const value = String(number);
  return value.startsWith("Q") ? value : `Q${value.padStart(3, "0")}`;
}

export default function QueueDisplayPage() {
  const params = useParams<{ queueId: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const [clock, setClock] = useState("");
  const previous = useRef<string | number | undefined>(undefined);
  const load = useCallback(async () => {
    try {
      setData(await api<PublicData>(`/public/queues/${encodeURIComponent(params.queueId)}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue display is unavailable.");
    }
  }, [params.queueId]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 20_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [load]);
  const liveUpdate = useCallback(() => {
    void load();
  }, [load]);
  const connected = useLiveQueue({ publicId: data?.queue.publicId, onUpdate: liveUpdate });
  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("en", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentTokenNumber = data?.current?.tokenNumber;
  useEffect(() => {
    if (!sound || currentTokenNumber == null) return;
    if (
      previous.current !== undefined &&
      previous.current !== currentTokenNumber &&
      typeof window !== "undefined"
    ) {
      try {
        const AudioContextClass = window.AudioContext;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.36);
        oscillator.onended = () => void context.close();
      } catch {
        /* Audio is optional and browser-controlled. */
      }
    }
    previous.current = currentTokenNumber;
  }, [currentTokenNumber, sound]);

  if (error && !data)
    return (
      <main className="grid min-h-screen place-items-center bg-[#101514] px-6 text-white">
        <div className="max-w-md text-center">
          <FlowMark size={48} className="mx-auto" />
          <h1 className="mt-6 text-2xl font-semibold tracking-[-.04em]">
            This queue display isn’t available.
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/55">{error}</p>
        </div>
      </main>
    );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101514] text-white selection:bg-[#39c5a1]/30">
      <div
        className="pointer-events-none absolute inset-0 opacity-[.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,.22) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          maskImage: "linear-gradient(to bottom,black,transparent 75%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <FlowMark size={34} />
            <div>
              <p className="text-[12px] font-semibold tracking-[-.02em]">
                QueueFlow <span className="font-normal text-white/40">/ Public display</span>
              </p>
              <p className="mt-1 text-[9px] text-white/40">
                Live queue information · No personal details shown
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-right sm:block">
              <p className="font-mono-ui text-[12px] text-white/75">{clock}</p>
              <p className="mt-1 text-[8px] uppercase tracking-[.16em] text-white/35">Local time</p>
            </div>
            <span className="mx-1 hidden h-7 w-px bg-white/10 sm:block" />
            <button
              onClick={() => setSound((current) => !current)}
              className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-white/60 transition hover:bg-white/10 hover:text-white"
              title={sound ? "Turn off call sound" : "Turn on call sound"}
              aria-label={sound ? "Turn off call sound" : "Turn on call sound"}
            >
              {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <span
              className={`flex size-2 rounded-full ${connected ? "bg-[#58ddb8] shadow-[0_0_14px_rgba(88,221,184,.55)]" : "bg-white/25"}`}
              title={connected ? "Live connection" : "Reconnecting"}
            />
          </div>
        </header>

        <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[1.35fr_.65fr] lg:gap-8 lg:py-12">
          <div className="relative flex h-full min-h-[420px] flex-col justify-center overflow-hidden rounded-[26px] border border-white/10 bg-white/[.035] p-6 sm:p-10 lg:p-12">
            <div className="absolute -right-20 -top-32 size-[400px] rounded-full border border-[#39c5a1]/10" />
            <div className="absolute -right-4 -top-16 size-[285px] rounded-full border border-white/[.06]" />
            <div className="absolute bottom-[-110px] left-[-40px] size-[290px] rounded-full bg-[#39c5a1]/[.06] blur-[80px]" />
            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-[#68dbb9]">
                  <Layers3 size={17} />
                </span>
                <div>
                  <p className="eyebrow text-white/40">Now serving at</p>
                  <h1 className="mt-1 text-[17px] font-semibold tracking-[-.04em] text-white sm:text-[20px]">
                    {data?.queue.name ?? "QueueFlow"}
                  </h1>
                </div>
                <span className="ml-auto">
                  <StatusBadge status={data?.queue.status ?? "active"} />
                </span>
              </div>
              <div className="mt-14 sm:mt-[72px]">
                <p className="eyebrow text-white/40">The next person we’re ready for</p>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={String(data?.current?.tokenNumber ?? "empty")}
                    initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                    className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3"
                  >
                    <span className="font-mono-ui text-[clamp(5.2rem,16vw,12rem)] font-medium leading-[.9] tracking-[-.09em] text-[#76e2c4]">
                      {data?.current ? label(data.current.tokenNumber) : "—"}
                    </span>
                    {data?.current && (
                      <span className="mb-2 flex items-center gap-2 text-[12px] text-white/55">
                        <AudioLines size={15} className="text-[#76e2c4]" />
                        Please proceed to service
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
                <p className="mt-5 text-[13px] text-white/55 sm:text-[15px]">
                  {data?.current
                    ? "Your token has been called. Please make your way to the service desk."
                    : data?.queue.status === "active"
                      ? "We’ll call the next token shortly. Thank you for your patience."
                      : `This queue is ${data?.queue.status}. Please check with the service team.`}
                </p>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-[10px] text-white/45">
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#58ddb8]" />
                  {connected ? "Live display connected" : "Live display reconnecting"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Bell size={12} />
                  Ask the desk if you need assistance
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <article className="rounded-[20px] border border-white/10 bg-white/[.04] p-4 sm:p-5">
                <div className="flex items-center gap-2 text-white/45">
                  <Users size={14} />
                  <span className="eyebrow text-white/45">Waiting</span>
                </div>
                <p className="mt-4 font-mono-ui text-[38px] font-medium leading-none tracking-[-.07em] text-white sm:text-[47px]">
                  {data?.waiting ?? "—"}
                </p>
                <p className="mt-2 text-[9px] text-white/35">people in line</p>
              </article>
              <article className="rounded-[20px] border border-white/10 bg-white/[.04] p-4 sm:p-5">
                <div className="flex items-center gap-2 text-white/45">
                  <Clock3 size={14} />
                  <span className="eyebrow text-white/45">Est. wait</span>
                </div>
                <p className="mt-4 font-mono-ui text-[32px] font-medium leading-none tracking-[-.07em] text-white sm:text-[38px]">
                  {data?.estimatedWaitMinutes == null
                    ? "—"
                    : formatDuration(data.estimatedWaitMinutes)}
                </p>
                <p className="mt-2 text-[9px] text-white/35">based on recorded service history</p>
              </article>
            </div>
            <div className="flex-1 rounded-[20px] border border-white/10 bg-white/[.04] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow text-white/40">Recently called</p>
                  <h2 className="mt-1.5 text-[13px] font-semibold text-white/90">
                    Keep an eye on the board.
                  </h2>
                </div>
                <span className="flex size-8 items-center justify-center rounded-xl bg-[#39c5a1]/10 text-[#76e2c4]">
                  <Radio size={15} />
                </span>
              </div>
              {data?.recent?.length ? (
                <div className="mt-4 space-y-2">
                  {data.recent.slice(0, 5).map((token, index) => (
                    <motion.div
                      key={`${token.tokenNumber}-${token.calledAt ?? index}`}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${index === 0 ? "border-[#39c5a1]/20 bg-[#39c5a1]/[.07]" : "border-white/[.06] bg-black/[.07]"}`}
                    >
                      <span
                        className={`font-mono-ui text-[15px] font-medium tracking-tight ${index === 0 ? "text-[#76e2c4]" : "text-white/60"}`}
                      >
                        {label(token.tokenNumber)}
                      </span>
                      <span className="h-6 w-px bg-white/10" />
                      <span className="flex-1 text-[9px] text-white/45">
                        {index === 0 ? "Most recently called" : "Called earlier"}
                      </span>
                      {index === 0 && <span className="size-1.5 rounded-full bg-[#58ddb8]" />}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[10px] text-white/40">
                  Called tokens will appear here.
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-1 text-[9px] text-white/35">
              <span className="inline-flex items-center gap-1.5">
                <span className="flex size-5 items-center justify-center rounded-md bg-white/[.06]">
                  <Clock3 size={10} />
                </span>
                Please keep your token ready.
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FlowMark size={19} />
                QueueFlow
              </span>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-white/[.08] pt-4 text-[8px] text-white/30">
          <span>Queue information refreshes automatically.</span>
          <span>{data?.queue.name ?? "Public queue display"}</span>
        </footer>
      </div>
    </main>
  );
}
