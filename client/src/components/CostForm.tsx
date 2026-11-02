import { useState, useRef, type FormEvent } from "react";
import { Paperclip, Plus, Save } from "lucide-react";
import {
  companies,
  expenseCategories,
  overheadCategories,
} from "../lib/constants";
import { cents, today } from "../lib/finance";
import type { CompanyId, Expense, Overhead } from "../lib/types";
import { repository } from "../services/repository";
import { addFiles } from "../services/files";
import {
  Attachments,
  errorMessage,
  Modal,
  MoneyInput,
  SelectWrap,
  useToast,
} from "./ui";
export default function CostForm({
  kind,
  jobId,
  record,
  onClose,
}: {
  kind: "expense" | "overhead";
  jobId?: string;
  record?: Expense | Overhead;
  onClose: () => void;
}) {
  const toast = useToast(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recurring, setRecurring] = useState(
      (record as Overhead)?.recurring ?? false,
    );
  const isOverhead = kind === "overhead";
  const requestId = useRef(crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget),
        base = {
          description: String(f.get("description")).trim(),
          category: String(f.get("category")),
          date: String(f.get("date")),
          amount: cents(String(f.get("amount"))),
        };
      const saved = isOverhead
        ? await repository.saveOverhead(
            {
              ...base,
              companyId: String(f.get("companyId")) as CompanyId | "shared",
              recurring,
              frequency: String(f.get("frequency") ?? "monthly") as
                | "monthly"
                | "yearly",
            },
            record?.id,
            requestId.current,
          )
        : await repository.saveExpense(
            { ...base, jobId: jobId! },
            record?.id,
            requestId.current,
          );
      const file = f.get("receipt") as File | null;
      if (file?.size) {
        try {
          await addFiles(saved.id, [file]);
        } catch (e) {
          toast(
            `${isOverhead ? "Overhead" : "Expense"} saved. Receipt: ${errorMessage(e)}`,
            true,
          );
          onClose();
          return;
        }
      }
      toast(
        `${isOverhead ? "Overhead" : "Expense"} ${record ? "updated" : "added"} successfully`,
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${isOverhead ? "overhead cost" : "job expense"}`}
      subtitle={
        isOverhead
          ? "Keep your operating costs in the picture."
          : "Record a direct cost against the original job value."
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            {isOverhead && (
              <label className="full-width">
                Company <span>*</span>
                <SelectWrap>
                  <select
                    name="companyId"
                    defaultValue={(record as Overhead)?.companyId ?? "shared"}
                  >
                    <option value="shared">Shared / General</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </SelectWrap>
              </label>
            )}
            <label className="full-width">
              Expense description <span>*</span>
              <input
                name="description"
                defaultValue={record?.description}
                required
                placeholder={
                  isOverhead
                    ? "e.g. November office rental"
                    : "e.g. Asphalt premix supply"
                }
                maxLength={500}
              />
            </label>
            <label>
              Category <span>*</span>
              <SelectWrap>
                <select
                  name="category"
                  defaultValue={
                    record?.category ??
                    (isOverhead ? "Office Rental" : "Materials")
                  }
                >
                  {(isOverhead ? overheadCategories : expenseCategories).map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </SelectWrap>
            </label>
            <label>
              Amount <span>*</span>
              <MoneyInput defaultValue={record?.amount} />
            </label>
            <label className="full-width">
              Expense date <span>*</span>
              <input
                type="date"
                name="date"
                defaultValue={record?.date ?? today()}
                required
              />
            </label>
            {isOverhead && (
              <>
                <label className="checkbox-field full-width">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                  />
                  <span>
                    This is a recurring cost
                    <small>
                      Record each period manually. Duplicate periods are
                      checked.
                    </small>
                  </span>
                </label>
                {recurring && (
                  <label className="full-width">
                    Frequency
                    <SelectWrap>
                      <select
                        name="frequency"
                        defaultValue={
                          (record as Overhead)?.frequency ?? "monthly"
                        }
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </SelectWrap>
                  </label>
                )}
              </>
            )}
            {!record && (
              <label className="full-width">
                Receipt or invoice{" "}
                <small className="inline-optional">Optional</small>
                <input
                  className="file-input"
                  type="file"
                  name="receipt"
                  accept="application/pdf,image/jpeg,image/png"
                />
                <small>PDF, JPG or PNG · up to 5 MB</small>
              </label>
            )}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {record && <Attachments ownerId={record.id} />}
        </div>
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            <Save size={16} />
            {busy
              ? "Saving…"
              : record
                ? "Save changes"
                : `Add ${isOverhead ? "overhead" : "expense"}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
