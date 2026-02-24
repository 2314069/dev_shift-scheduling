import { describe, it, expect, vi, afterEach } from "vitest";
import { getNextMonthRange, getThisMonthRange } from "@/lib/date-helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("getNextMonthRange", () => {
  it("returns next month's first and last day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 15)); // 2026-02-15

    const range = getNextMonthRange();
    expect(range.start).toBe("2026-03-01");
    expect(range.end).toBe("2026-03-31");
  });

  it("handles year boundary (December → January)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 10)); // 2026-12-10

    const range = getNextMonthRange();
    expect(range.start).toBe("2027-01-01");
    expect(range.end).toBe("2027-01-31");
  });
});

describe("getThisMonthRange", () => {
  it("returns current month's first and last day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 15)); // 2026-02-15

    const range = getThisMonthRange();
    expect(range.start).toBe("2026-02-01");
    expect(range.end).toBe("2026-02-28");
  });

  it("zero-pads single-digit months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5)); // 2026-01-05

    const range = getThisMonthRange();
    expect(range.start).toBe("2026-01-01");
    expect(range.end).toBe("2026-01-31");
  });
});
