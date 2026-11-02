import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Pencil,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { companyById } from "../lib/constants";
import { dateLabel, jobExpense, money } from "../lib/finance";
import { repository, useWorkspace } from "../services/repository";
import type { Job } from "../lib/types";
import {
  Attachments,
  CompanyMark,
  Confirm,
  errorMessage,
  FinancialStrip,
  Modal,
  Status,
  useToast,
} from "./ui";
export default function JobDetails({
  id,
  onClose,
  onEdit,
}: {
  id: string;
  onClose: () => void;
  onEdit: (job: Job) => void;
}) {
  const w = useWorkspace(),
    navigate = useNavigate(),
    toast = useToast(),
    [confirm, setConfirm] = useState(false);
  const job = w.jobs.find((j) => j.id === id);
  if (!job) return null;
  const c = companyById(job.companyId),
    spent = jobExpense(id, w.expenses);
  return (
    <Modal title={job.number} subtitle="Job overview" onClose={onClose} wide>
      <div className="modal-body">
        <div className="detail-title">
          <div className="company-inline">
            <CompanyMark {...c} />
            <div>
              <small>{c.name}</small>
              <h2>{job.workType}</h2>
            </div>
          </div>
          <Status status={job.status} />
        </div>
        <FinancialStrip price={job.price} spent={spent} />
        {spent > job.price && (
          <div className="warning">
            This job is over budget by {money(spent - job.price, true)}.
          </div>
        )}
        <div className="details-grid">
          <div>
            <span>Client</span>
            <strong>{job.client}</strong>
          </div>
          <div>
            <span>
              <CalendarDays size={14} /> Job date
            </span>
            <strong>{dateLabel(job.date)}</strong>
          </div>
          <div className="full-width">
            <span>
              <MapPin size={14} /> Location
            </span>
            <strong>{job.location}</strong>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              View on Google Maps <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="full-width">
            <span>Description</span>
            <p>{job.description || "No additional notes for this job."}</p>
          </div>
        </div>
        <Attachments ownerId={id} />
        <div className="audit-note">
          Created {dateLabel(job.createdAt)} · Updated{" "}
          {dateLabel(job.updatedAt)} · Demo Admin
        </div>
      </div>
      <div className="modal-footer">
        <button
          className="button button-ghost text-rose"
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={15} />
          Delete job
        </button>
        <span className="spacer" />
        <button className="button" onClick={() => onEdit(job)}>
          <Pencil size={15} />
          Edit job
        </button>
        <button
          className="button button-primary"
          onClick={() => {
            onClose();
            navigate(`/expenses?job=${id}`);
          }}
        >
          <ReceiptText size={16} />
          Manage expenses
        </button>
      </div>
      {confirm && (
        <Confirm
          title={`Delete ${job.number}?`}
          text="This will also delete its expense records and attachment references. This action cannot be undone."
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            try {
              repository.deleteJob(id);
              toast("Job and associated expenses deleted");
              onClose();
            } catch (e) {
              toast(errorMessage(e), true);
            }
          }}
        />
      )}
    </Modal>
  );
}
