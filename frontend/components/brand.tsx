import Link from "next/link";

export function FlowMark({ className = "", size = 34 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[11px] bg-[#14201c] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.63} height={size * 0.63} viewBox="0 0 24 24" fill="none">
        <path
          d="M3 6.5h9.5M3 12h16M3 17.5h7"
          stroke="#49D3B1"
          strokeWidth="2.35"
          strokeLinecap="round"
        />
        <circle cx="18" cy="17.5" r="2.2" fill="#49D3B1" />
      </svg>
    </span>
  );
}

export function Wordmark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5"
      aria-label="QueueFlow home"
    >
      <FlowMark
        size={compact ? 30 : 35}
        className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.04]"
      />
      <span className="text-[17px] font-semibold tracking-[-0.045em] text-ink">
        queueflow<span className="text-accent">.</span>
      </span>
    </Link>
  );
}
