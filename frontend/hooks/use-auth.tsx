"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Manager, LoginInput, RegisterInput } from "@queueflow/shared";
import { api } from "@/lib/api";

type AuthState = {
  manager: Manager | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<Manager>;
  register: (input: RegisterInput) => Promise<Manager>;
  logout: () => Promise<void>;
  refresh: () => Promise<Manager | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ manager: Manager }>("/auth/me");
      setManager(result.manager);
      return result.manager;
    } catch {
      setManager(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const result = await api<{ manager: Manager }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setManager(result.manager);
    return result.manager;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await api<{ manager: Manager }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setManager(result.manager);
    return result.manager;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setManager(null);
    }
  }, []);

  const value = useMemo(
    () => ({ manager, loading, login, register, logout, refresh }),
    [manager, loading, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
