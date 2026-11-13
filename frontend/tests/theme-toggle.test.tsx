import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.remove("light");
});

describe("QueueFlow theme toggle", () => {
  it("shows the next-mode label and persists both theme changes", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle showLabel />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
    expect(screen.getByText("Dark mode").textContent).toBe("Dark mode");
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeTruthy();
    expect(screen.getByText("Light mode").textContent).toBe("Light mode");
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));

    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
