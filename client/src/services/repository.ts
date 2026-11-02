import { useSyncExternalStore } from "react";
import type {
  Attachment,
  ExpenseInput,
  JobInput,
  OverheadInput,
} from "../lib/types";
import {
  repository as demo,
  getWorkspace as getDemoWorkspace,
  subscribe as subscribeDemo,
} from "./demo-repository";
import {
  cloudRepository as cloud,
  getCloudWorkspace,
  getSyncNotice,
  refreshCloudWorkspace,
  subscribeCloud,
} from "./cloud-repository";
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY),
);
export const getWorkspace = isDemoMode ? getDemoWorkspace : getCloudWorkspace;
export const subscribe = isDemoMode ? subscribeDemo : subscribeCloud;
export function useWorkspace() {
  return useSyncExternalStore(subscribe, getWorkspace, getWorkspace);
}
export function useSyncNotice() {
  return useSyncExternalStore(subscribeCloud, getSyncNotice, getSyncNotice);
}
export const refreshWorkspace = () =>
  isDemoMode ? Promise.resolve() : refreshCloudWorkspace();
export const repository = {
  async saveJob(input: JobInput, id?: string, requestId?: string) {
    return isDemoMode
      ? demo.saveJob(input, id)
      : cloud.saveJob(input, id, requestId);
  },
  async saveExpense(input: ExpenseInput, id?: string, requestId?: string) {
    return isDemoMode
      ? demo.saveExpense(input, id)
      : cloud.saveExpense(input, id, requestId);
  },
  async saveOverhead(input: OverheadInput, id?: string, requestId?: string) {
    return isDemoMode
      ? demo.saveOverhead(input, id)
      : cloud.saveOverhead(input, id, requestId);
  },
  async deleteJob(id: string) {
    return isDemoMode ? demo.deleteJob(id) : cloud.deleteJob(id);
  },
  async deleteExpense(id: string) {
    return isDemoMode ? demo.deleteExpense(id) : cloud.deleteExpense(id);
  },
  async deleteOverhead(id: string) {
    return isDemoMode ? demo.deleteOverhead(id) : cloud.deleteOverhead(id);
  },
  async addAttachment(a: Attachment) {
    return isDemoMode ? demo.addAttachment(a) : cloud.addAttachment(a);
  },
  async deleteAttachment(id: string) {
    return isDemoMode ? demo.deleteAttachment(id) : cloud.deleteAttachment(id);
  },
  async reset(empty = false) {
    return isDemoMode ? demo.reset(empty) : cloud.reset();
  },
};
