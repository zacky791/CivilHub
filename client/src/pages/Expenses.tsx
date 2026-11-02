import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Download,
  FileText,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useActions } from "../lib/actions";
import { companyById, expenseCategories } from "../lib/constants";
import { dateLabel, exportCSV, jobExpense, money, sum } from "../lib/finance";
import type { Expense } from "../lib/types";
import { repository, useWorkspace } from "../services/repository";
import {
  CompanyMark,
  Confirm,
  Empty,
  errorMessage,
  FinancialStrip,
  IconButton,
  SelectWrap,
  Status,
  useToast,
} from "../components/ui";
import CostForm from "../components/CostForm";
export default function Expenses() {
  const w = useWorkspace(),
    toast = useToast(),
    { newJob, viewJob } = useActions(),
    [params, setParams] = useSearchParams();
  const id = params.get("job") ?? w.jobs[0]?.id,
    job = w.jobs.find((j) => j.id === id);
  const [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [form, setForm] = useState<Expense | "new" | null>(null),
    [deleting, setDeleting] = useState<Expense | null>(null);
  const rows = w.expenses
      .filter(
        (e) =>
          e.jobId === id &&
          (category === "all" || e.category === category) &&
          (!from || e.date >= from) &&
          (!to || e.date <= to),
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
    spent = job ? jobExpense(job.id, w.expenses) : 0;
  const options = w.jobs.filter((j) =>
    `${j.number} ${j.workType} ${j.client} ${companyById(j.companyId).name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">KEEP COSTS IN CHECK</div>
          <h1>
            Job expenses<span className="heading-dot">.</span>
          </h1>
          <p>Every ringgit accounted for. Every job under control.</p>
        </div>
        <button
          className="button button-primary"
          disabled={!job}
          onClick={() => setForm("new")}
        >
          <Plus size={17} />
          Add expense
        </button>
      </div>
      <section className="panel job-selector-panel">
        <div>
          <span className="field-eyebrow">SELECT A JOB</span>
          <p>Choose the project you’re recording costs for.</p>
        </div>
        <div className="job-selector">
          <button
            className="job-select-trigger"
            aria-expanded={picker}
            onClick={() => setPicker(!picker)}
          >
            {job ? (
              <>
                <CompanyMark {...companyById(job.companyId)} small />
                <div>
                  <strong>
                    {job.number} <span>· {job.workType}</span>
                  </strong>
                  <small>
                    {companyById(job.companyId).name} · {job.client}
                  </small>
                </div>
              </>
            ) : (
              <span>Select a registered job</span>
            )}
            <ChevronDown size={18} />
          </button>
          {picker && (
            <div className="job-select-options">
              <div className="search-field">
                <Search size={15} />
                <input
                  autoFocus
                  aria-label="Find a registered job"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search jobs, companies or clients…"
                />
              </div>
              <div className="job-option-list">
                {options.length ? (
                  options.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => {
                        setParams({ job: j.id });
                        setPicker(false);
                        setQuery("");
                        setCategory("all");
                        setFrom("");
                        setTo("");
                      }}
                    >
                      <CompanyMark {...companyById(j.companyId)} small />
                      <div>
                        <strong>
                          {j.number} · {j.workType}
                        </strong>
                        <small>
                          {companyById(j.companyId).short} · {j.client}
                        </small>
                      </div>
                      <span>{money(j.price)}</span>
                    </button>
                  ))
                ) : (
                  <div className="picker-empty">No matching jobs</div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      {job ? (
        <>
          <section className="panel selected-job-panel">
            <div className="panel-heading">
              <div>
                <div className="company-inline">
                  <h2>{job.workType}</h2>
                  <Status status={job.status} />
                </div>
                <p>
                  <MapPin size={13} />
                  {job.location} <span className="separator">·</span>{" "}
                  {dateLabel(job.date)}
                </p>
              </div>
              <button className="text-link" onClick={() => viewJob(job.id)}>
                View job details <ArrowUpRight size={14} />
              </button>
            </div>
            <FinancialStrip price={job.price} spent={spent} />
            <div className="budget-visual">
              <div>
                <span>Budget used</span>
                <strong>{Math.round((spent / job.price) * 100)}%</strong>
              </div>
              <div
                className={`budget-track ${spent > job.price ? "over-budget" : ""}`}
              >
                <span
                  style={{
                    width: `${Math.min(100, (spent / job.price) * 100)}%`,
                  }}
                />
              </div>
              <p>
                {spent > job.price
                  ? "Costs have exceeded the original job value."
                  : `${money(job.price - spent, true)} available for remaining work.`}
              </p>
            </div>
            {spent > job.price && (
              <div className="warning">
                <AlertTriangle size={17} />
                Cost overrun: expenses exceed this job’s value by{" "}
                {money(spent - job.price, true)}.
              </div>
            )}
          </section>
          <section className="panel expense-history">
            <div className="panel-heading">
              <div>
                <h2>
                  Expense history <span className="count">{rows.length}</span>
                </h2>
                <p>Direct costs recorded for {job.number}.</p>
              </div>
              <button
                className="button button-small"
                onClick={() =>
                  exportCSV(
                    `${job.number}-expenses.csv`,
                    ["Date", "Category", "Description", "Amount RM"],
                    rows.map((e) => [
                      e.date,
                      e.category,
                      e.description,
                      (e.amount / 100).toFixed(2),
                    ]),
                  )
                }
              >
                <Download size={14} />
                Export
              </button>
            </div>
            <div className="inline-filters">
              <SelectWrap>
                <select
                  aria-label="Expense category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {expenseCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </SelectWrap>
              <label>
                From
                <input
                  type="date"
                  aria-label="Expenses from date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  aria-label="Expenses to date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              {(category !== "all" || from || to) && (
                <button
                  className="text-button"
                  onClick={() => {
                    setCategory("all");
                    setFrom("");
                    setTo("");
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {rows.length ? (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Receipt</th>
                        <th className="amount">Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <span className="expense-description">
                              <span className="expense-symbol">
                                <ReceiptText size={16} />
                              </span>
                              {e.description}
                            </span>
                          </td>
                          <td>
                            <span className="category-pill">{e.category}</span>
                          </td>
                          <td>{dateLabel(e.date)}</td>
                          <td>
                            {w.attachments.some((a) => a.ownerId === e.id) ? (
                              <button
                                className="text-link"
                                onClick={() => setForm(e)}
                              >
                                <Paperclip size={13} />
                                View
                              </button>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="amount cell-money">
                            {money(e.amount, true)}
                          </td>
                          <td>
                            <div className="row-actions">
                              <IconButton
                                label={`Edit ${e.description}`}
                                onClick={() => setForm(e)}
                              >
                                <Pencil size={15} />
                              </IconButton>
                              <IconButton
                                label={`Delete ${e.description}`}
                                onClick={() => setDeleting(e)}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}>Total expenses in this view</td>
                        <td className="amount">
                          {money(
                            sum(rows, (e) => e.amount),
                            true,
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <Empty
                title="No expenses in this view"
                text="Add a direct cost or adjust your date and category filters."
                action={
                  <button
                    className="button button-small"
                    onClick={() => setForm("new")}
                  >
                    <Plus size={14} />
                    Add expense
                  </button>
                }
              />
            )}
          </section>
          <div className="note-panel">
            <FileText size={17} />
            <p>
              Your original job price stays the same. Expenses are deducted from
              the remaining balance.
            </p>
          </div>
        </>
      ) : (
        <section className="panel">
          <Empty
            title="Choose a job to get started"
            text={
              w.jobs.length
                ? "Select a registered job above to manage its expenses."
                : "Register your first job, then record its costs here."
            }
            action={
              <button
                className="button button-primary"
                onClick={() => newJob()}
              >
                <Plus size={15} />
                Register a job
              </button>
            }
          />
        </section>
      )}
      {form && job && (
        <CostForm
          kind="expense"
          jobId={job.id}
          record={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {deleting && (
        <Confirm
          title="Delete this expense?"
          text={`Removing “${deleting.description}” will restore ${money(deleting.amount, true)} to the job balance.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            try {
              repository.deleteExpense(deleting.id);
              setDeleting(null);
              toast("Expense deleted. Job balance updated.");
            } catch (e) {
              toast(errorMessage(e), true);
            }
          }}
        />
      )}
    </div>
  );
}
