import { useState, useRef, type FormEvent } from "react";
import { Paperclip, Plus, Save } from "lucide-react";
import {
  companies,
  EPF_RATE,
  OWNER_COUNT,
  expenseCategories,
  overheadCategories,
} from "../lib/constants";
import { cents, money, today } from "../lib/finance";
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
  ownerCost = false,
  record,
  onClose,
}: {
  kind: "expense" | "overhead";
  jobId?: string;
  ownerCost?: boolean;
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
  const isOwner = ownerCost || record?.category === "Owner";
  const initialAmount = record ? (isOwner ? Math.round(record.amount / OWNER_COUNT) : record.amount) : undefined;
  const [ownerAmount, setOwnerAmount] = useState<number | null>(initialAmount ?? null);
  const epf = ownerAmount === null ? null : Math.round(ownerAmount * EPF_RATE / 100);
  const costLabel = isOwner ? "Owner cost" : isOverhead ? "Overhead" : "Expense";
  const requestId = useRef(crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget),
        base = {
          description: isOwner
            ? record?.description || "Owner cost"
            : String(f.get("description")).trim(),
          category: isOwner ? "Owner" : String(f.get("category")),
          date: String(f.get("date")),
          amount: cents(String(f.get("amount"))) * (isOwner ? OWNER_COUNT : 1),
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
            `${costLabel} saved. Receipt: ${errorMessage(e)}`,
            true,
          );
          onClose();
          return;
        }
      }
      toast(
        `${costLabel} ${record ? "updated" : "added"} successfully`,
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${isOwner ? "owner cost" : isOverhead ? "overhead cost" : "job expense"}`}
      subtitle={
        isOwner
          ? "Record an independent owner cost. It will appear in the dashboard Owner total."
          : isOverhead
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
            {!isOwner && (
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
            )}
            <label>
              Category <span>*</span>
              <SelectWrap>
                <select
                  disabled={isOwner}
                  name="category"
                  defaultValue={
                    record?.category ??
                    (isOwner ? "Owner" : isOverhead ? "Office Rental" : "Materials")
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
            <label onChange={(event) => {
              if (!isOwner || !(event.target instanceof HTMLInputElement)) return;
              try {
                setOwnerAmount(cents(event.target.value));
              } catch {
                setOwnerAmount(null);
              }
            }}>
              {isOwner ? "Amount per owner" : "Amount"} <span>*</span>
              <MoneyInput defaultValue={initialAmount} />
            </label>
            {isOwner && (
              <div className="owner-calc-list full-width" aria-live="polite">
                <div className="owner-calc-row">
                  <span>Owners (fixed)</span>
                  <strong>{OWNER_COUNT} people</strong>
                </div>
                <div className="owner-calc-row">
                  <span>EPF ({EPF_RATE}%) per owner</span>
                  <strong>{epf === null ? "—" : money(epf, true)}</strong>
                </div>
                <div className="owner-calc-row owner-calc-net">
                  <span>Net per owner after EPF</span>
                  <strong>{ownerAmount === null || epf === null ? "—" : money(ownerAmount - epf, true)}</strong>
                </div>
                <div className="owner-calc-row">
                  <span>Total EPF × {OWNER_COUNT} owners</span>
                  <strong>{epf === null ? "—" : money(epf * OWNER_COUNT, true)}</strong>
                </div>
                <div className="owner-calc-row">
                  <span>Total net × {OWNER_COUNT} owners</span>
                  <strong>{ownerAmount === null || epf === null ? "—" : money((ownerAmount - epf) * OWNER_COUNT, true)}</strong>
                </div>
                <div className="owner-calc-row owner-calc-net">
                  <span>Total owner cost × {OWNER_COUNT} (including EPF)</span>
                  <strong>{ownerAmount === null ? "—" : money(ownerAmount * OWNER_COUNT, true)}</strong>
                </div>
              </div>
            )}
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
                : `Add ${isOwner ? "owner cost" : isOverhead ? "overhead" : "expense"}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
