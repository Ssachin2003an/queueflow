import { randomBytes } from "node:crypto";
import http from "node:http";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { Server as SocketServer } from "socket.io";
import { z } from "zod";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import next from "next";
import { env, connectDatabase } from "./config/runtime";
import {
  asyncRoute,
  HttpError,
  loginInput,
  queueInput,
  registerInput,
  requireAuth,
  tokenInput,
  validate,
} from "./middleware/core";
import {
  analyticsService,
  authService,
  publicService,
  queueService,
  tokenService,
} from "./services/domain";
import { Manager, Queue, Token } from "./models";

type NextHandler = (request: Request, response: Response) => void | Promise<void>;
type QueryRecord = Record<string, unknown>;
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const send = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });
const cookieOptions = (httpOnly: boolean) => ({
  httpOnly,
  secure: env.COOKIE_SECURE === "true",
  sameSite: env.COOKIE_SECURE === "true" ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

export function createServer(nextHandler?: NextHandler) {
  const app = express();
  app.disable("x-powered-by");
  // The managed Preview is embedded cross-site; do not emit X-Frame-Options or frame-ancestors 'self'.
  app.use(helmet({ contentSecurityPolicy: false, xFrameOptions: false }));
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser(env.COOKIE_SECRET));

  const server = http.createServer(app);
  const io = new SocketServer(server, { cors: { origin: env.FRONTEND_URL, credentials: true } });
  app.use((req, _res, nextMiddleware) => {
    if (!writeMethods.has(req.method)) return nextMiddleware();
    const header = req.get("x-csrf-token");
    const cookie = req.cookies?.queueflow_csrf;
    if (!header || !cookie || header !== cookie)
      return nextMiddleware(new HttpError(403, "CSRF validation failed"));
    return nextMiddleware();
  });

  const router = express.Router();
  router.get("/health", (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    return res.status(connected ? 200 : 503).json({
      success: connected,
      data: {
        status: connected ? "ok" : "degraded",
        database: connected ? "connected" : "disconnected",
      },
      ...(!connected ? { error: "MongoDB is not connected. Configure MONGODB_URI." } : {}),
    });
  });
  router.get("/auth/csrf", (_req, res) => {
    const csrfToken = randomBytes(32).toString("base64url");
    res.setHeader("Cache-Control", "no-store");
    res.cookie("queueflow_csrf", csrfToken, { ...cookieOptions(false), httpOnly: false });
    return send(res, { csrfToken });
  });
  router.use((_req, res, nextMiddleware) => {
    if (mongoose.connection.readyState !== 1)
      return res.status(503).json({
        success: false,
        error: "MongoDB is unavailable. Configure MONGODB_URI and check the connection.",
      });
    return nextMiddleware();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.post(
    "/auth/register",
    authLimiter,
    validate(registerInput),
    asyncRoute(async (req, res) => {
      const result = await authService.register(req.body);
      const csrfToken = setSession(res, result.token);
      return send(res, { manager: result.manager, csrfToken }, 201);
    }),
  );
  router.post(
    "/auth/login",
    authLimiter,
    validate(loginInput),
    asyncRoute(async (req, res) => {
      const result = await authService.login(req.body);
      const csrfToken = setSession(res, result.token);
      return send(res, { manager: result.manager, csrfToken });
    }),
  );
  router.post("/auth/logout", (_req, res) => {
    const secure = env.COOKIE_SECURE === "true";
    const sameSite = secure ? "none" : "lax";
    res.clearCookie("queueflow_session", { httpOnly: true, secure, sameSite, path: "/" });
    res.clearCookie("queueflow_csrf", { httpOnly: false, secure, sameSite, path: "/" });
    return send(res, { loggedOut: true });
  });
  router.get(
    "/auth/me",
    requireAuth,
    asyncRoute(async (req, res) => {
      const manager = await Manager.findById(req.managerId).select("name email createdAt");
      if (!manager) throw new HttpError(401, "Session manager not found");
      return send(res, {
        manager: {
          id: String(manager._id),
          name: manager.name,
          email: manager.email,
          createdAt: manager.createdAt,
        },
      });
    }),
  );

  router.get(
    "/public/queues/:publicId",
    asyncRoute(async (req, res) => send(res, await publicService.display(req.params.publicId))),
  );
  router.get(
    "/public/queues/:publicId/current",
    asyncRoute(async (req, res) => send(res, await publicService.display(req.params.publicId))),
  );

  router.use(requireAuth);
  router.post(
    "/queues",
    validate(queueInput),
    asyncRoute(async (req, res) => {
      const queue = await queueService.create(req.managerId!, req.body);
      emitOwner(io, req.managerId!, "queue:updated", { type: "created", queue: safeQueue(queue) });
      return send(res, managerQueue(queue), 201);
    }),
  );
  router.get(
    "/queues",
    asyncRoute(async (req, res) =>
      send(res, await queueService.list(req.managerId!, req.query as QueryRecord)),
    ),
  );
  router.get(
    "/queues/:id",
    asyncRoute(async (req, res) =>
      send(res, managerQueue(await queueService.get(req.params.id, req.managerId!))),
    ),
  );
  router.put(
    "/queues/:id",
    asyncRoute(async (req, res) => {
      const body = z
        .object({
          name: z.string().trim().min(2).max(80).optional(),
          description: z.string().trim().max(240).optional(),
        })
        .strict()
        .parse(req.body);
      const queue = await queueService.update(req.params.id, req.managerId!, body);
      await emitQueue(io, String(queue._id));
      return send(res, managerQueue(queue));
    }),
  );
  router.patch(
    "/queues/:id/status",
    asyncRoute(async (req, res) => {
      const { status } = z
        .object({ status: z.enum(["active", "paused", "closed"]) })
        .strict()
        .parse(req.body);
      const queue = await queueService.status(req.params.id, req.managerId!, status);
      await emitQueue(io, String(queue._id));
      return send(res, managerQueue(queue));
    }),
  );
  router.delete(
    "/queues/:id",
    asyncRoute(async (req, res) => {
      const queue = await queueService.get(req.params.id, req.managerId!);
      await queueService.delete(req.params.id, req.managerId!);
      emitOwner(io, req.managerId!, "queue:updated", { type: "deleted", queueId: req.params.id });
      io.to(`public:${queue.publicId}`).emit("queue:updated", {
        queue: safeQueue({
          _id: queue._id,
          name: queue.name,
          status: "closed",
          publicId: queue.publicId,
        }),
        deleted: true,
        waiting: 0,
        current: null,
      });
      return send(res, { deleted: true });
    }),
  );
  router.post(
    "/queues/:id/tokens",
    validate(tokenInput),
    asyncRoute(async (req, res) => {
      const token = await tokenService.add(req.params.id, req.managerId!, req.body);
      await emitQueue(io, String(token.queueId));
      return send(res, managerToken(token), 201);
    }),
  );
  router.get(
    "/queues/:id/tokens",
    asyncRoute(async (req, res) => {
      const result = await tokenService.list(
        req.params.id,
        req.managerId!,
        req.query as QueryRecord,
      );
      return send(res, { ...result, items: result.items.map(managerToken) });
    }),
  );
  router.get(
    "/tokens/:id",
    asyncRoute(async (req, res) =>
      send(res, managerToken(await tokenService.get(req.params.id, req.managerId!))),
    ),
  );
  router.patch(
    "/tokens/:id/reorder",
    asyncRoute(async (req, res) => {
      const { position } = z
        .object({ position: z.number().int().min(0) })
        .strict()
        .parse(req.body);
      const token = await tokenService.reorder(req.params.id, req.managerId!, position);
      await emitQueue(io, String(token.queueId));
      return send(res, managerToken(token));
    }),
  );
  router.post(
    "/queues/:id/call-next",
    asyncRoute(async (req, res) => {
      const token = await tokenService.callNext(req.params.id, req.managerId!);
      await emitQueue(io, req.params.id);
      return send(res, { token: token ? managerToken(token) : null });
    }),
  );
  router.patch(
    "/tokens/:id/complete",
    asyncRoute(async (req, res) => {
      const token = await tokenService.complete(req.params.id, req.managerId!);
      await emitQueue(io, String(token.queueId));
      return send(res, managerToken(token));
    }),
  );
  router.patch(
    "/tokens/:id/cancel",
    asyncRoute(async (req, res) => {
      const token = await tokenService.cancel(req.params.id, req.managerId!);
      await emitQueue(io, String(token.queueId));
      return send(res, managerToken(token));
    }),
  );

  const dateRange = (req: Request) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const timeZone = req.query.timezone === undefined ? "UTC" : String(req.query.timezone);
    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime())) ||
      (from && to && from > to) ||
      timeZone.length > 100
    )
      throw new HttpError(400, "Invalid date range");
    try {
      new Intl.DateTimeFormat("en", { timeZone }).format();
    } catch {
      throw new HttpError(400, "Invalid analytics time zone");
    }
    return { from, to, timeZone };
  };
  router.get(
    "/analytics/overview",
    asyncRoute(async (req, res) => {
      const range = dateRange(req);
      return send(res, await analyticsService.overview(req.managerId!, range.from, range.to));
    }),
  );
  router.get(
    "/analytics/queues/:id",
    asyncRoute(async (req, res) => {
      const range = dateRange(req);
      return send(
        res,
        await analyticsService.queue(req.params.id, req.managerId!, range.from, range.to),
      );
    }),
  );
  router.get(
    "/analytics/trends",
    asyncRoute(async (req, res) =>
      send(
        res,
        await (async () => {
          const range = dateRange(req);
          return analyticsService.trends(
            req.managerId!,
            Number(req.query.days) || 7,
            range.from,
            range.to,
            range.timeZone,
          );
        })(),
      ),
    ),
  );
  router.get(
    "/analytics/wait-times",
    asyncRoute(async (req, res) => {
      const range = dateRange(req);
      return send(
        res,
        await analyticsService.waitTimes(req.managerId!, range.from, range.to, range.timeZone),
      );
    }),
  );
  router.get(
    "/analytics/peak-hours",
    asyncRoute(async (req, res) => {
      const range = dateRange(req);
      return send(
        res,
        await analyticsService.peakHours(req.managerId!, range.from, range.to, range.timeZone),
      );
    }),
  );
  app.use("/api", router);

  app.use("/api", (_req, res) =>
    res.status(404).json({ success: false, error: "API route not found" }),
  );
  if (nextHandler)
    app.use((req, res, nextMiddleware) => {
      Promise.resolve(nextHandler(req, res)).catch(nextMiddleware);
    });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as { name?: string; code?: number | string; message?: string };
    const status =
      err instanceof HttpError
        ? err.status
        : error.name === "ValidationError" || error.name === "ZodError"
          ? 400
          : error.code === 11000
            ? 409
            : error.name === "MongooseServerSelectionError" || error.name === "MongoNetworkError"
              ? 503
              : 500;
    return res.status(status).json({
      success: false,
      error: status === 500 ? "Internal server error" : (error.message ?? "Request failed"),
    });
  });

  io.use(async (socket, nextSocket) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? "";
      const session = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("queueflow_session="))
        ?.slice("queueflow_session=".length);
      const token =
        socket.handshake.auth?.token ?? (session ? decodeURIComponent(session) : undefined);
      if (token && env.JWT_SECRET) {
        const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
        if (typeof payload.sub !== "string") throw new Error("Invalid manager session");
        socket.data.managerId = payload.sub;
      } else if (
        typeof socket.handshake.auth?.publicId === "string" &&
        (await Queue.exists({ publicId: socket.handshake.auth.publicId }))
      ) {
        socket.data.publicId = socket.handshake.auth.publicId;
      } else throw new Error("Authentication required");
      nextSocket();
    } catch {
      nextSocket(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    if (socket.data.publicId) socket.join(`public:${socket.data.publicId}`);
    if (socket.data.managerId) socket.join(`owner:${socket.data.managerId}`);
    socket.on("queue:join", async (id: string) => {
      if (!socket.data.managerId) return;
      try {
        if (await Queue.exists({ _id: id, managerId: socket.data.managerId }))
          socket.join(`manager:${id}`);
      } catch {
        /* Invalid IDs grant no room. */
      }
    });
    socket.on("queue:leave", (id: string) => socket.leave(`manager:${id}`));
  });
  return { app, server, io };
}

function setSession(res: Response, token: string) {
  const csrfToken = randomBytes(32).toString("base64url");
  res.cookie("queueflow_session", token, cookieOptions(true));
  res.cookie("queueflow_csrf", csrfToken, { ...cookieOptions(false), httpOnly: false });
  return csrfToken;
}
function safeQueue(queue: { _id: unknown; name: string; status: string; publicId: string }) {
  return {
    id: String(queue._id),
    name: queue.name,
    status: queue.status,
    publicId: queue.publicId,
  };
}
function managerQueue<T extends { _id: unknown; toObject: () => object }>(queue: T) {
  return { ...queue.toObject(), id: String(queue._id) };
}
function managerToken<T extends { _id: unknown; toObject: () => object }>(token: T) {
  return { ...token.toObject(), id: String(token._id) };
}
function emitOwner(io: SocketServer, managerId: string, event: string, payload: unknown) {
  io.to(`owner:${managerId}`).emit(event, payload);
}
async function emitQueue(io: SocketServer, id: string) {
  const queue = await Queue.findById(id);
  if (!queue) return;
  const [waiting, current] = await Promise.all([
    Token.countDocuments({ queueId: id, status: "waiting" }),
    Token.findOne({ queueId: id, status: { $in: ["called", "serving"] } }).sort({ calledAt: -1 }),
  ]);
  const payload = {
    queue: safeQueue(queue),
    waiting,
    current: current
      ? {
          id: String(current._id),
          tokenNumber: current.tokenNumber,
          status: current.status,
          calledAt: current.calledAt,
        }
      : null,
  };
  io.to(`manager:${id}`).emit("queue:updated", payload);
  io.to(`owner:${String(queue.managerId)}`).emit("queue:updated", payload);
  io.to(`public:${queue.publicId}`).emit("queue:updated", payload);
}

async function start() {
  if (env.MONGODB_URI) {
    try {
      await connectDatabase();
      console.log("MongoDB connection ready");
    } catch {
      console.error(
        "MongoDB connection failed; serving the UI in degraded mode. Check the Atlas URI, database user and network access list.",
      );
    }
  } else
    console.warn(
      "MONGODB_URI is not set; QueueFlow pages will load, but data-backed APIs remain unavailable.",
    );
  const nextApplication = next({
    dev: env.NODE_ENV !== "production",
    dir: path.resolve(process.cwd(), "frontend"),
  });
  await nextApplication.prepare();
  const runtime = createServer(nextApplication.getRequestHandler() as unknown as NextHandler);
  runtime.server.listen(env.PORT, "0.0.0.0", () =>
    console.log(`QueueFlow listening on 0.0.0.0:${env.PORT}`),
  );
  const shutdown = () =>
    runtime.server.close(() => {
      runtime.io.close();
      mongoose.disconnect().finally(() => process.exit(0));
    });
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
if (require.main === module)
  void start().catch((error) => {
    console.error("QueueFlow startup failed", error);
    process.exitCode = 1;
  });
