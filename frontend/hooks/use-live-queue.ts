"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

export function useLiveQueue({
  queueId,
  publicId,
  onUpdate,
}: {
  queueId?: string;
  publicId?: string;
  onUpdate: () => void;
}) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!queueId && !publicId) return;
    const configuredApi = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
    const configuredSocket = process.env.NEXT_PUBLIC_SOCKET_URL?.trim().replace(/\/$/, "") ?? "";
    const socketOrigin =
      configuredSocket || (configuredApi ? configuredApi.replace(/\/api$/, "") : undefined);
    const socket: Socket = io(socketOrigin, {
      path: "/socket.io",
      withCredentials: true,
      auth: publicId ? { publicId } : {},
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    socket.on("connect", () => {
      setConnected(true);
      if (queueId) socket.emit("queue:join", queueId);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("queue:updated", onUpdate);
    socket.on("connect_error", () => setConnected(false));
    return () => {
      socket.emit("queue:leave", queueId);
      socket.off("queue:updated", onUpdate);
      socket.disconnect();
    };
  }, [queueId, publicId, onUpdate]);
  return connected;
}
