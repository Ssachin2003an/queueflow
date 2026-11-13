import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(10, "Use at least 10 characters").max(72),
});
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(72),
});
export const queueSchema = z.object({
  name: z.string().trim().min(2, "Queue name must be at least 2 characters").max(80),
  description: z.string().trim().max(240).optional().or(z.literal("")),
});
export const personSchema = z.object({
  personName: z.string().trim().min(2, "Enter a name").max(80),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type QueueInput = z.infer<typeof queueSchema>;
export type PersonInput = z.infer<typeof personSchema>;
export type Manager = { id: string; name: string; email: string; createdAt?: string };
export type QueueStatus = "active" | "paused" | "closed";
export type TokenStatus = "waiting" | "called" | "serving" | "completed" | "cancelled";
export type QueueSummary = {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  publicId: string;
  status: QueueStatus;
  tokenCount?: number;
  tokenCounter?: number;
  waitingCount?: number;
  servingCount?: number;
  createdAt: string;
  updatedAt?: string;
};
export type QueueToken = {
  id?: string;
  _id?: string;
  queueId: string;
  tokenNumber: string | number;
  personName: string;
  phone?: string;
  status: TokenStatus;
  position?: number;
  createdAt: string;
  calledAt?: string;
  serviceStartedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  waitingSeconds?: number | null;
};
export type ActivityItem = {
  id?: string;
  action?: string;
  description: string;
  timestamp?: string;
  occurredAt?: string;
  queueName?: string;
  tokenNumber?: string | number;
};
export type TimeSeriesPoint = {
  date: string;
  label?: string;
  waiting?: number;
  served?: number;
  cancelled?: number;
  averageWaitMinutes?: number | null;
  queueLength?: number;
};
export type AnalyticsOverview = {
  queues: number;
  totalTokens: number;
  waiting: number;
  serving: number;
  completed: number;
  cancelled: number;
  averageWaitMs: number | null;
  averageServiceMs: number | null;
  longestWaitMs: number | null;
  queueUtilization: number | null;
  recentActivity?: ActivityItem[];
};
export type ApiEnvelope<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: { code: string; message: string; details?: unknown } | string };
