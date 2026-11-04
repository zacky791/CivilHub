import type { Expense, Job, Overhead } from "./types";
export function cents(input: string): number {
  const original = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(original))
    throw new Error("Enter a valid amount with up to two decimal places.");
  const cleaned = original.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned))
    throw new Error("Enter a valid amount with up to two decimal places.");
  const [whole, decimal = ""] = cleaned.split(".");
  const value = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value > 999_999_999_99)
    throw new Error("Amount is too large.");
  return value;
}
// Group the whole part as text so editing never rounds or loses precision.
export function formatMoneyInput(input: string): string {
  const value = input.trim().replace(/,/g, "");
  if (!value || !/^\d*(?:\.\d*)?$/.test(value)) return input;
  const [whole, fraction] = value.split(".");
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
export const money = (amount: number, decimals = amount % 100 !== 0) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(amount / 100);
export const compact = (amount: number) =>
  amount >= 100_000_000
    ? `RM ${(amount / 100_000_000).toFixed(2)}m`
    : amount >= 1_000_000
      ? `RM ${(amount / 100_000).toFixed(0)}k`
      : money(amount);
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date.length === 10 ? `${date}T12:00:00+08:00` : date));
export function today() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}-${p.find((x) => x.type === "day")!.value}`;
}
export const sum = <T>(rows: T[], field: (row: T) => number) =>
  rows.reduce((a, row) => a + field(row), 0);
export const jobExpense = (jobId: string, expenses: Expense[]) =>
  sum(
    expenses.filter((e) => e.jobId === jobId),
    (e) => e.amount,
  );
export const monthKey = (date = today()) => date.slice(0, 7);
export const ownerShare = (total: number, count: number) =>
  Math.floor(total / count);
export function ownerCalc(
  total: number,
  count: number,
  epfRate: number,
) {
  const share = ownerShare(total, count),
    epfEach = Math.floor((share * epfRate) / 100),
    epfTotal = epfEach * count;
  return {
    share,
    epfEach,
    epfTotal,
    netEach: share - epfEach,
    epfRate,
    count,
  };
}
export function financials(
  jobs: Job[],
  expenses: Expense[],
  overheads: Overhead[],
) {
  const jobIds = new Set(jobs.map((j) => j.id));
  const revenue = sum(jobs, (j) => j.price),
    direct = sum(
      expenses.filter((e) => jobIds.has(e.jobId)),
      (e) => e.amount,
    ),
    overhead = sum(overheads, (o) => o.amount);
  return {
    revenue,
    direct,
    overhead,
    gross: revenue - direct,
    net: revenue - direct - overhead,
    jobs: jobs.length,
  };
}
export function exportCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const escape = (value: string | number) => {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  download(
    new Blob(
      [
        "\uFEFF" +
          [headers, ...rows]
            .map((row) => row.map(escape).join(","))
            .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    filename,
  );
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
