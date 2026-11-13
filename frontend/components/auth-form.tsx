"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@queueflow/shared";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FlowMark, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const auth = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const form = isRegister ? registerForm : loginForm;
  const emailRegistration = isRegister
    ? registerForm.register("email")
    : loginForm.register("email");
  const passwordRegistration = isRegister
    ? registerForm.register("password")
    : loginForm.register("password");
  const busy = form.formState.isSubmitting;

  const onSubmit = async (input: LoginInput | RegisterInput) => {
    try {
      if (isRegister) await auth.register(input as RegisterInput);
      else await auth.login(input as LoginInput);
      toast.success(isRegister ? "Workspace created" : "You’re signed in", {
        description: "Your queue desk is ready.",
      });
      router.push("/dashboard");
    } catch (error) {
      toast.error(isRegister ? "Could not create account" : "Could not sign in", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const fieldError = (name: "name" | "email" | "password") =>
    (form.formState.errors as Record<string, { message?: string } | undefined>)[name]?.message;

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[.92fr_1.08fr]">
        <section className="relative flex min-h-[710px] flex-col px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
          <div className="flex items-center justify-between">
            <Wordmark href="/" />
            <div className="flex items-center gap-2">
              <ThemeToggle
                showLabel
                className="border border-line bg-surface/70 hover:bg-surface-soft"
              />
              <Button asChild variant="ghost" size="sm">
                <Link href="/">
                  <ArrowLeft size={14} />
                  <span className="sm:hidden">Home</span>
                  <span className="hidden sm:inline">Back to home</span>
                </Link>
              </Button>
            </div>
          </div>
          <div className="mx-auto my-auto w-full max-w-[410px] py-14">
            <div className="mb-7 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface shadow-sm">
              <FlowMark size={32} />
            </div>
            <p className="eyebrow">
              {isRegister ? "Your service starts here" : "Manager workspace"}
            </p>
            <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-[-.06em] text-ink">
              {isRegister ? "Create your workspace" : "Good to see you again"}
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              {isRegister
                ? "Set up your manager account and bring your first line into focus."
                : "Sign in to see the latest movement across your queues."}
            </p>

            <form className="mt-8 space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {isRegister && (
                <div>
                  <Label htmlFor="name">
                    Full name <span className="text-danger">*</span>
                  </Label>
                  <div className="relative">
                    <UserRound
                      size={15}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <Input
                      id="name"
                      autoComplete="name"
                      placeholder="e.g. Alex Morgan"
                      className="pl-10"
                      invalid={Boolean(fieldError("name"))}
                      {...registerForm.register("name")}
                    />
                  </div>
                  {fieldError("name") && (
                    <p className="mt-1.5 text-[11px] text-danger">{fieldError("name")}</p>
                  )}
                </div>
              )}
              <div>
                <Label htmlFor="email">
                  Work email <span className="text-danger">*</span>
                </Label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="pl-10"
                    invalid={Boolean(fieldError("email"))}
                    {...emailRegistration}
                  />
                </div>
                {fieldError("email") && (
                  <p className="mt-1.5 text-[11px] text-danger">{fieldError("email")}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">
                  Password <span className="text-danger">*</span>
                </Label>
                <div className="relative">
                  <LockKeyhole
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    placeholder={isRegister ? "At least 10 characters" : "Enter your password"}
                    className="pl-10 pr-11"
                    invalid={Boolean(fieldError("password"))}
                    {...passwordRegistration}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {fieldError("password") && (
                  <p className="mt-1.5 text-[11px] text-danger">{fieldError("password")}</p>
                )}
                {isRegister && (
                  <p className="mt-1.5 text-[10px] text-muted">
                    Use at least 10 characters. Your password is stored as a secure hash.
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
                {busy ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {isRegister ? "Creating workspace…" : "Signing in…"}
                  </>
                ) : (
                  <>
                    {isRegister ? "Create account" : "Sign in"}
                    <ArrowRight size={15} />
                  </>
                )}
              </Button>
            </form>
            <p className="mt-6 text-center text-[12px] text-muted">
              {isRegister ? "Already have an account?" : "New to QueueFlow?"}{" "}
              <Link
                href={isRegister ? "/login" : "/register"}
                className="font-semibold text-accent-strong hover:underline"
              >
                {isRegister ? "Sign in" : "Create a workspace"}
              </Link>
            </p>
            <p className="mt-8 text-center text-[10px] leading-5 text-muted">
              By continuing, you agree to keep your manager credentials private and use queue data
              responsibly.
            </p>
          </div>
          <p className="text-[10px] text-muted">
            © {new Date().getFullYear()} QueueFlow · Clear queues, calmer days.
          </p>
        </section>

        <aside className="relative hidden overflow-hidden bg-[#14201c] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute -right-48 -top-52 size-[570px] rounded-full border border-white/[.08]" />
          <div className="absolute -right-28 -top-32 size-[410px] rounded-full border border-white/[.08]" />
          <div className="absolute bottom-[-190px] left-[-100px] size-[490px] rounded-full bg-accent/10 blur-[80px]" />
          <div className="relative z-10 flex items-center gap-3">
            <FlowMark size={34} />
            <span className="text-sm font-medium text-white/80">A clearer line, in real time.</span>
          </div>
          <div className="relative z-10 mx-auto w-full max-w-[540px]">
            <p className="eyebrow text-white/45">QueueFlow / operating principle</p>
            <h2 className="mt-5 text-[42px] font-semibold leading-[1.04] tracking-[-.06em] xl:text-[52px]">
              Every person has a place.
              <br />
              <span className="text-[#78e2c4]">Every moment has a next step.</span>
            </h2>
            <p className="mt-5 max-w-[400px] text-[13px] leading-7 text-white/60">
              A quiet, reliable queue desk for the teams who make a visit feel easy.
            </p>
            <div className="mt-10 rounded-[20px] border border-white/10 bg-white/[.055] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-white/45">The service rhythm</span>
                <span className="font-mono-ui text-[9px] text-white/35">01 — 03</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { n: "01", label: "Join the line", icon: "↳" },
                  { n: "02", label: "Know your place", icon: "≋" },
                  { n: "03", label: "Move into service", icon: "→" },
                ].map((item, index) => (
                  <div
                    key={item.n}
                    className="rounded-[13px] border border-white/10 bg-black/10 p-3"
                  >
                    <span
                      className={`font-mono-ui text-[9px] ${index === 2 ? "text-[#78e2c4]" : "text-white/40"}`}
                    >
                      {item.n}
                    </span>
                    <p className="mt-3 text-xl text-[#78e2c4]">{item.icon}</p>
                    <p className="mt-1 text-[9px] leading-4 text-white/60">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between text-[9px] text-white/40">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#78e2c4]" /> One organized flow.
            </span>
            <span>Built for thoughtful service teams</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
