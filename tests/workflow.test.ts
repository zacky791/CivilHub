import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspace, repository } from "../client/src/services/repository";
import { financials, jobExpense } from "../client/src/lib/finance";
import type { JobInput, OverheadInput } from "../client/src/lib/types";
const storage = new Map<string, string>();
const local = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => {
    storage.set(k, v);
  },
  removeItem: (k: string) => {
    storage.delete(k);
  },
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() {
    return storage.size;
  },
};
vi.stubGlobal("localStorage", local);
const input: JobInput = {
  companyId: "akar",
  workType: "Resurface",
  client: "New Client",
  price: 1500000,
  location: "Shah Alam",
  lat: 3.07,
  lng: 101.51,
  date: "2026-11-03",
  description: "Road works",
  status: "Active",
};
beforeEach(() => {
  storage.clear();
  repository.invalidate();
  repository.reset(true);
});
describe("persisted demo workflow", () => {
  it("creates a job, adds an expense and reloads consistent totals", () => {
    const job = repository.saveJob(input);
    expect(job.number).toBe("JOB-0001");
    expect(getWorkspace().clients).toContain("New Client");
    repository.saveExpense({
      jobId: job.id,
      amount: 390000,
      category: "Materials",
      description: "Materials",
      date: "2026-11-03",
    });
    repository.invalidate();
    const w = getWorkspace(),
      f = financials(w.jobs, w.expenses, []);
    expect(f.revenue).toBe(1500000);
    expect(f.direct).toBe(390000);
    expect(f.gross).toBe(1110000);
    expect(w.jobs[0].price).toBe(input.price);
  });
  it("edits and deletes expense records and restores the balance", () => {
    const job = repository.saveJob(input),
      exp = repository.saveExpense({
        jobId: job.id,
        amount: 10000,
        category: "Materials",
        description: "Materials",
        date: "2026-11-03",
      });
    repository.saveExpense({ ...exp, amount: 20000 }, exp.id);
    expect(jobExpense(job.id, getWorkspace().expenses)).toBe(20000);
    repository.deleteExpense(exp.id);
    expect(jobExpense(job.id, getWorkspace().expenses)).toBe(0);
  });
  it("deletes a job and all linked financial records", () => {
    const job = repository.saveJob(input);
    repository.saveExpense({
      jobId: job.id,
      amount: 20000,
      category: "Labour",
      description: "Crew wages",
      date: "2026-11-03",
    });
    repository.deleteJob(job.id);
    expect(getWorkspace().jobs).toHaveLength(0);
    expect(getWorkspace().expenses).toHaveLength(0);
  });
  it("rejects an expense for a missing job", () =>
    expect(() =>
      repository.saveExpense({
        jobId: "missing",
        amount: 100,
        category: "Other",
        description: "Test",
        date: "2026-11-03",
      }),
    ).toThrow("existing job"));
  it("generates unique job numbers after deletions", () => {
    const a = repository.saveJob(input);
    repository.deleteJob(a.id);
    const b = repository.saveJob(input);
    expect(b.number).toBe("JOB-0002");
  });
  it("prevents duplicate recurring costs for the same period", () => {
    const input: OverheadInput = {
      companyId: "shared",
      category: "Internet",
      description: "Broadband",
      amount: 20000,
      date: "2026-11-01",
      recurring: true,
      frequency: "monthly",
    };
    repository.saveOverhead(input);
    expect(() =>
      repository.saveOverhead({ ...input, date: "2026-11-15" }),
    ).toThrow("already");
    expect(() =>
      repository.saveOverhead({ ...input, date: "2026-12-01" }),
    ).not.toThrow();
  });
  it("does not replace the current snapshot when persistence fails", () => {
    const job = repository.saveJob(input);
    const original = local.setItem;
    local.setItem = () => {
      throw new Error("Quota exceeded");
    };
    try {
      expect(() =>
        repository.saveJob({ ...input, price: 2000000 }, job.id),
      ).toThrow("not saved");
      expect(getWorkspace().jobs[0].price).toBe(1500000);
    } finally {
      local.setItem = original;
    }
  });
  it("rejects impossible calendar dates", () =>
    expect(() =>
      repository.saveJob({ ...input, date: "2026-02-31" }),
    ).toThrow());
});
