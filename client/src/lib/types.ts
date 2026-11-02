export type CompanyId = "akar" | "mastura" | "trust" | "amiza" | "kugiran";
export interface Company {
  id: CompanyId;
  name: string;
  short: string;
  initials: string;
  color: string;
  light: string;
}
export type JobStatus = "Active" | "Completed" | "On hold";
export interface Job {
  id: string;
  number: string;
  companyId: CompanyId;
  workType: string;
  client: string;
  price: number;
  location: string;
  lat: number;
  lng: number;
  date: string;
  description: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}
export interface Expense {
  id: string;
  jobId: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}
export interface Overhead {
  id: string;
  companyId: CompanyId | "shared";
  category: string;
  description: string;
  amount: number;
  date: string;
  recurring: boolean;
  frequency: "monthly" | "yearly";
  createdAt: string;
  updatedAt: string;
}
export interface Attachment {
  id: string;
  ownerId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  uploader: string;
}
export interface Activity {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  kind: "job" | "expense" | "overhead";
}
export interface Workspace {
  version: 1;
  jobs: Job[];
  expenses: Expense[];
  overheads: Overhead[];
  clients: string[];
  attachments: Attachment[];
  activities: Activity[];
  nextJob: number;
}
export type JobInput = Omit<Job, "id" | "number" | "createdAt" | "updatedAt">;
export type ExpenseInput = Omit<Expense, "id" | "createdAt" | "updatedAt">;
export type OverheadInput = Omit<Overhead, "id" | "createdAt" | "updatedAt">;
