import { repository } from "./repository";
import type { Attachment } from "../lib/types";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("civilhub-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("File storage is unavailable in this browser."));
  });
}
async function store<T>(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", mode);
    const request = action(tx.objectStore("files"));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(
        new Error("Unable to save the file. Browser storage may be full."),
      );
    };
  });
}
export async function addFiles(ownerId: string, files: File[]) {
  const added: Attachment[] = [];
  try {
    for (const file of files) {
      if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
        throw new Error("Only PDF, JPG and PNG files are supported.");
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Each attachment must be under 5 MB.");
      const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const signature = Array.from(bytes)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      if (
        (file.type === "application/pdf" &&
          !signature.startsWith("25504446")) ||
        (file.type === "image/png" &&
          !signature.startsWith("89504e470d0a1a0a")) ||
        (file.type === "image/jpeg" && !signature.startsWith("ffd8ff"))
      )
        throw new Error("The file contents do not match its type.");
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        ownerId,
        name: file.name,
        mime: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        uploader: "Demo Admin",
      };
      await store("readwrite", (s) => s.put(file, attachment.id));
      try {
        repository.addAttachment(attachment);
      } catch (error) {
        await store("readwrite", (s) => s.delete(attachment.id));
        throw error;
      }
      added.push(attachment);
    }
  } catch (error) {
    for (const a of added) {
      repository.deleteAttachment(a.id);
      await store("readwrite", (s) => s.delete(a.id));
    }
    throw error;
  }
}
export async function getFile(id: string): Promise<Blob> {
  const result = await store("readonly", (s) => s.get(id));
  if (!result) throw new Error("This file is not available on this device.");
  return result as Blob;
}
export async function removeFile(id: string) {
  await store("readwrite", (s) => s.delete(id));
  repository.deleteAttachment(id);
}
export async function clearFiles() {
  await store("readwrite", (s) => s.clear());
}
