import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server as SocketServer } from "socket.io";
import { io as socketClient, type Socket } from "socket.io-client";
import { MongoMemoryServer } from "mongodb-memory-server-core";

const TEST_SECRET = "queueflow-test-only-signing-secret-never-use-in-production";
const PASSWORD = "QueueFlow-Test-Password-42";
let mongod: MongoMemoryServer;
let app: Express;
let io: SocketServer;
let httpServer: HttpServer;
let socketUrl: string;

type Browser = ReturnType<typeof request.agent>;
type ManagerSession = {
  browser: Browser;
  csrfToken: string;
  id: string;
  sessionCookie: string;
};
type QueueData = { id: string; publicId: string; name: string };
type TokenData = {
  id: string;
  _id?: string;
  tokenNumber: number;
  position: number;
  status: string;
  personName: string;
  phone?: string;
};

async function register(email: string, name = "Test Manager"): Promise<ManagerSession> {
  const browser = request.agent(app);
  const bootstrap = await browser.get("/api/auth/csrf").expect(200);
  const response = await browser
    .post("/api/auth/register")
    .set("x-csrf-token", bootstrap.body.data.csrfToken)
    .send({ name, email, password: PASSWORD })
    .expect(201);
  expect(response.body.data.manager.email).toBe(email.trim().toLowerCase());
  expect(response.body.data.manager).not.toHaveProperty("passwordHash");
  expect(String(response.headers["set-cookie"] ?? "")).toContain("queueflow_session=");
  const sessionCookie = String(response.headers["set-cookie"] ?? "")
    .split(/,\s*(?=queueflow_)/)
    .find((cookie) => cookie.startsWith("queueflow_session="))
    ?.split(";", 1)[0];
  if (!sessionCookie) throw new Error("Manager session cookie was not set");
  return {
    browser,
    csrfToken: response.body.data.csrfToken,
    id: response.body.data.manager.id,
    sessionCookie,
  };
}

async function createQueue(session: ManagerSession, name = "Front desk"): Promise<QueueData> {
  const response = await session.browser
    .post("/api/queues")
    .set("x-csrf-token", session.csrfToken)
    .send({ name, description: "Integration test queue" })
    .expect(201);
  return response.body.data as QueueData;
}

async function addToken(
  session: ManagerSession,
  queueId: string,
  personName: string,
  phone = "",
): Promise<TokenData> {
  const response = await session.browser
    .post(`/api/queues/${queueId}/tokens`)
    .set("x-csrf-token", session.csrfToken)
    .send({ personName, phone });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data as TokenData;
}

async function todayRange() {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

async function openSocket(options: {
  auth?: Record<string, string>;
  extraHeaders?: Record<string, string>;
}) {
  const socket = socketClient(socketUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    reconnection: false,
    autoConnect: false,
    ...options,
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Socket.IO connection timed out")), 5_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.connect();
  });
  return socket;
}

function socketEvent<T>(socket: Socket, event: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Socket event ${event} timed out`)), 5_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

beforeAll(async () => {
  Reflect.set(process.env, "NODE_ENV", "test");
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.COOKIE_SECURE = "false";
  process.env.FRONTEND_URL = "http://localhost:3000";
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  const models = await import("../src/models");
  await Promise.all([
    models.Manager.init(),
    models.Queue.init(),
    models.Token.init(),
    models.Activity.init(),
  ]);
  const runtime = await import("../src/server");
  const server = runtime.createServer(() => undefined);
  app = server.app;
  io = server.io;
  httpServer = server.server;
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address() as AddressInfo;
  socketUrl = `http://127.0.0.1:${address.port}`;
}, 900_000);

beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections))
    await collection.deleteMany({});
});

afterAll(async () => {
  if (io) await new Promise<void>((resolve) => io.close(() => resolve()));
  await mongoose.disconnect();
  await mongod?.stop();
});

describe("QueueFlow HTTP integration", () => {
  it("requires a matching CSRF cookie/header, registers, returns a safe profile and rejects invalid credentials", async () => {
    const guest = request.agent(app);
    await guest
      .post("/api/auth/register")
      .send({ name: "No CSRF", email: "csrf@example.test", password: PASSWORD })
      .expect(403);
    const { browser, csrfToken, id } = await register("  CASEY@EXAMPLE.TEST  ", "Casey Manager");
    const profile = await browser.get("/api/auth/me").expect(200);
    expect(profile.body.data.manager).toMatchObject({
      id,
      email: "casey@example.test",
      name: "Casey Manager",
    });
    await browser
      .post("/api/auth/login")
      .set("x-csrf-token", csrfToken)
      .send({ email: "casey@example.test", password: "incorrect-password" })
      .expect(401);
    await browser
      .post("/api/auth/register")
      .set("x-csrf-token", csrfToken)
      .send({ name: "Duplicate", email: "casey@example.test", password: PASSWORD })
      .expect(409);
    await browser.post("/api/auth/logout").set("x-csrf-token", csrfToken).send({}).expect(200);
    await browser.get("/api/auth/me").expect(401);
  });

  it("enforces manager ownership across queue and token resources", async () => {
    const owner = await register("owner@example.test");
    const other = await register("other@example.test", "Other Manager");
    const queue = await createQueue(owner);
    const token = await addToken(owner, queue.id, "Private visitor", "+15550101234");
    const otherQueues = await other.browser.get("/api/queues").expect(200);
    expect(otherQueues.body.data.items).toEqual([]);
    await other.browser.get(`/api/queues/${queue.id}`).expect(404);
    await other.browser.get(`/api/tokens/${token.id}`).expect(404);
  });

  it("allocates unique sequential tokens concurrently and allows only one current service claim", async () => {
    const manager = await register("concurrent@example.test");
    const queue = await createQueue(manager);
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        manager.browser
          .post(`/api/queues/${queue.id}/tokens`)
          .set("x-csrf-token", manager.csrfToken)
          .send({ personName: `Visitor ${index + 1}`, phone: index === 0 ? "+15550101234" : "" }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201, 201]);
    const allocated = responses
      .map((response) => response.body.data as TokenData)
      .sort((a, b) => a.tokenNumber - b.tokenNumber);
    expect(allocated.map((token) => token.tokenNumber)).toEqual([1, 2, 3, 4, 5]);
    const waitingResponse = await manager.browser
      .get(`/api/queues/${queue.id}/tokens?status=waiting&limit=10`)
      .expect(200);
    expect(waitingResponse.body.data.items.map((token: TokenData) => token.position)).toEqual([
      0, 1, 2, 3, 4,
    ]);

    const claims = await Promise.all(
      [0, 1].map(() =>
        manager.browser
          .post(`/api/queues/${queue.id}/call-next`)
          .set("x-csrf-token", manager.csrfToken)
          .send({}),
      ),
    );
    expect(claims.map((response) => response.status).sort()).toEqual([200, 409]);
    const claimed = claims.find((response) => response.status === 200)!.body.data
      .token as TokenData;
    expect(claimed.status).toBe("serving");
    expect(claimed).toHaveProperty("serviceStartedAt");

    await manager.browser
      .patch(`/api/tokens/${claimed.id}/complete`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);
    const afterCompletion = await manager.browser
      .post(`/api/queues/${queue.id}/call-next`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);
    const next = afterCompletion.body.data.token as TokenData;
    expect(next.tokenNumber).not.toBe(claimed.tokenNumber);
    const cancelled = allocated.find((token) => token.tokenNumber === 5)!;
    await manager.browser
      .patch(`/api/tokens/${cancelled.id}/cancel`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);

    const history = await manager.browser
      .get(`/api/queues/${queue.id}/tokens?status=all&search=visitor%201&limit=10`)
      .expect(200);
    expect(history.body.data.items).toHaveLength(1);
    expect(history.body.data.items[0]).toHaveProperty("phone", "+15550101234");
    const publicDisplay = await request(app)
      .get(`/api/public/queues/${queue.publicId}`)
      .expect(200);
    expect(publicDisplay.body.data.current.tokenNumber).toBe(next.tokenNumber);
    expect(JSON.stringify(publicDisplay.body.data)).not.toContain("+15550101234");
    expect(JSON.stringify(publicDisplay.body.data)).not.toContain("Visitor 1");
    expect(publicDisplay.body.data.queue).not.toHaveProperty("description");
  });

  it("authenticates Socket.IO managers, rejects guests and isolates owner/public event rooms", async () => {
    const owner = await register("socket-owner@example.test");
    const otherManager = await register("socket-other@example.test");
    const queue = await createQueue(owner, "Private desk");
    const [managerSocket, otherSocket, publicSocket] = await Promise.all([
      openSocket({ extraHeaders: { Cookie: owner.sessionCookie } }),
      openSocket({ extraHeaders: { Cookie: otherManager.sessionCookie } }),
      openSocket({ auth: { publicId: queue.publicId } }),
    ]);
    const anonymousSocket = socketClient(socketUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: false,
      autoConnect: false,
    });
    const socketError = new Promise<Error>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Unauthenticated socket was not rejected")),
        5_000,
      );
      anonymousSocket.once("connect_error", (error) => {
        clearTimeout(timer);
        resolve(error);
      });
      anonymousSocket.once("connect", () => {
        clearTimeout(timer);
        reject(new Error("Unauthenticated socket connected"));
      });
    });
    anonymousSocket.connect();
    expect((await socketError).message).toBe("Unauthorized");
    anonymousSocket.disconnect();

    let foreignQueueEvents = 0;
    otherSocket.on("queue:updated", () => {
      foreignQueueEvents += 1;
    });
    otherSocket.emit("queue:join", queue.id);
    managerSocket.emit("queue:join", queue.id);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const ownerEvent = socketEvent<{ waiting: number; queue: { id: string }; current: unknown }>(
      managerSocket,
      "queue:updated",
    );
    const publicEvent = socketEvent<Record<string, unknown>>(publicSocket, "queue:updated");
    try {
      await owner.browser
        .post(`/api/queues/${queue.id}/tokens`)
        .set("x-csrf-token", owner.csrfToken)
        .send({ personName: "Socket-private visitor", phone: "+15550109999" })
        .expect(201);
      const [managerPayload, publicPayload] = await Promise.all([ownerEvent, publicEvent]);
      expect(managerPayload).toMatchObject({ queue: { id: queue.id }, waiting: 1, current: null });
      expect(JSON.stringify(publicPayload)).not.toContain("Socket-private visitor");
      expect(JSON.stringify(publicPayload)).not.toContain("+15550109999");
      expect(JSON.stringify(publicPayload)).not.toContain("Integration test queue");
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(foreignQueueEvents).toBe(0);
    } finally {
      managerSocket.disconnect();
      otherSocket.disconnect();
      publicSocket.disconnect();
      anonymousSocket.disconnect();
    }
  });

  it("derives overview, trends, peak arrivals and queue performance from lifecycle records", async () => {
    const manager = await register("analytics@example.test");
    const queue = await createQueue(manager);
    const first = await addToken(manager, queue.id, "Analytics visitor 1");
    const second = await addToken(manager, queue.id, "Analytics visitor 2");
    await manager.browser
      .post(`/api/queues/${queue.id}/call-next`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);
    await manager.browser
      .patch(`/api/tokens/${first.id}/complete`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);
    await manager.browser
      .patch(`/api/tokens/${second.id}/cancel`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);
    const range = await todayRange();
    const overview = await manager.browser.get(`/api/analytics/overview?${range}`).expect(200);
    expect(overview.body.data).toMatchObject({
      queues: 1,
      totalTokens: 2,
      waiting: 0,
      serving: 0,
      completed: 1,
      cancelled: 1,
      activeQueues: 1,
    });
    expect(overview.body.data.averageWaitMs).toBeGreaterThanOrEqual(0);
    expect(overview.body.data.averageServiceMs).toBeGreaterThanOrEqual(0);
    const trends = await manager.browser.get(`/api/analytics/trends?days=7&${range}`).expect(200);
    expect(
      trends.body.data.some(
        (day: { total: number; completed: number; cancelled: number }) =>
          day.total === 2 && day.completed === 1 && day.cancelled === 1,
      ),
    ).toBe(true);
    expect(trends.body.data.some((day: { queueLength: number }) => day.queueLength === 0)).toBe(
      true,
    );
    const peak = await manager.browser.get(`/api/analytics/peak-hours?${range}`).expect(200);
    expect(peak.body.data).toHaveLength(24);
    expect(
      peak.body.data.reduce((sum: number, hour: { count: number }) => sum + hour.count, 0),
    ).toBe(2);
    const performance = await manager.browser
      .get(`/api/analytics/queues/${queue.id}?${range}`)
      .expect(200);
    expect(performance.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: "completed", count: 1 }),
        expect.objectContaining({ _id: "cancelled", count: 1 }),
      ]),
    );
  });

  it("paginates and reorders waiting tokens across the 100-row boundary", async () => {
    const manager = await register("pagination@example.test");
    const queue = await createQueue(manager);
    const { Queue, Token } = await import("../src/models");
    const createdAt = new Date("2026-11-12T12:00:00.000Z");
    await Token.insertMany(
      Array.from({ length: 101 }, (_, index) => ({
        queueId: queue.id,
        tokenNumber: index + 1,
        personName: `Pagination visitor ${index + 1}`,
        status: "waiting",
        position: index,
        createdAt: new Date(createdAt.getTime() + index),
        updatedAt: new Date(createdAt.getTime() + index),
      })),
    );
    await Queue.updateOne({ _id: queue.id }, { $set: { tokenCounter: 101 } });

    const secondPage = await manager.browser
      .get(`/api/queues/${queue.id}/tokens?status=waiting&limit=100&page=2`)
      .expect(200);
    expect(secondPage.body.data).toMatchObject({ total: 101, page: 2, limit: 100 });
    expect(secondPage.body.data.items).toHaveLength(1);
    const lastToken = secondPage.body.data.items[0] as TokenData;
    expect(lastToken.position).toBe(100);

    const moved = await manager.browser
      .patch(`/api/tokens/${lastToken.id}/reorder`)
      .set("x-csrf-token", manager.csrfToken)
      .send({ position: 99 })
      .expect(200);
    expect(moved.body.data.position).toBe(99);
    const refreshedPage = await manager.browser
      .get(`/api/queues/${queue.id}/tokens?status=waiting&limit=100&page=2`)
      .expect(200);
    expect(refreshedPage.body.data.items[0].tokenNumber).toBe(100);
    expect(refreshedPage.body.data.items[0].position).toBe(100);
  });

  it("groups selected local calendar days, wait series and peak hours in the requested timezone", async () => {
    const manager = await register("timezone@example.test");
    const queue = await createQueue(manager);
    const { Queue, Token } = await import("../src/models");
    const createdTimes = [
      new Date("2026-11-13T00:30:00.000Z"),
      new Date("2026-11-13T07:30:00.000Z"),
    ];
    await Token.insertMany(
      createdTimes.map((created, index) => ({
        queueId: queue.id,
        tokenNumber: index + 1,
        personName: `Timezone visitor ${index + 1}`,
        status: "completed",
        position: -1,
        createdAt: created,
        calledAt: new Date(created.getTime() + 4 * 60_000),
        serviceStartedAt: new Date(created.getTime() + 5 * 60_000),
        completedAt: new Date(created.getTime() + 10 * 60_000),
        updatedAt: new Date(created.getTime() + 10 * 60_000),
      })),
    );
    await Queue.updateOne({ _id: queue.id }, { $set: { tokenCounter: 2 } });
    const range = new URLSearchParams({
      from: "2026-11-12T08:00:00.000Z",
      to: "2026-11-13T07:59:59.999Z",
      timezone: "America/Los_Angeles",
    }).toString();

    const trends = await manager.browser.get(`/api/analytics/trends?days=1&${range}`).expect(200);
    expect(trends.body.data).toHaveLength(1);
    expect(trends.body.data[0]).toMatchObject({ _id: "2026-11-12", total: 2, completed: 2 });
    const waits = await manager.browser.get(`/api/analytics/wait-times?${range}`).expect(200);
    expect(waits.body.data).toHaveLength(1);
    expect(waits.body.data[0]).toMatchObject({ _id: "2026-11-12", samples: 2 });
    const peaks = await manager.browser.get(`/api/analytics/peak-hours?${range}`).expect(200);
    expect(peaks.body.data.find((hour: { hour: number }) => hour.hour === 16)?.count).toBe(1);
    expect(peaks.body.data.find((hour: { hour: number }) => hour.hour === 23)?.count).toBe(1);
  });

  it("repairs interrupted waiting positions and stale service pointers on retry", async () => {
    const manager = await register("recovery@example.test");
    const queue = await createQueue(manager);
    const first = await addToken(manager, queue.id, "Recovery visitor 1");
    await addToken(manager, queue.id, "Recovery visitor 2");
    const { Queue, Token } = await import("../src/models");
    await Token.updateMany(
      { queueId: queue.id, status: "waiting" },
      { $inc: { position: 10_000 } },
    );
    await Queue.updateOne({ _id: queue.id }, { $set: { servingTokenId: first.id } });

    const recoveredFirst = await manager.browser
      .post(`/api/queues/${queue.id}/call-next`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);
    expect(recoveredFirst.body.data.token).toMatchObject({ tokenNumber: 1, status: "serving" });
    await manager.browser
      .patch(`/api/tokens/${first.id}/complete`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);

    await Queue.updateOne({ _id: queue.id }, { $set: { servingTokenId: first.id } });
    const recoveredSecond = await manager.browser
      .post(`/api/queues/${queue.id}/call-next`)
      .set("x-csrf-token", manager.csrfToken)
      .send({})
      .expect(200);
    expect(recoveredSecond.body.data.token).toMatchObject({ tokenNumber: 2, status: "serving" });
  });
});
