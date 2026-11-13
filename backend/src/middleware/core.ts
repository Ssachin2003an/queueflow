import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/runtime";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const asyncRoute =
  (handler: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);

export const validate =
  (schema: z.ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!parsed.success)
      return next(new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; ")));
    req.body = (parsed.data as { body: unknown }).body;
    return next();
  };

declare global {
  namespace Express {
    interface Request {
      managerId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!env.JWT_SECRET) throw new HttpError(503, "JWT_SECRET must be configured");
    const token = req.cookies?.queueflow_session;
    if (!token) throw new HttpError(401, "Authentication required");
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") throw new HttpError(401, "Invalid session");
    req.managerId = payload.sub;
    return next();
  } catch (error) {
    return next(error instanceof HttpError ? error : new HttpError(401, "Invalid session"));
  }
}

const wrap = <T extends z.ZodTypeAny>(body: T) =>
  z.object({ body, query: z.any(), params: z.any() });
const email = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(72, "Password must be no more than 72 characters");

export const registerInput = wrap(
  z
    .object({
      name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
      email,
      password,
    })
    .strict(),
);
export const loginInput = wrap(
  z.object({ email, password: z.string().min(1, "Enter your password").max(72) }).strict(),
);
export const queueInput = wrap(
  z
    .object({
      name: z.string().trim().min(2, "Queue name must be at least 2 characters").max(80),
      description: z.string().trim().max(240).optional().or(z.literal("")),
    })
    .strict(),
);
export const tokenInput = wrap(
  z
    .object({
      personName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
      phone: z.string().trim().max(24).optional().or(z.literal("")),
    })
    .strict(),
);
