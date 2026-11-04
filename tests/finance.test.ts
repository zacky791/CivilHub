import { describe, expect, it } from "vitest";
import {
  cents,
  dateLabel,
  financials,
  formatMoneyInput,
  jobExpense,
} from "../client/src/lib/finance";
import { seedWorkspace } from "../client/src/services/seed";
describe("exact money calculations", () => {
  it("parses decimals as integer sen without floating point arithmetic", () => {
    expect(cents("0.10") + cents("0.20")).toBe(30);
    expect(cents("25,000.05")).toBe(2500005);
    expect(cents("1.5")).toBe(150);
  });
  it.each([
    "-1",
    "1.001",
    "abc",
    "Infinity",
    "1e3",
    "",
    "999999999999999999999",
  ])("rejects invalid money %s", (v) => expect(() => cents(v)).toThrow());
  it("separates gross job balance from net profit", () => {
    const w = seedWorkspace(),
      f = financials(w.jobs, w.expenses, w.overheads);
    expect(f.revenue).toBe(w.jobs.reduce((s, j) => s + j.price, 0));
    expect(f.gross).toBe(f.revenue - f.direct);
    expect(f.net).toBe(f.gross - f.overhead);
  });
  it("restricts direct expenses to the selected jobs", () => {
    const w = seedWorkspace(),
      job = w.jobs[0];
    const f = financials([job], w.expenses, []);
    expect(f.direct).toBe(jobExpense(job.id, w.expenses));
    expect(f.revenue).toBe(job.price);
  });
  it("counts shared overhead once", () => {
    const w = seedWorkspace(),
      shared = w.overheads.filter((o) => o.companyId === "shared");
    expect(financials(w.jobs, [], shared).overhead).toBe(
      shared.reduce((s, o) => s + o.amount, 0),
    );
  });
  it("supports a negative remaining balance", () => {
    const w = seedWorkspace(),
      job = w.jobs[0],
      expense = { ...w.expenses[0], amount: job.price + 100 };
    expect(financials([job], [expense], []).gross).toBe(-100);
  });
  it("formats Malaysian dates without timezone rollover", () =>
    expect(dateLabel("2026-11-03")).toBe("03/11/2026"));
});


describe("money input grouping", () => {
  it.each([
    ["", ""], ["123", "123"], ["1437", "1,437"],
    ["65768", "65,768"], ["1234567", "1,234,567"],
    ["999999999.99", "999,999,999.99"], ["0", "0"],
    ["0.05", "0.05"], ["1437.50", "1,437.50"],
    ["1437.", "1,437."], [".5", "0.5"],
    ["1,234.50", "1,234.50"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatMoneyInput(input)).toBe(expected);
  });
  it.each(["-12", "1e3", "abc", "1.2.3"])("keeps invalid input %s visible for validation", (input) => {
    expect(formatMoneyInput(input)).toBe(input);
    expect(() => cents(formatMoneyInput(input))).toThrow();
  });
  it("does not round excess decimals or oversized amounts into valid prices", () => {
    expect(() => cents(formatMoneyInput("1234.567"))).toThrow();
    expect(() => cents(formatMoneyInput("1000000000"))).toThrow();
    expect(cents(formatMoneyInput("65768.09"))).toBe(6576809);
  });
});
