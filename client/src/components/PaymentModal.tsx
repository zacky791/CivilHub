import { useRef, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Job, Payment } from "../lib/types";
import { cents, dateLabel, money, sum, today } from "../lib/finance";
import { repository, useWorkspace } from "../services/repository";
import { Confirm, errorMessage, IconButton, Modal, MoneyInput, useToast } from "./ui";

export default function PaymentModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const w = useWorkspace(), toast = useToast();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const payments = w.payments.filter((p) => p.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
  const received = sum(payments, (p) => p.amount);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true); setError("");
    try {
      const data = new FormData(form);
      await repository.savePayment({ jobId: job.id, amount: cents(String(data.get("amount"))), date: String(data.get("date")) }, requestId.current);
      requestId.current = crypto.randomUUID();
      form.reset();
      toast("Payment recorded.");
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Modal title="Money in" subtitle={`${job.number} · ${job.client}`} onClose={onClose}>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="owner-calc-list">
              <div className="owner-calc-row"><span>Job value</span><strong>{money(job.price, true)}</strong></div>
              <div className="owner-calc-row"><span>Received · {Math.round(received / job.price * 100)}% paid</span><strong>{money(received, true)}</strong></div>
              <div className="owner-calc-row"><span>{received > job.price ? "Overpaid" : "Still due"}</span><strong>{money(Math.abs(job.price - received), true)}</strong></div>
            </div>
            <div className="form-grid payment-form-fields">
              <label>Amount received <span>*</span><MoneyInput /></label>
              <label>Payment date <span>*</span><input type="date" name="date" required defaultValue={today()} /></label>
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <h3>Payment history</h3>
            {payments.length ? <ul className="payment-history">{payments.map((p) => (
              <li key={p.id}>
                <span>{dateLabel(p.date)}</span><strong>{money(p.amount, true)}</strong>
                <IconButton label={`Delete payment of ${money(p.amount)} on ${dateLabel(p.date)}`} onClick={() => setDeleting(p)}><Trash2 size={15} /></IconButton>
              </li>
            ))}</ul> : <p>No payments recorded yet.</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="button" onClick={onClose}>Close</button>
            <button type="submit" className="button button-primary" disabled={busy}><Plus size={16} />{busy ? "Saving…" : "Add payment"}</button>
          </div>
        </form>
      </Modal>
      {deleting && <Confirm title="Delete payment?" text={`Remove this ${money(deleting.amount, true)} payment from ${job.number}? The received total will decrease.`} onClose={() => setDeleting(null)} onConfirm={async () => {
        await repository.deletePayment(deleting.id);
        setDeleting(null);
        toast("Payment deleted.");
      }} />}
    </>
  );
}
