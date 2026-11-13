"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export function CustomCursor() {
  const reducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(-80);
  const y = useMotionValue(-80);
  const smoothX = useSpring(x, { stiffness: 620, damping: 42, mass: 0.25 });
  const smoothY = useSpring(y, { stiffness: 620, damping: 42, mass: 0.25 });

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      const desktop = media.matches && !reducedMotion;
      setEnabled(desktop);
      document.body.classList.toggle("custom-cursor-enabled", desktop);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      document.body.classList.remove("custom-cursor-enabled");
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!enabled) return;
    const cursor = document.getElementById("custom-cursor");
    if (!cursor) return;
    let pointer = false;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      x.set(event.clientX);
      y.set(event.clientY);
      if (!pointer) {
        cursor.classList.add("is-visible");
        pointer = true;
      }
      const target = event.target instanceof Element ? event.target : null;
      const editable = target?.closest("input, textarea, select, [contenteditable='true']");
      const interactive = target?.closest(
        "a, button, [role='button'], [data-cursor='interactive']",
      );
      const draggable = target?.closest("[draggable='true'], [data-cursor='drag']");
      cursor.dataset.mode = editable
        ? "text"
        : draggable
          ? "drag"
          : interactive
            ? "interactive"
            : "default";
    };
    const onDown = () => {
      cursor.dataset.pressed = "true";
    };
    const onUp = () => {
      cursor.dataset.pressed = "false";
    };
    const onLeave = () => {
      cursor.classList.remove("is-visible");
      pointer = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled, x, y]);

  return (
    <motion.div id="custom-cursor" aria-hidden="true" style={{ x: smoothX, y: smoothY }}>
      <span className="cursor-orbit" />
      <span className="cursor-core" />
    </motion.div>
  );
}
