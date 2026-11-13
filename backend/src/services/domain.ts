import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { z } from "zod";
import { Activity, Manager, Queue, Token } from "../models";
import { env } from "../config/runtime";
import { HttpError } from "../middleware/core";

const objectId = (value: string) => {
  if (!Types.ObjectId.isValid(value) || String(new Types.ObjectId(value)) !== value)
    throw new HttpError(400, "Invalid ID");
  return new Types.ObjectId(value);
};

function pageArgs(query: Record<string, unknown>, defaultLimit: number) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? defaultLimit);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1_000_000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new HttpError(400, "Invalid pagination");
  return { page, limit, skip: (page - 1) * limit };
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function dateBounds(from?: Date, to?: Date, field = "createdAt") {
  if (
    (from && Number.isNaN(from.getTime())) ||
    (to && Number.isNaN(to.getTime())) ||
    (from && to && from > to)
  )
    throw new HttpError(400, "Invalid date range");
  return from || to
    ? { [field]: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } }
    : {};
}

async function assertQueue(id: string, managerId: string) {
  const queue = await Queue.findOne({ _id: objectId(id), managerId: objectId(managerId) });
  if (!queue) throw new HttpError(404, "Queue not found");
  return queue;
}

async function assertToken(id: string, managerId: string) {
  const token = await Token.findById(objectId(id)).select("+phone");
  if (!token) throw new HttpError(404, "Token not found");
  const queue = await Queue.findOne({ _id: token.queueId, managerId: objectId(managerId) });
  if (!queue) throw new HttpError(404, "Token not found");
  return { token, queue };
}

function logActivity(
  managerId: unknown,
  queueId: unknown,
  action: string,
  description: string,
  tokenId?: unknown,
) {
  return Activity.create({
    managerId,
    queueId,
    ...(tokenId ? { tokenId } : {}),
    action,
    description,
  });
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withQueueLease<T>(
  queueId: Types.ObjectId,
  managerId: string,
  operation: (leaseId: string) => Promise<T>,
): Promise<T> {
  const leaseId = randomUUID();
  const deadline = Date.now() + 6_000;
  let acquired = false;
  while (Date.now() < deadline) {
    const queue = await Queue.findOneAndUpdate(
      {
        _id: queueId,
        managerId: objectId(managerId),
        $or: [
          { reorderLeaseUntil: null },
          { reorderLeaseUntil: { $exists: false } },
          { reorderLeaseUntil: { $lt: new Date() } },
        ],
      },
      { $set: { reorderLeaseId: leaseId, reorderLeaseUntil: new Date(Date.now() + 30_000) } },
      { new: true },
    );
    if (queue) {
      acquired = true;
      break;
    }
    if (!(await Queue.exists({ _id: queueId, managerId: objectId(managerId) })))
      throw new HttpError(404, "Queue not found");
    await delay(35 + Math.floor(Math.random() * 20));
  }
  if (!acquired) throw new HttpError(409, "Queue is busy. Please retry shortly.");
  try {
    await repairWaitingPositions(queueId);
    return await operation(leaseId);
  } finally {
    await Queue.updateOne(
      { _id: queueId, managerId: objectId(managerId), reorderLeaseId: leaseId },
      { $set: { reorderLeaseId: null, reorderLeaseUntil: null } },
    );
  }
}

async function compactWaiting(queueId: Types.ObjectId) {
  const waiting = await Token.find({ queueId, status: "waiting" }).sort({
    position: 1,
    createdAt: 1,
    _id: 1,
  });
  if (!waiting.length) return;
  const highest = Math.max(0, ...waiting.map((token) => token.position ?? 0));
  const base = highest + waiting.length + 1_000;
  await Token.bulkWrite(
    waiting.map((token, index) => ({
      updateOne: {
        filter: { _id: token._id, queueId, status: "waiting" },
        update: { $set: { position: base + index } },
      },
    })),
  );
  await Token.bulkWrite(
    waiting.map((token, index) => ({
      updateOne: {
        filter: { _id: token._id, queueId, status: "waiting" },
        update: { $set: { position: index } },
      },
    })),
  );
}

async function repairWaitingPositions(queueId: Types.ObjectId) {
  const waiting = await Token.find({ queueId, status: "waiting" })
    .select("position")
    .sort({ position: 1, createdAt: 1, _id: 1 });
  if (waiting.some((token, index) => token.position !== index)) await compactWaiting(queueId);
}

const tokenCreatedFilter = (from?: Date, to?: Date) => dateBounds(from, to, "createdAt");
const tokenStartedFilter = (from?: Date, to?: Date) => dateBounds(from, to, "serviceStartedAt");
const tokenCompletedFilter = (from?: Date, to?: Date) => dateBounds(from, to, "completedAt");
const tokenCancelledFilter = (from?: Date, to?: Date) => dateBounds(from, to, "cancelledAt");

export const authService = {
  async register(input: { name: string; email: string; password: string }) {
    const data = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((value) => value.toLowerCase()),
        password: z.string().min(10).max(72),
      })
      .strict()
      .parse(input);
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
      throw new HttpError(503, "JWT_SECRET must be configured with at least 32 characters");
    const passwordHash = await bcrypt.hash(data.password, 12);
    try {
      const manager = await Manager.create({ name: data.name, email: data.email, passwordHash });
      const token = jwt.sign({}, env.JWT_SECRET, { subject: String(manager._id), expiresIn: "7d" });
      return {
        token,
        manager: { id: String(manager._id), name: manager.name, email: manager.email },
      };
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new HttpError(409, "Email already registered");
      throw error;
    }
  },
  async login(input: { email: string; password: string }) {
    const data = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((value) => value.toLowerCase()),
        password: z.string().min(1).max(72),
      })
      .strict()
      .parse(input);
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
      throw new HttpError(503, "JWT_SECRET must be configured with at least 32 characters");
    const manager = await Manager.findOne({ email: data.email }).select("+passwordHash");
    if (!manager || !(await bcrypt.compare(data.password, manager.passwordHash)))
      throw new HttpError(401, "Invalid email or password");
    const token = jwt.sign({}, env.JWT_SECRET, { subject: String(manager._id), expiresIn: "7d" });
    return {
      token,
      manager: { id: String(manager._id), name: manager.name, email: manager.email },
    };
  },
};

export const queueService = {
  async create(managerId: string, input: { name: string; description?: string }) {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(240).optional().or(z.literal("")),
      })
      .strict()
      .parse(input);
    const queue = await Queue.create({
      ...body,
      managerId: objectId(managerId),
      publicId: randomUUID().replace(/-/g, ""),
      status: "active",
    });
    await logActivity(queue.managerId, queue._id, "queue.created", `Created queue ${queue.name}`);
    return queue;
  },
  async list(managerId: string, query: Record<string, unknown>) {
    const owner = objectId(managerId);
    const { page, limit, skip } = pageArgs(query, 20);
    const filter: Record<string, unknown> = { managerId: owner };
    if (query.status && query.status !== "all") {
      if (!["active", "paused", "closed"].includes(String(query.status)))
        throw new HttpError(400, "Invalid queue status");
      filter.status = query.status;
    }
    if (typeof query.search === "string" && query.search.trim())
      filter.name = { $regex: escapeRegex(query.search.trim().slice(0, 100)), $options: "i" };
    const [queues, total] = await Promise.all([
      Queue.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Queue.countDocuments(filter),
    ]);
    const ids = queues.map((queue) => queue._id);
    const counts = ids.length
      ? await Token.aggregate([
          { $match: { queueId: { $in: ids } } },
          {
            $group: {
              _id: "$queueId",
              tokenCount: { $sum: 1 },
              waitingCount: { $sum: { $cond: [{ $eq: ["$status", "waiting"] }, 1, 0] } },
              servingCount: {
                $sum: { $cond: [{ $in: ["$status", ["called", "serving"]] }, 1, 0] },
              },
            },
          },
        ])
      : [];
    const byId = new Map(
      counts.map(
        (item: {
          _id: Types.ObjectId;
          tokenCount: number;
          waitingCount: number;
          servingCount: number;
        }) => [String(item._id), item],
      ),
    );
    const items = queues.map((queue) => {
      const count = byId.get(String(queue._id));
      return {
        ...queue,
        id: String(queue._id),
        tokenCount: count?.tokenCount ?? 0,
        waitingCount: count?.waitingCount ?? 0,
        servingCount: count?.servingCount ?? 0,
      };
    });
    return { items, total, page, limit };
  },
  get: assertQueue,
  async update(id: string, managerId: string, input: { name?: string; description?: string }) {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        description: z.string().trim().max(240).optional(),
      })
      .strict()
      .parse(input);
    const queue = await Queue.findOneAndUpdate(
      { _id: objectId(id), managerId: objectId(managerId) },
      { $set: body },
      { new: true, runValidators: true },
    );
    if (!queue) throw new HttpError(404, "Queue not found");
    await logActivity(queue.managerId, queue._id, "queue.updated", `Updated queue ${queue.name}`);
    return queue;
  },
  async status(id: string, managerId: string, status: "active" | "paused" | "closed") {
    const queue = await Queue.findOneAndUpdate(
      { _id: objectId(id), managerId: objectId(managerId) },
      { $set: { status } },
      { new: true, runValidators: true },
    );
    if (!queue) throw new HttpError(404, "Queue not found");
    await logActivity(
      queue.managerId,
      queue._id,
      "queue.status",
      `Changed queue status to ${status}`,
    );
    return queue;
  },
  async delete(id: string, managerId: string) {
    const queue = await assertQueue(id, managerId);
    await withQueueLease(queue._id, managerId, async () => {
      await Promise.all([
        Token.deleteMany({ queueId: queue._id }),
        Activity.deleteMany({ queueId: queue._id }),
        Queue.deleteOne({ _id: queue._id, managerId: objectId(managerId) }),
      ]);
    });
    return { deleted: true };
  },
};

export const tokenService = {
  async add(id: string, managerId: string, input: { personName: string; phone?: string }) {
    const body = z
      .object({
        personName: z.string().trim().min(2).max(80),
        phone: z.string().trim().max(24).optional().or(z.literal("")),
      })
      .strict()
      .parse(input);
    const queue = await assertQueue(id, managerId);
    return withQueueLease(queue._id, managerId, async () => {
      const currentQueue = await Queue.findOne({
        _id: queue._id,
        managerId: objectId(managerId),
        status: "active",
      });
      if (!currentQueue) throw new HttpError(409, "Queue is not accepting tokens");
      const incremented = await Queue.findOneAndUpdate(
        { _id: queue._id, managerId: objectId(managerId), status: "active" },
        { $inc: { tokenCounter: 1 } },
        { new: true },
      );
      if (!incremented) throw new HttpError(409, "Queue is not accepting tokens");
      const position = await Token.countDocuments({ queueId: queue._id, status: "waiting" });
      const token = await Token.create({
        ...body,
        queueId: queue._id,
        tokenNumber: incremented.tokenCounter,
        position,
        status: "waiting",
      });
      await logActivity(
        queue.managerId,
        queue._id,
        "token.added",
        `Added token Q${String(token.tokenNumber).padStart(3, "0")}`,
        token._id,
      );
      return token;
    });
  },
  async list(id: string, managerId: string, query: Record<string, unknown>) {
    const queue = await assertQueue(id, managerId);
    const { page, limit, skip } = pageArgs(query, 50);
    const filter: Record<string, unknown> = { queueId: queue._id };
    const status = typeof query.status === "string" ? query.status : undefined;
    if (status && status !== "all") {
      if (!["waiting", "called", "serving", "completed", "cancelled"].includes(status))
        throw new HttpError(400, "Invalid token status");
      filter.status = status;
    }
    if (typeof query.search === "string" && query.search.trim()) {
      const search = query.search.trim().slice(0, 100);
      const alternatives: Record<string, unknown>[] = [
        { personName: { $regex: escapeRegex(search), $options: "i" } },
      ];
      const numeric = search.match(/^Q?(\d+)$/i)?.[1];
      if (numeric) alternatives.push({ tokenNumber: Number(numeric) });
      filter.$or = alternatives;
    }
    const sort: Record<string, 1 | -1> =
      status === "waiting" ? { position: 1, createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };
    const [items, total] = await Promise.all([
      Token.find(filter).select("+phone").sort(sort).skip(skip).limit(limit),
      Token.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
  async get(id: string, managerId: string) {
    return (await assertToken(id, managerId)).token;
  },
  async reorder(id: string, managerId: string, target: number) {
    if (!Number.isInteger(target) || target < 0) throw new HttpError(400, "Invalid position");
    const { token, queue } = await assertToken(id, managerId);
    if (token.status !== "waiting")
      throw new HttpError(409, "Only waiting tokens can be reordered");
    return withQueueLease(queue._id, managerId, async () => {
      const rows = await Token.find({ queueId: queue._id, status: "waiting" }).sort({
        position: 1,
        createdAt: 1,
        _id: 1,
      });
      const old = rows.findIndex((row) => String(row._id) === String(token._id));
      if (old < 0) throw new HttpError(409, "Token is no longer waiting");
      const [picked] = rows.splice(old, 1);
      rows.splice(Math.min(target, rows.length), 0, picked);
      await compactWaiting(queue._id);
      const reordered = await Token.find({ queueId: queue._id, status: "waiting" }).sort({
        position: 1,
        createdAt: 1,
        _id: 1,
      });
      const reorderedOld = reordered.findIndex((row) => String(row._id) === String(picked._id));
      if (reorderedOld < 0) throw new HttpError(409, "Token is no longer waiting");
      reordered.splice(reorderedOld, 1);
      reordered.splice(Math.min(target, reordered.length), 0, picked);
      const highest = Math.max(0, ...reordered.map((row) => row.position ?? 0));
      const base = highest + reordered.length + 1_000;
      await Token.bulkWrite(
        reordered.map((row, index) => ({
          updateOne: {
            filter: { _id: row._id, status: "waiting" },
            update: { $set: { position: base + index } },
          },
        })),
      );
      await Token.bulkWrite(
        reordered.map((row, index) => ({
          updateOne: {
            filter: { _id: row._id, status: "waiting" },
            update: { $set: { position: index } },
          },
        })),
      );
      await logActivity(
        queue.managerId,
        queue._id,
        "token.reordered",
        `Moved token Q${String(token.tokenNumber).padStart(3, "0")} to position ${Math.min(target, reordered.length - 1) + 1}`,
        token._id,
      );
      const saved = await Token.findById(token._id).select("+phone");
      if (!saved) throw new HttpError(404, "Token not found after reordering");
      return saved;
    });
  },
  async callNext(id: string, managerId: string) {
    const queue = await assertQueue(id, managerId);
    return withQueueLease(queue._id, managerId, async (leaseId) => {
      const currentQueue = await Queue.findOne({
        _id: queue._id,
        managerId: objectId(managerId),
        status: "active",
        reorderLeaseId: leaseId,
      });
      if (!currentQueue) throw new HttpError(409, "Queue must be active to call the next person");
      if (currentQueue.servingTokenId) {
        const currentService = await Token.findOne({
          _id: currentQueue.servingTokenId,
          queueId: queue._id,
        }).select("status");
        if (currentService && ["called", "serving"].includes(currentService.status))
          throw new HttpError(409, "Complete the current service before calling another person");
        const released = await Queue.updateOne(
          {
            _id: queue._id,
            managerId: objectId(managerId),
            servingTokenId: currentQueue.servingTokenId,
            reorderLeaseId: leaseId,
          },
          { $set: { servingTokenId: null } },
        );
        if (released.modifiedCount !== 1)
          throw new HttpError(409, "Service state changed; refresh and retry");
      }
      const candidate = await Token.findOne({ queueId: queue._id, status: "waiting" }).sort({
        position: 1,
        createdAt: 1,
        _id: 1,
      });
      if (!candidate) return null;
      const claimed = await Queue.findOneAndUpdate(
        {
          _id: queue._id,
          managerId: objectId(managerId),
          status: "active",
          servingTokenId: null,
          reorderLeaseId: leaseId,
        },
        { $set: { servingTokenId: candidate._id } },
        { new: true },
      );
      if (!claimed) throw new HttpError(409, "Another manager has already claimed the next token");
      const now = new Date();
      const token = await Token.findOneAndUpdate(
        { _id: candidate._id, queueId: queue._id, status: "waiting" },
        { $set: { status: "serving", calledAt: now, serviceStartedAt: now, position: -1 } },
        { new: true },
      ).select("+phone");
      if (!token) {
        await Queue.updateOne(
          { _id: queue._id, servingTokenId: candidate._id },
          { $set: { servingTokenId: null } },
        );
        throw new HttpError(409, "The next token changed; refresh and try again");
      }
      await compactWaiting(queue._id);
      await logActivity(
        queue.managerId,
        queue._id,
        "token.called",
        `Called token Q${String(token.tokenNumber).padStart(3, "0")}`,
        token._id,
      );
      return token;
    });
  },
  async complete(id: string, managerId: string) {
    const { token, queue } = await assertToken(id, managerId);
    if (!["serving", "called"].includes(token.status))
      throw new HttpError(409, "Token is not currently being served");
    const completed = await Token.findOneAndUpdate(
      { _id: token._id, queueId: queue._id, status: { $in: ["serving", "called"] } },
      { $set: { status: "completed", completedAt: new Date(), position: -1 } },
      { new: true },
    ).select("+phone");
    if (!completed) throw new HttpError(409, "Token is no longer in service");
    await Queue.updateOne(
      { _id: queue._id, managerId: objectId(managerId), servingTokenId: token._id },
      { $set: { servingTokenId: null } },
    );
    await logActivity(
      queue.managerId,
      queue._id,
      "token.completed",
      `Completed token Q${String(token.tokenNumber).padStart(3, "0")}`,
      token._id,
    );
    return completed;
  },
  async cancel(id: string, managerId: string) {
    const { token, queue } = await assertToken(id, managerId);
    if (token.status !== "waiting")
      throw new HttpError(409, "Only waiting tokens may be cancelled");
    return withQueueLease(queue._id, managerId, async () => {
      const cancelled = await Token.findOneAndUpdate(
        { _id: token._id, queueId: queue._id, status: "waiting" },
        { $set: { status: "cancelled", cancelledAt: new Date(), position: -1 } },
        { new: true },
      ).select("+phone");
      if (!cancelled) throw new HttpError(409, "Token is no longer waiting");
      await compactWaiting(queue._id);
      await logActivity(
        queue.managerId,
        queue._id,
        "token.cancelled",
        `Cancelled token Q${String(token.tokenNumber).padStart(3, "0")}`,
        token._id,
      );
      return cancelled;
    });
  },
};

function publicToken(token: {
  _id: unknown;
  tokenNumber: number;
  status: string;
  position: number;
  createdAt: Date;
  calledAt?: Date;
  serviceStartedAt?: Date;
}) {
  return {
    id: String(token._id),
    tokenNumber: token.tokenNumber,
    status: token.status,
    position: token.position,
    createdAt: token.createdAt,
    calledAt: token.calledAt,
    serviceStartedAt: token.serviceStartedAt,
  };
}

export const publicService = {
  async display(publicId: string) {
    const queue = await Queue.findOne({ publicId }).select("name status publicId");
    if (!queue) throw new HttpError(404, "Queue not found");
    const [waitingCount, current, recent, serviceSamples] = await Promise.all([
      Token.countDocuments({ queueId: queue._id, status: "waiting" }),
      Token.findOne({ queueId: queue._id, status: { $in: ["called", "serving"] } }).sort({
        calledAt: -1,
      }),
      Token.find({
        queueId: queue._id,
        status: { $in: ["called", "serving", "completed"] },
        calledAt: { $ne: null },
      })
        .sort({ calledAt: -1 })
        .limit(5),
      Token.aggregate([
        {
          $match: {
            queueId: queue._id,
            status: "completed",
            serviceStartedAt: { $ne: null },
            completedAt: { $ne: null },
          },
        },
        { $project: { serviceMs: { $subtract: ["$completedAt", "$serviceStartedAt"] } } },
        { $match: { serviceMs: { $gte: 0 } } },
        { $group: { _id: null, averageServiceMs: { $avg: "$serviceMs" } } },
      ]),
    ]);
    const averageServiceMs = serviceSamples[0]?.averageServiceMs as number | undefined;
    const remainingMs =
      current && averageServiceMs != null
        ? Math.max(
            0,
            averageServiceMs -
              (current.serviceStartedAt
                ? Date.now() - new Date(current.serviceStartedAt).getTime()
                : 0),
          )
        : null;
    const estimatedWaitMinutes =
      waitingCount === 0 && !current
        ? 0
        : averageServiceMs == null
          ? null
          : Math.ceil(
              ((current ? (remainingMs ?? averageServiceMs) : 0) +
                waitingCount * averageServiceMs) /
                60_000,
            );
    return {
      queue: {
        id: String(queue._id),
        name: queue.name,
        status: queue.status,
        publicId: queue.publicId,
      },
      waiting: waitingCount,
      current: current ? publicToken(current) : null,
      recent: recent.map(publicToken),
      estimatedWaitMinutes,
    };
  },
};

async function ownedQueueIds(managerId: string) {
  return (await Queue.find({ managerId: objectId(managerId) }).distinct("_id")) as Types.ObjectId[];
}

async function durationStats(
  queueIds: Types.ObjectId[],
  waitFrom?: Date,
  waitTo?: Date,
  serviceFrom?: Date,
  serviceTo?: Date,
) {
  const [wait, service] = await Promise.all([
    Token.aggregate([
      {
        $match: {
          queueId: { $in: queueIds },
          serviceStartedAt: {
            $ne: null,
            ...dateBounds(waitFrom, waitTo, "serviceStartedAt")["serviceStartedAt"],
          },
        },
      },
      { $project: { durationMs: { $subtract: ["$serviceStartedAt", "$createdAt"] } } },
      { $match: { durationMs: { $gte: 0 } } },
      {
        $group: {
          _id: null,
          averageMs: { $avg: "$durationMs" },
          longestMs: { $max: "$durationMs" },
          samples: { $sum: 1 },
        },
      },
    ]),
    Token.aggregate([
      {
        $match: {
          queueId: { $in: queueIds },
          status: "completed",
          completedAt: {
            $ne: null,
            ...dateBounds(serviceFrom, serviceTo, "completedAt")["completedAt"],
          },
          serviceStartedAt: { $ne: null },
        },
      },
      { $project: { durationMs: { $subtract: ["$completedAt", "$serviceStartedAt"] } } },
      { $match: { durationMs: { $gte: 0 } } },
      { $group: { _id: null, averageMs: { $avg: "$durationMs" }, samples: { $sum: 1 } } },
    ]),
  ]);
  return { wait: wait[0], service: service[0] };
}

function activityView(row: any) {
  return {
    id: String(row._id),
    action: row.action,
    description: row.description,
    timestamp: row.occurredAt,
    occurredAt: row.occurredAt,
    queueName: row.queueId?.name,
    tokenNumber: row.tokenId?.tokenNumber,
  };
}

function calendarDateKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDateKey(key: string, offset: number) {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offset));
  return shifted.toISOString().slice(0, 10);
}

function localDayStart(key: string, timeZone: string) {
  const [year, month, day] = key.split("-").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day);
  let guess = targetWallTime;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatter.formatToParts(new Date(guess));
    const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
    const representedWallTime = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    const correction = targetWallTime - representedWallTime;
    if (correction === 0) break;
    guess += correction;
  }
  return new Date(guess);
}

function calendarDateKeys(start: Date, end: Date, timeZone: string) {
  const first = calendarDateKey(start, timeZone);
  const last = calendarDateKey(end, timeZone);
  const [firstYear, firstMonth, firstDay] = first.split("-").map(Number);
  const [lastYear, lastMonth, lastDay] = last.split("-").map(Number);
  const firstCalendarDay = Date.UTC(firstYear, firstMonth - 1, firstDay);
  const lastCalendarDay = Date.UTC(lastYear, lastMonth - 1, lastDay);
  const count = Math.floor((lastCalendarDay - firstCalendarDay) / 86_400_000) + 1;
  if (count < 1 || count > 366) throw new HttpError(400, "Analytics range is limited to 366 days");
  return Array.from({ length: count }, (_, index) =>
    new Date(firstCalendarDay + index * 86_400_000).toISOString().slice(0, 10),
  );
}

export const analyticsService = {
  async overview(managerId: string, from?: Date, to?: Date) {
    const owner = objectId(managerId);
    const queues = await Queue.find({ managerId: owner }).select("_id status").lean();
    const ids = queues.map((queue) => queue._id as Types.ObjectId);
    const [totalTokens, waiting, serving, completed, cancelled, stats, recent] = await Promise.all([
      Token.countDocuments({ queueId: { $in: ids }, ...tokenCreatedFilter(from, to) }),
      Token.countDocuments({ queueId: { $in: ids }, status: "waiting" }),
      Token.countDocuments({ queueId: { $in: ids }, status: { $in: ["called", "serving"] } }),
      Token.countDocuments({
        queueId: { $in: ids },
        status: "completed",
        ...tokenCompletedFilter(from, to),
      }),
      Token.countDocuments({
        queueId: { $in: ids },
        status: "cancelled",
        ...tokenCancelledFilter(from, to),
      }),
      durationStats(ids, from, to, from, to),
      Activity.find({ managerId: owner, ...dateBounds(from, to, "occurredAt") })
        .sort({ occurredAt: -1 })
        .limit(10)
        .populate("queueId", "name")
        .populate("tokenId", "tokenNumber"),
    ]);
    const activeQueues = queues.filter((queue) => queue.status === "active").length;
    return {
      queues: queues.length,
      activeQueues,
      totalTokens,
      waiting,
      serving,
      completed,
      cancelled,
      averageWaitMs: stats.wait?.averageMs ?? null,
      longestWaitMs: stats.wait?.longestMs ?? null,
      averageServiceMs: stats.service?.averageMs ?? null,
      waitSampleCount: stats.wait?.samples ?? 0,
      serviceSampleCount: stats.service?.samples ?? 0,
      queueUtilization: activeQueues ? waiting / activeQueues : null,
      queueUtilizationLabel: "waiting tokens per active queue",
      recentActivity: recent.map(activityView),
    };
  },
  async queue(id: string, managerId: string, from?: Date, to?: Date) {
    const queue = await assertQueue(id, managerId);
    return Token.aggregate([
      { $match: { queueId: queue._id, ...tokenCreatedFilter(from, to) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          waitSamples: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$serviceStartedAt", null] },
                    ...(from ? [{ $gte: ["$serviceStartedAt", from] }] : []),
                    ...(to ? [{ $lte: ["$serviceStartedAt", to] }] : []),
                  ],
                },
                1,
                0,
              ],
            },
          },
          avgWait: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$serviceStartedAt", null] },
                    ...(from ? [{ $gte: ["$serviceStartedAt", from] }] : []),
                    ...(to ? [{ $lte: ["$serviceStartedAt", to] }] : []),
                  ],
                },
                { $subtract: ["$serviceStartedAt", "$createdAt"] },
                null,
              ],
            },
          },
        },
      },
    ]);
  },
  async trends(managerId: string, days = 7, from?: Date, to?: Date, timeZone = "UTC") {
    const safeDays = Math.min(366, Math.max(1, Number.isFinite(days) ? days : 7));
    const end = to ?? new Date();
    const start =
      from ?? localDayStart(shiftDateKey(calendarDateKey(end, timeZone), -safeDays + 1), timeZone);
    if (start > end) throw new HttpError(400, "Invalid date range");
    const daysInRange = calendarDateKeys(start, end, timeZone);
    const ids = await ownedQueueIds(managerId);
    const [baseline, arrivals, starts, completed, cancelled] = await Promise.all([
      Token.countDocuments({
        queueId: { $in: ids },
        createdAt: { $lt: start },
        $and: [
          {
            $or: [
              { serviceStartedAt: { $exists: false } },
              { serviceStartedAt: null },
              { serviceStartedAt: { $gt: start } },
            ],
          },
          {
            $or: [
              { cancelledAt: { $exists: false } },
              { cancelledAt: null },
              { cancelledAt: { $gt: start } },
            ],
          },
        ],
      }),
      Token.aggregate([
        { $match: { queueId: { $in: ids }, ...dateBounds(start, end, "createdAt") } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: timeZone } },
            count: { $sum: 1 },
          },
        },
      ]),
      Token.aggregate([
        { $match: { queueId: { $in: ids }, ...dateBounds(start, end, "serviceStartedAt") } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$serviceStartedAt", timezone: timeZone },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Token.aggregate([
        {
          $match: {
            queueId: { $in: ids },
            status: "completed",
            ...dateBounds(start, end, "completedAt"),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$completedAt", timezone: timeZone },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Token.aggregate([
        { $match: { queueId: { $in: ids }, ...dateBounds(start, end, "cancelledAt") } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$cancelledAt", timezone: timeZone },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    const makeMap = (rows: Array<{ _id: string; count: number }>) =>
      new Map(rows.map((row) => [row._id, row.count]));
    const arrivalMap = makeMap(arrivals),
      startMap = makeMap(starts),
      completeMap = makeMap(completed),
      cancelMap = makeMap(cancelled);
    const rows: Array<{
      _id: string;
      total: number;
      completed: number;
      cancelled: number;
      queueLength: number;
    }> = [];
    let queueLength = baseline;
    for (const key of daysInRange) {
      const total = arrivalMap.get(key) ?? 0;
      const served = startMap.get(key) ?? 0;
      const cancelledCount = cancelMap.get(key) ?? 0;
      queueLength = Math.max(0, queueLength + total - served - cancelledCount);
      rows.push({
        _id: key,
        total,
        completed: completeMap.get(key) ?? 0,
        cancelled: cancelledCount,
        queueLength,
      });
    }
    return rows;
  },
  async waitTimes(managerId: string, from?: Date, to?: Date, timeZone = "UTC") {
    const ids = await ownedQueueIds(managerId);
    return Token.aggregate([
      {
        $match: {
          queueId: { $in: ids },
          serviceStartedAt: {
            $ne: null,
            ...dateBounds(from, to, "serviceStartedAt")["serviceStartedAt"],
          },
        },
      },
      {
        $project: {
          day: {
            $dateToString: { format: "%Y-%m-%d", date: "$serviceStartedAt", timezone: timeZone },
          },
          waitMs: { $subtract: ["$serviceStartedAt", "$createdAt"] },
        },
      },
      { $match: { waitMs: { $gte: 0 } } },
      { $group: { _id: "$day", averageMs: { $avg: "$waitMs" }, samples: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
  },
  async peakHours(managerId: string, from?: Date, to?: Date, timeZone = "UTC") {
    const ids = await ownedQueueIds(managerId);
    const records = await Token.aggregate([
      { $match: { queueId: { $in: ids }, ...tokenCreatedFilter(from, to) } },
      {
        $group: {
          _id: { $hour: { date: "$createdAt", timezone: timeZone } },
          count: { $sum: 1 },
        },
      },
    ]);
    const counts = new Map(
      records.map((record: { _id: number; count: number }) => [record._id, record.count]),
    );
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: counts.get(hour) ?? 0 }));
  },
};
