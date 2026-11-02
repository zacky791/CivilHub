import { useSyncExternalStore } from "react";
import { jobSchema, expenseSchema, overheadSchema } from "./validation";
import type {
  Activity,
  Attachment,
  Expense,
  ExpenseInput,
  Job,
  JobInput,
  Overhead,
  OverheadInput,
  Workspace,
} from "../lib/types";
import { seedWorkspace } from "./seed";
const KEY = "civilhub:workspace:v1";
const listeners = new Set<() => void>();
let snapshot: Workspace | undefined;
export function getWorkspace(): Workspace {
  if (snapshot) return snapshot;
  const saved = localStorage.getItem(KEY);
  if (saved) {
    const parsed = JSON.parse(saved) as Workspace;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.jobs) ||
      !Array.isArray(parsed.expenses)
    )
      throw new Error(
        "The saved workspace could not be read. Export your browser storage before resetting it.",
      );
    snapshot = parsed;
  } else {
    const seed = seedWorkspace();
    localStorage.setItem(KEY, JSON.stringify(seed));
    snapshot = seed;
  }
  return snapshot;
}
function commit(next: Workspace) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      "Browser storage is full or unavailable. Your changes were not saved.",
    );
  }
  snapshot = next;
  listeners.forEach((l) => l());
}
function update(action: (draft: Workspace) => void) {
  const next = structuredClone(getWorkspace());
  action(next);
  commit(next);
}
const uid = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();
function activity(
  w: Workspace,
  kind: Activity["kind"],
  title: string,
  detail: string,
) {
  w.activities.unshift({
    id: uid(),
    kind,
    title,
    detail,
    createdAt: timestamp(),
  });
  w.activities = w.activities.slice(0, 30);
}
export function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
export function useWorkspace() {
  return useSyncExternalStore(subscribe, getWorkspace, getWorkspace);
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      snapshot = undefined;
      listeners.forEach((l) => l());
    }
  });
export const repository = {
  saveJob(input: JobInput, id?: string): Job {
    const parsed = jobSchema.parse(input);
    let saved!: Job;
    update((w) => {
      const existing = id ? w.jobs.find((j) => j.id === id) : undefined;
      if (id && !existing) throw new Error("This job no longer exists.");
      saved = {
        ...parsed,
        id: existing?.id ?? uid(),
        number:
          existing?.number ?? `JOB-${String(w.nextJob++).padStart(4, "0")}`,
        createdAt: existing?.createdAt ?? timestamp(),
        updatedAt: timestamp(),
      };
      w.jobs = existing
        ? w.jobs.map((j) => (j.id === id ? saved : j))
        : [saved, ...w.jobs];
      if (
        !w.clients.some((c) => c.toLowerCase() === parsed.client.toLowerCase())
      )
        w.clients.push(parsed.client);
      activity(
        w,
        "job",
        existing ? "Job updated" : "New job registered",
        `${saved.number} · ${saved.workType}`,
      );
    });
    return saved;
  },
  deleteJob(id: string) {
    update((w) => {
      const job = w.jobs.find((j) => j.id === id);
      if (!job) throw new Error("Job not found.");
      const ids = new Set([
        id,
        ...w.expenses.filter((e) => e.jobId === id).map((e) => e.id),
      ]);
      w.jobs = w.jobs.filter((j) => j.id !== id);
      w.expenses = w.expenses.filter((e) => e.jobId !== id);
      w.attachments = w.attachments.filter((a) => !ids.has(a.ownerId));
      activity(w, "job", "Job deleted", job.number);
    });
  },
  saveExpense(input: ExpenseInput, id?: string): Expense {
    const parsed = expenseSchema.parse(input);
    let saved!: Expense;
    update((w) => {
      if (!w.jobs.some((j) => j.id === parsed.jobId))
        throw new Error("Select an existing job.");
      const existing = id ? w.expenses.find((e) => e.id === id) : undefined;
      if (id && !existing) throw new Error("Expense not found.");
      saved = {
        ...parsed,
        id: existing?.id ?? uid(),
        createdAt: existing?.createdAt ?? timestamp(),
        updatedAt: timestamp(),
      };
      w.expenses = existing
        ? w.expenses.map((e) => (e.id === id ? saved : e))
        : [saved, ...w.expenses];
      activity(
        w,
        "expense",
        existing ? "Expense updated" : "Expense recorded",
        parsed.description,
      );
    });
    return saved;
  },
  deleteExpense(id: string) {
    update((w) => {
      w.expenses = w.expenses.filter((e) => e.id !== id);
      w.attachments = w.attachments.filter((a) => a.ownerId !== id);
    });
  },
  saveOverhead(input: OverheadInput, id?: string): Overhead {
    const parsed = overheadSchema.parse(input);
    let saved!: Overhead;
    update((w) => {
      if (
        parsed.recurring &&
        w.overheads.some(
          (o) =>
            o.id !== id &&
            o.recurring &&
            o.companyId === parsed.companyId &&
            o.category === parsed.category &&
            o.description.trim().toLowerCase() ===
              parsed.description.trim().toLowerCase() &&
            o.date.slice(0, parsed.frequency === "yearly" ? 4 : 7) ===
              parsed.date.slice(0, parsed.frequency === "yearly" ? 4 : 7),
        )
      )
        throw new Error(
          "This recurring cost has already been recorded for that period.",
        );
      const existing = id ? w.overheads.find((o) => o.id === id) : undefined;
      if (id && !existing) throw new Error("Overhead not found.");
      saved = {
        ...parsed,
        id: existing?.id ?? uid(),
        createdAt: existing?.createdAt ?? timestamp(),
        updatedAt: timestamp(),
      };
      w.overheads = existing
        ? w.overheads.map((o) => (o.id === id ? saved : o))
        : [saved, ...w.overheads];
      activity(
        w,
        "overhead",
        existing ? "Overhead updated" : "Overhead added",
        parsed.description,
      );
    });
    return saved;
  },
  deleteOverhead(id: string) {
    update((w) => {
      w.overheads = w.overheads.filter((o) => o.id !== id);
      w.attachments = w.attachments.filter((a) => a.ownerId !== id);
    });
  },
  addAttachment(a: Attachment) {
    update((w) => {
      if (
        ![...w.jobs, ...w.expenses, ...w.overheads].some(
          (r) => r.id === a.ownerId,
        )
      )
        throw new Error("Attachment record no longer exists.");
      w.attachments.push(a);
    });
  },
  deleteAttachment(id: string) {
    update((w) => {
      w.attachments = w.attachments.filter((a) => a.id !== id);
    });
  },
  reset(empty = false) {
    const next = seedWorkspace();
    if (empty) {
      next.jobs = [];
      next.expenses = [];
      next.overheads = [];
      next.attachments = [];
      next.activities = [];
      next.nextJob = 1;
      next.clients = ["Sunway"];
    }
    commit(next);
  },
  invalidate() {
    snapshot = undefined;
  },
};
