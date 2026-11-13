import { describe, it, expect } from "vitest";
const nextNumber = (counter: number) => counter + 1;
const reorder = <T>(items: T[], from: number, to: number) => {
  const copy = [...items];
  const [value] = copy.splice(from, 1);
  copy.splice(Math.min(to, copy.length), 0, value);
  return copy;
};
const waitMs = (created: number, started: number | null) =>
  started === null ? null : started - created;
const serviceMs = (started: number | null, completed: number | null) =>
  started === null || completed === null ? null : completed - started;
describe("QueueFlow domain invariants", () => {
  it("assigns monotonically unique per-queue numbers from atomic counter results", () => {
    const allocation = [0, 1, 2, 3].map((counter) => nextNumber(counter));
    expect(new Set(allocation).size).toBe(4);
    expect(allocation).toEqual([1, 2, 3, 4]);
  });
  it("reorders only the selected waiting collection while preserving unique contiguous positions", () => {
    const moved = reorder(["a", "b", "c", "d"], 3, 1);
    expect(moved).toEqual(["a", "d", "b", "c"]);
    expect(moved.map((_, i) => i)).toEqual([0, 1, 2, 3]);
  });
  it("calculates lifecycle durations in milliseconds", () => {
    expect(waitMs(100, 350)).toBe(250);
    expect(serviceMs(350, 900)).toBe(550);
  });
  it("represents missing duration samples as unavailable, not measured zero", () => {
    expect(waitMs(100, null)).toBeNull();
    expect(serviceMs(null, 0)).toBeNull();
    expect(waitMs(100, 100)).toBe(0);
  });
  it("applies explicit FIFO tie-breaking by stable identifier", () => {
    const values = [
      { p: 1, id: "b" },
      { p: 1, id: "a" },
    ].sort((a, b) => a.p - b.p || a.id.localeCompare(b.id));
    expect(values.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
