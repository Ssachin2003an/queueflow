"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[3px]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.985 }}
                transition={{ duration: 0.18 }}
                className="fixed left-1/2 top-1/2 z-[81] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${destructive ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-strong"}`}
                  >
                    <AlertTriangle size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-sm font-semibold tracking-[-.02em] text-ink">
                      {title}
                    </Dialog.Title>
                    <Dialog.Description className="mt-1.5 text-[11px] leading-5 text-muted">
                      {description}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="rounded-lg p-1.5 text-muted hover:bg-surface-soft hover:text-ink"
                      aria-label="Close dialog"
                    >
                      <X size={14} />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    disabled={busy}
                  >
                    Keep it
                  </Button>
                  <Button
                    variant={destructive ? "danger" : "primary"}
                    size="sm"
                    onClick={onConfirm}
                    disabled={busy}
                  >
                    {busy ? "Working…" : confirmLabel}
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
