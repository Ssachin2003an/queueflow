import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimeFilter, periodRange, type DateRange } from "@/components/time-filter";
import { analyticsQuery, trendDays, trendsQuery } from "@/lib/analytics";

describe("analytics date filters", () => {
  it("offers a one-click today preset", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeFilter value={{ period: "7d" }} onChangeAction={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 7 days/i }));
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onChange).toHaveBeenCalledTimes(1);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ period: "today" });
  });

  it("holds a valid custom date interval as a draft until Apply range", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeFilter value={{ period: "7d" }} onChangeAction={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 7 days/i }));
    await user.click(screen.getByRole("button", { name: "Custom range" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-04-02" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-04-05" } });

    expect(onChange).not.toHaveBeenCalled();
    const apply = screen.getByRole("button", { name: "Apply range" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    await user.click(apply);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      period: "custom",
      from: "2026-04-02",
      to: "2026-04-05",
    });
  });

  it("rejects a custom start date later than its end date", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeFilter value={{ period: "30d" }} onChangeAction={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 30 days/i }));
    await user.click(screen.getByRole("button", { name: "Custom range" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-04-06" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-04-05" } });

    expect(screen.getByText("Choose a start date on or before the end date.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Apply range" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("caps custom analytics at 366 calendar days before requesting trends", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeFilter value={{ period: "30d" }} onChangeAction={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 30 days/i }));
    await user.click(screen.getByRole("button", { name: "Custom range" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2027-01-01" } });

    expect(screen.getByText("Choose no more than 366 calendar days.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Apply range" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("serializes the selected local-day boundaries and limits trend history to 90 days", () => {
    const range: DateRange = { period: "custom", from: "2026-04-01", to: "2026-04-04" };
    const bounds = periodRange(range.period, range.from, range.to);
    const metrics = new URLSearchParams(analyticsQuery(range).slice(1));
    const trendParams = new URLSearchParams(trendsQuery(range).slice(1));

    expect(metrics.get("from")).toBe(bounds.from);
    expect(metrics.get("to")).toBe(bounds.to);
    expect(metrics.get("timezone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    expect(trendParams.get("from")).toBe(bounds.from);
    expect(trendParams.get("to")).toBe(bounds.to);
    expect(trendParams.get("timezone")).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    );
    expect(trendParams.get("days")).toBe("4");
    expect(trendDays({ period: "custom", from: "2026-01-01", to: "2026-12-31" })).toBe(90);
  });
});
