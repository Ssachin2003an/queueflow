import { describe, expect, it } from "vitest";
import { loginSchema, personSchema, queueSchema, registerSchema } from "@queueflow/shared";

describe("QueueFlow form validation", () => {
  it("requires a valid manager email and a non-empty password", () => {
    expect(
      loginSchema.safeParse({ email: "manager@example.com", password: "safepassword" }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ email: "not-an-email", password: "" }).success).toBe(false);
  });

  it("requires a manager name and secure-length password for registration", () => {
    expect(
      registerSchema.safeParse({
        name: "Sam Rivera",
        email: "sam@example.com",
        password: "safe-pass-2026",
      }).success,
    ).toBe(true);
    expect(registerSchema.safeParse({ name: "S", email: "bad", password: "short" }).success).toBe(
      false,
    );
  });

  it("validates queue names and accepts an optional bounded description", () => {
    expect(
      queueSchema.safeParse({ name: "Customer support", description: "Walk-in help" }).success,
    ).toBe(true);
    expect(queueSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("requires a person's name and permits an optional phone number", () => {
    expect(
      personSchema.safeParse({ personName: "Jordan Lee", phone: "+1 555 010 0123" }).success,
    ).toBe(true);
    expect(personSchema.safeParse({ personName: "" }).success).toBe(false);
  });
});
