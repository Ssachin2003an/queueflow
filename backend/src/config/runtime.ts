import "dotenv/config";
import mongoose from "mongoose";
import { Activity, Manager, Queue, Token } from "../models";
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  JWT_SECRET: z.string().min(32).optional(),
  COOKIE_SECURE: z.enum(["true", "false"]).default("true"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  COOKIE_SECRET: z.string().min(32).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);

export async function connectDatabase() {
  if (!env.MONGODB_URI)
    throw new Error("MONGODB_URI must be configured before connecting to MongoDB");
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    maxPoolSize: 20,
    autoIndex: env.NODE_ENV !== "production",
  });
  await Promise.all([
    Manager.createIndexes(),
    Queue.createIndexes(),
    Token.createIndexes(),
    Activity.createIndexes(),
  ]);
}
