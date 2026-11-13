import mongoose, { Schema, Types } from "mongoose";

export type QueueStatus = "active" | "paused" | "closed";
export type TokenStatus = "waiting" | "called" | "serving" | "completed" | "cancelled";

const managerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true, versionKey: false },
);

const queueSchema = new Schema(
  {
    managerId: { type: Schema.Types.ObjectId, ref: "Manager", required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 240, default: "" },
    publicId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["active", "paused", "closed"],
      default: "active",
      required: true,
    },
    tokenCounter: { type: Number, default: 0, min: 0 },
    servingTokenId: { type: Schema.Types.ObjectId, ref: "Token", default: null },
    reorderLeaseId: { type: String, default: null },
    reorderLeaseUntil: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
queueSchema.index({ managerId: 1, createdAt: -1 });
queueSchema.index({ managerId: 1, status: 1 });

const tokenSchema = new Schema(
  {
    queueId: { type: Schema.Types.ObjectId, ref: "Queue", required: true, index: true },
    tokenNumber: { type: Number, required: true, min: 1 },
    personName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 24, select: false },
    status: {
      type: String,
      enum: ["waiting", "called", "serving", "completed", "cancelled"],
      default: "waiting",
      required: true,
    },
    position: { type: Number, default: 0, min: -1 },
    createdAt: { type: Date, default: Date.now },
    calledAt: Date,
    serviceStartedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true, versionKey: false },
);
tokenSchema.index({ queueId: 1, tokenNumber: 1 }, { unique: true });
tokenSchema.index(
  { queueId: 1, position: 1 },
  { unique: true, partialFilterExpression: { status: "waiting" } },
);
tokenSchema.index({ queueId: 1, status: 1, position: 1, createdAt: -1 });
tokenSchema.index({ queueId: 1, serviceStartedAt: -1 });
tokenSchema.index({ queueId: 1, completedAt: -1 });
tokenSchema.index({ queueId: 1, cancelledAt: -1 });

const activitySchema = new Schema(
  {
    managerId: { type: Schema.Types.ObjectId, ref: "Manager", required: true, index: true },
    queueId: { type: Schema.Types.ObjectId, ref: "Queue", required: true, index: true },
    tokenId: { type: Schema.Types.ObjectId, ref: "Token" },
    action: {
      type: String,
      required: true,
      enum: [
        "queue.created",
        "queue.updated",
        "queue.status",
        "queue.deleted",
        "token.added",
        "token.reordered",
        "token.called",
        "token.completed",
        "token.cancelled",
      ],
    },
    description: { type: String, required: true, maxlength: 300 },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false },
);
activitySchema.index({ managerId: 1, occurredAt: -1 });
activitySchema.index({ queueId: 1, occurredAt: -1 });

export const Manager = mongoose.models.Manager || mongoose.model("Manager", managerSchema);
export const Queue = mongoose.models.Queue || mongoose.model("Queue", queueSchema);
export const Token = mongoose.models.Token || mongoose.model("Token", tokenSchema);
export const Activity = mongoose.models.Activity || mongoose.model("Activity", activitySchema);
export type Id = Types.ObjectId;
