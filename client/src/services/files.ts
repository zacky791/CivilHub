import type { Attachment } from "../lib/types";
import { isDemoMode, repository } from "./repository";
import { getCloudIdentity, getCloudWorkspace } from "./cloud-repository";
import { createSupabaseClient } from "./supabase";
import * as demo from "./demo-files";
export async function addFiles(ownerId: string, files: File[]) {
  if (isDemoMode) return demo.addFiles(ownerId, files);
  const account = getCloudIdentity();
  if (!account || account.role !== "admin")
    throw new Error("Administrator access is required to add documents.");
  // Validate every file before uploading any of them.
  for (const file of files) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
      throw new Error("Only PDF, JPG and PNG files are supported.");
    if (file.size === 0 || file.size > 5 * 1024 * 1024)
      throw new Error(
        "Each attachment must contain data and be no larger than 5 MB.",
      );
    const signature = Array.from(
      new Uint8Array(await file.slice(0, 8).arrayBuffer()),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    if (
      (file.type === "application/pdf" && !signature.startsWith("25504446")) ||
      (file.type === "image/png" &&
        !signature.startsWith("89504e470d0a1a0a")) ||
      (file.type === "image/jpeg" && !signature.startsWith("ffd8ff"))
    )
      throw new Error("The file contents do not match its type.");
  }
  const client = createSupabaseClient(),
    added: string[] = [];
  try {
    for (const file of files) {
      const id = crypto.randomUUID(),
        path = `${account.workspaceId}/${id}`;
      const { error } = await client.storage
        .from("job-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      const a: Attachment = {
        id,
        ownerId,
        name: file.name,
        mime: file.type,
        size: file.size,
        storagePath: path,
        createdAt: new Date().toISOString(),
        uploader: account.name,
      };
      try {
        await repository.addAttachment(a);
      } catch (error) {
        await client.storage.from("job-documents").remove([path]);
        throw error;
      }
      added.push(id);
    }
  } catch (error) {
    for (const id of added) {
      try {
        await repository.deleteAttachment(id);
      } catch {
        /* Successfully uploaded records stay visible if rollback cannot complete. */
      }
    }
    throw error;
  }
}
export async function getFile(id: string): Promise<Blob> {
  if (isDemoMode) return demo.getFile(id);
  const file = getCloudWorkspace().attachments.find((a) => a.id === id);
  if (!file?.storagePath)
    throw new Error("This document is not available in the current workspace.");
  const { data, error } = await createSupabaseClient()
    .storage.from("job-documents")
    .download(file.storagePath);
  if (error || !data)
    throw new Error(error?.message ?? "Unable to download this document.");
  return data;
}
export async function removeFile(id: string) {
  if (isDemoMode) return demo.removeFile(id);
  await repository.deleteAttachment(id);
}
export async function clearFiles() {
  if (!isDemoMode)
    throw new Error("Live files cannot be cleared with a demo reset.");
  await demo.clearFiles();
}
