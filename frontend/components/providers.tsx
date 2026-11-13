"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        <Toaster
          position="bottom-right"
          closeButton
          richColors
          toastOptions={{
            style: {
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
