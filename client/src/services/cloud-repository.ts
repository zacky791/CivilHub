import type { User } from "@supabase/supabase-js";
import { companies, workTypes } from "../lib/constants";
import { cents } from "../lib/finance";
import type {
  Activity,
  Attachment,
  CompanyId,
  Expense,
  ExpenseInput,
  Job,
  JobInput,
  Overhead,
  OverheadInput,
  Workspace,
} from "../lib/types";
import { createSupabaseClient } from "./supabase";
import { expenseSchema, jobSchema, overheadSchema } from "./validation";
export interface CloudIdentity {
  userId: string;
  name: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: "admin" | "staff";
}
type Row = Record<string, any>;
const empty = (): Workspace => ({
  version: 1,
  jobs: [],
  expenses: [],
  overheads: [],
  clients: [],
  attachments: [],
  activities: [],
  nextJob: 1,
});
let snapshot = empty(),
  identity: CloudIdentity | null = null,
  generation = 0,
  refreshSequence = 0;
let companyIds = new Map<CompanyId, string>(),
  companyCodes = new Map<string, CompanyId>(),
  clientNames = new Map<string, string>();
let syncNotice = "";
const listeners = new Set<() => void>();
export const subscribeCloud = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getCloudWorkspace = () => snapshot;
export const getCloudIdentity = () => identity;
export const getSyncNotice = () => syncNotice;
function notify() {
  listeners.forEach((fn) => fn());
}
function publish(next: Workspace) {
  snapshot = { ...next, activities: activities(next) };
  notify();
}
function activities(w: Workspace): Activity[] {
  return [
    ...w.jobs.map((j) => ({
      id: j.id,
      kind: "job" as const,
      title: j.createdAt === j.updatedAt ? "Job registered" : "Job updated",
      detail: `${j.number} · ${j.workType}`,
      createdAt: j.updatedAt,
    })),
    ...w.expenses.map((e) => ({
      id: e.id,
      kind: "expense" as const,
      title: "Expense recorded",
      detail: e.description,
      createdAt: e.updatedAt,
    })),
    ...w.overheads.map((o) => ({
      id: o.id,
      kind: "overhead" as const,
      title: "Overhead recorded",
      detail: o.description,
      createdAt: o.updatedAt,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
}
export function clearCloudWorkspace() {
  generation++;
  refreshSequence++;
  identity = null;
  companyIds.clear();
  companyCodes.clear();
  clientNames.clear();
  syncNotice = "";
  publish(empty());
}
function message(error: unknown): Error {
  const e = error as { code?: string; message?: string; status?: number };
  if (e.code === "42501" || e.status === 403)
    return new Error("You do not have permission to change this workspace.");
  if (e.code === "23505")
    return new Error(
      "This record already exists. Recurring costs may only be recorded once per period.",
    );
  return new Error(
    e.message ??
      "Unable to contact Supabase. Check your connection and try again.",
  );
}
function check(error: unknown) {
  if (error) throw message(error);
}
function context(write = false) {
  if (!identity) throw new Error("Please sign in and open your workspace.");
  if (write && identity.role !== "admin")
    throw new Error("Administrator access is required to change records.");
  return {
    account: identity,
    client: createSupabaseClient(),
    token: generation,
  };
}
function stillCurrent(token: number) {
  if (token !== generation)
    throw new Error("Your session changed. Sign in again before continuing.");
}
function companyCode(id: string): CompanyId {
  const code = companyCodes.get(id);
  if (!code)
    throw new Error(
      "A company could not be matched to this workspace. Refresh the page.",
    );
  return code;
}
function jobFrom(row: Row): Job {
  return {
    id: row.id,
    number: row.job_number,
    companyId: companyCode(row.company_id),
    workType: row.work_type === "Other" ? row.custom_work_type : row.work_type,
    client: clientNames.get(row.client_id) ?? "Client",
    price: cents(String(row.price)),
    location: row.location_address,
    lat: row.latitude,
    lng: row.longitude,
    date: row.job_date,
    description: row.description ?? "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function expenseFrom(row: Row): Expense {
  return {
    id: row.id,
    jobId: row.job_id,
    description: row.description,
    category: row.category,
    amount: cents(String(row.amount)),
    date: row.expense_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function overheadFrom(row: Row): Overhead {
  return {
    id: row.id,
    companyId: row.company_id ? companyCode(row.company_id) : "shared",
    description: row.description,
    category: row.category,
    amount: cents(String(row.amount)),
    date: row.expense_date,
    recurring: row.is_recurring,
    frequency: row.recurrence_frequency ?? "monthly",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function attachmentFrom(row: Row, names: Map<string, string>): Attachment {
  return {
    id: row.id,
    ownerId: row.job_id ?? row.expense_id ?? row.overhead_id,
    name: row.original_filename,
    mime: row.mime_type,
    size: row.file_size,
    createdAt: row.created_at,
    uploader: names.get(row.uploaded_by) ?? "Workspace member",
    storagePath: row.storage_path,
  };
}
async function allRows(table: string, workspaceId: string) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createSupabaseClient()
      .from(table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("id")
      .range(offset, offset + 999);
    check(error);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
export async function initializeCloudWorkspace(
  user: User,
): Promise<CloudIdentity | null> {
  clearCloudWorkspace();
  const token = generation,
    client = createSupabaseClient();
  const { data: members, error } = await client
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1);
  check(error);
  stillCurrent(token);
  if (!members?.length) return null;
  const member = members[0];
  const [
    { data: workspace, error: workspaceError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    client
      .from("workspaces")
      .select("id,name")
      .eq("id", member.workspace_id)
      .single(),
    client.from("users").select("name,email").eq("id", user.id).maybeSingle(),
  ]);
  check(workspaceError);
  check(profileError);
  stillCurrent(token);
  identity = {
    userId: user.id,
    name:
      profile?.name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "Member",
    email: user.email ?? "",
    workspaceId: workspace!.id,
    workspaceName: workspace!.name,
    role: member.role as "admin" | "staff",
  };
  try {
    await refreshCloudWorkspace();
    stillCurrent(token);
    return identity;
  } catch (e) {
    if (token === generation) clearCloudWorkspace();
    throw e;
  }
}
export async function refreshCloudWorkspace() {
  const { account, client, token } = context();
  const sequence = ++refreshSequence;
  const [companyRows, clientRows, jobs, expenses, overheads, files] =
    await Promise.all(
      [
        "companies",
        "clients",
        "jobs",
        "job_expenses",
        "overhead_costs",
        "attachments",
      ].map((t) => allRows(t, account.workspaceId)),
    );
  stillCurrent(token);
  if (sequence !== refreshSequence) return;
  const ids = new Map<CompanyId, string>(),
    codes = new Map<string, CompanyId>();
  for (const row of companyRows) {
    if (companies.some((c) => c.id === row.code)) {
      ids.set(row.code, row.id);
      codes.set(row.id, row.code);
    }
  }
  if (ids.size !== 5)
    throw new Error(
      "The five company records are incomplete. Contact the workspace administrator.",
    );

  const uploaders = [...new Set(files.map((r) => r.uploaded_by))];
  const names = new Map<string, string>();
  if (uploaders.length) {
    for (let offset = 0; offset < uploaders.length; offset += 100) {
      const { data, error } = await client
        .from("users")
        .select("id,name")
        .in("id", uploaders.slice(offset, offset + 100));
      check(error);
      for (const row of data ?? []) names.set(row.id, row.name);
    }
  }
  stillCurrent(token);
  if (sequence !== refreshSequence) return;
  companyIds = ids;
  companyCodes = codes;
  clientNames = new Map(clientRows.map((r) => [r.id, r.name]));
  syncNotice = "";
  publish({
    version: 1,
    jobs: jobs.map(jobFrom).sort((a, b) => b.date.localeCompare(a.date)),
    expenses: expenses.map(expenseFrom),
    overheads: overheads.map(overheadFrom),
    clients: clientRows.map((r) => r.name).sort(),
    attachments: files.map((r) => attachmentFrom(r, names)),
    activities: [],
    nextJob: 1,
  });
}
function changed() {
  refreshSequence++;
  syncNotice = "";
}
async function deleteRows(table: string, id: string, ownerIds: string[]) {
  const { account, client, token } = context(true),
    files = snapshot.attachments.filter((a) =>
      table === "attachments" ? a.id === id : ownerIds.includes(a.ownerId),
    );
  const { data, error } = await client
    .from(table)
    .delete()
    .eq("workspace_id", account.workspaceId)
    .eq("id", id)
    .select("id");
  check(error);
  stillCurrent(token);
  if (!data?.length) throw new Error("This record no longer exists.");
  changed();
  const fileIds = new Set(files.map((a) => a.id));
  const next = {
    ...snapshot,
    attachments: snapshot.attachments.filter((a) => !fileIds.has(a.id)),
  };
  if (table === "jobs") {
    next.jobs = next.jobs.filter((j) => j.id !== id);
    next.expenses = next.expenses.filter((e) => e.jobId !== id);
  }
  if (table === "job_expenses")
    next.expenses = next.expenses.filter((e) => e.id !== id);
  if (table === "overhead_costs")
    next.overheads = next.overheads.filter((o) => o.id !== id);
  if (table === "attachments")
    next.attachments = next.attachments.filter((a) => a.id !== id);
  publish(next);
  const paths = files.map((f) => f.storagePath).filter((p): p is string => !!p);
  if (paths.length) {
    const { error: cleanup } = await client.storage
      .from("job-documents")
      .remove(paths);
    if (cleanup) {
      syncNotice =
        "The record was deleted, but document cleanup failed. Contact your administrator to remove the remaining stored files.";
      notify();
    }
  }
}
export const cloudRepository = {
  async saveJob(
    input: JobInput,
    id?: string,
    requestId?: string,
  ): Promise<Job> {
    const parsed = jobSchema.parse(input),
      { account, client, token } = context(true);
    const custom =
      !workTypes.includes(parsed.workType) || parsed.workType === "Other";
    const { data, error } = await client.rpc("save_construction_job", {
      target_workspace: account.workspaceId,
      existing_job: id ?? null,
      job_data: {
        id: requestId ?? crypto.randomUUID(),
        company_code: parsed.companyId,
        client: parsed.client,
        work_type: custom ? "Other" : parsed.workType,
        custom_work_type: custom ? parsed.workType : null,
        price: (parsed.price / 100).toFixed(2),
        location_address: parsed.location,
        latitude: parsed.lat,
        longitude: parsed.lng,
        job_date: parsed.date,
        description: parsed.description,
        status: parsed.status,
      },
    });
    check(error);
    stillCurrent(token);
    const row = (Array.isArray(data) ? data[0] : data) as Row;
    if (!row?.id)
      throw new Error(
        "Unable to read the saved job. Refresh the workspace before retrying.",
      );
    clientNames.set(
      row.client_id,
      clientNames.get(row.client_id) ?? parsed.client,
    );
    const saved = jobFrom(row);
    changed();
    publish({
      ...snapshot,
      jobs: [saved, ...snapshot.jobs.filter((j) => j.id !== saved.id)],
      clients: [...new Set([...snapshot.clients, saved.client])].sort(),
    });
    return saved;
  },
  async saveExpense(
    input: ExpenseInput,
    id?: string,
    requestId?: string,
  ): Promise<Expense> {
    const parsed = expenseSchema.parse(input),
      { account, client, token } = context(true);
    if (!snapshot.jobs.some((j) => j.id === parsed.jobId))
      throw new Error("Select an existing job.");
    const payload = {
      workspace_id: account.workspaceId,
      job_id: parsed.jobId,
      description: parsed.description,
      category: parsed.category,
      amount: (parsed.amount / 100).toFixed(2),
      expense_date: parsed.date,
    };
    const query = id
      ? client
          .from("job_expenses")
          .update({
            job_id: payload.job_id,
            description: payload.description,
            category: payload.category,
            amount: payload.amount,
            expense_date: payload.expense_date,
          })
          .eq("workspace_id", account.workspaceId)
          .eq("id", id)
      : client
          .from("job_expenses")
          .insert({ id: requestId ?? crypto.randomUUID(), ...payload });
    const { data, error } = await query.select("*").single();
    check(error);
    stillCurrent(token);
    const saved = expenseFrom(data!);
    changed();
    publish({
      ...snapshot,
      expenses: [saved, ...snapshot.expenses.filter((e) => e.id !== saved.id)],
    });
    return saved;
  },
  async saveOverhead(
    input: OverheadInput,
    id?: string,
    requestId?: string,
  ): Promise<Overhead> {
    const parsed = overheadSchema.parse(input),
      { account, client, token } = context(true);
    const fields = {
      company_id:
        parsed.companyId === "shared" ? null : companyIds.get(parsed.companyId),
      category: parsed.category,
      description: parsed.description,
      amount: (parsed.amount / 100).toFixed(2),
      expense_date: parsed.date,
      is_recurring: parsed.recurring,
      recurrence_frequency: parsed.recurring ? parsed.frequency : null,
    };
    const query = id
      ? client
          .from("overhead_costs")
          .update(fields)
          .eq("workspace_id", account.workspaceId)
          .eq("id", id)
      : client
          .from("overhead_costs")
          .insert({
            id: requestId ?? crypto.randomUUID(),
            workspace_id: account.workspaceId,
            ...fields,
          });
    const { data, error } = await query.select("*").single();
    check(error);
    stillCurrent(token);
    const saved = overheadFrom(data!);
    changed();
    publish({
      ...snapshot,
      overheads: [
        saved,
        ...snapshot.overheads.filter((o) => o.id !== saved.id),
      ],
    });
    return saved;
  },
  deleteJob(id: string) {
    return deleteRows("jobs", id, [
      id,
      ...snapshot.expenses.filter((e) => e.jobId === id).map((e) => e.id),
    ]);
  },
  deleteExpense(id: string) {
    return deleteRows("job_expenses", id, [id]);
  },
  deleteOverhead(id: string) {
    return deleteRows("overhead_costs", id, [id]);
  },
  async addAttachment(a: Attachment) {
    const { account, client, token } = context(true);
    const owner = snapshot.jobs.some((j) => j.id === a.ownerId)
      ? "job_id"
      : snapshot.expenses.some((e) => e.id === a.ownerId)
        ? "expense_id"
        : snapshot.overheads.some((o) => o.id === a.ownerId)
          ? "overhead_id"
          : null;
    if (!owner) throw new Error("The attachment record no longer exists.");
    const { data, error } = await client
      .from("attachments")
      .insert({
        id: a.id,
        workspace_id: account.workspaceId,
        [owner]: a.ownerId,
        original_filename: a.name,
        storage_path: a.storagePath,
        mime_type: a.mime,
        file_size: a.size,
      })
      .select("*")
      .single();
    check(error);
    stillCurrent(token);
    changed();
    publish({
      ...snapshot,
      attachments: [
        ...snapshot.attachments,
        attachmentFrom(data!, new Map([[account.userId, account.name]])),
      ],
    });
  },
  deleteAttachment(id: string) {
    const a = snapshot.attachments.find((a) => a.id === id);
    if (!a) throw new Error("Attachment not found.");
    return deleteRows("attachments", id, [a.ownerId]).then(() => {});
  },
  async reset() {
    throw new Error(
      "Reset is only available in demo mode. Live records are never replaced with sample data.",
    );
  },
};
