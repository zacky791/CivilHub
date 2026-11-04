import {
  Building2,
  Download,
  Paperclip,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  companies,
  companyById,
  overheadCategories,
} from "../lib/constants";
import {
  dateLabel,
  exportCSV,
  money,
  sum,
  today,
} from "../lib/finance";
import type { Overhead } from "../lib/types";
import { repository, useWorkspace } from "../services/repository";
import {
  CompanyMark,
  Confirm,
  Empty,
  errorMessage,
  IconButton,
  SelectWrap,
  StatCard,
  useToast,
} from "../components/ui";
import CostForm from "../components/CostForm";
export default function Overheads() {
  const w = useWorkspace(),
    toast = useToast(),
    [company, setCompany] = useState("all"),
    [category, setCategory] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [form, setForm] = useState<Overhead | "new" | null>(null),
    [deleting, setDeleting] = useState<Overhead | null>(null),
    [ownersOpen, setOwnersOpen] = useState(false);
  const rows = w.overheads
      .filter(
        (o) =>
          (company === "all" || o.companyId === company) &&
          (category === "all" || o.category === category) &&
          (!from || o.date >= from) &&
          (!to || o.date <= to),
      )
      .sort((a, b) => b.date.localeCompare(a.date)),
    date = today(),
    month = rows.filter((o) => o.date.slice(0, 7) === date.slice(0, 7)),
    year = rows.filter((o) => o.date.slice(0, 4) === date.slice(0, 4));
  const catData = overheadCategories
    .map((c) => ({
      name: c,
      value: sum(
        rows.filter((o) => o.category === c),
        (o) => o.amount,
      ),
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = sum(rows, (o) => o.amount);
  const ownerTotal = sum(rows.filter((o) => o.category === "Owner"), (o) => o.amount);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">BEYOND THE JOB SITE</div>
          <h1>
            Overhead costs<span className="heading-dot">.</span>
          </h1>
          <p>The everyday costs that keep your business moving.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setForm("new")}
        >
          <Plus size={17} />
          Add overhead
        </button>
      </div>
      <div className="stats-grid">
        <StatCard
          label="This month’s overhead"
          value={money(sum(month, (o) => o.amount))}
          note={new Intl.DateTimeFormat("en-MY", {
            month: "long",
            year: "numeric",
            timeZone: "Asia/Kuala_Lumpur",
          }).format(new Date())}
          type="expense"
        />
        <StatCard
          label="This year’s overhead"
          value={money(sum(year, (o) => o.amount))}
          note={`${date.slice(0, 4)} · matching filters`}
          type="value"
        />
        <div className="stat-card stat-owner">
          <div className="stat-top">
            <span>Owner</span>
            <span className="stat-icon owner">
              <Users size={17} />
            </span>
          </div>
          <div className="stat-value">{money(ownerTotal)}</div>
        </div>
      </div>
      <div className="filters-bar">
        <SelectWrap>
          <select
            aria-label="Overhead company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="all">All companies</option>
            <option value="shared">Shared / General</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short}
              </option>
            ))}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select
            aria-label="Overhead category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {overheadCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </SelectWrap>
        <label className="compact-date">
          From
          <input
            type="date"
            aria-label="Overhead from date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="compact-date">
          To
          <input
            type="date"
            aria-label="Overhead to date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          className="button button-small"
          onClick={() => setOwnersOpen(true)}
        >
          <Users size={14} />
          Owner
        </button>
        {(company !== "all" || category !== "all" || from || to) && (
          <button
            className="text-button"
            onClick={() => {
              setCompany("all");
              setCategory("all");
              setFrom("");
              setTo("");
            }}
          >
            Clear
          </button>
        )}
        <span className="spacer" />
        <button
          className="button"
          onClick={() =>
            exportCSV(
              "civilhub-overheads.csv",
              [
                "Date",
                "Company",
                "Category",
                "Description",
                "Amount RM",
                "Recurring",
              ],
              rows.map((o) => [
                o.date,
                o.companyId === "shared"
                  ? "Shared / General"
                  : companyById(o.companyId).name,
                o.category,
                o.description,
                (o.amount / 100).toFixed(2),
                o.recurring ? o.frequency : "One-time",
              ]),
            )
          }
        >
          <Download size={15} />
          Export
        </button>
      </div>
      <div className="main-split overhead-split">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Operating expenses <span className="count">{rows.length}</span>
              </h2>
              <p>A clear view of your business running costs.</p>
            </div>
          </div>
          {rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Description / Category</th>
                    <th>Company</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="amount">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong className="table-primary">
                          {o.description}
                        </strong>
                        <span className="table-secondary">
                          {o.category}
                          {w.attachments.some((a) => a.ownerId === o.id) && (
                            <Paperclip size={11} />
                          )}
                        </span>
                      </td>
                      <td>
                        {o.companyId === "shared" ? (
                          <span className="company-cell">
                            <span className="shared-mark">
                              <Building2 size={14} />
                            </span>
                            Shared
                          </span>
                        ) : (
                          <span className="company-cell">
                            <CompanyMark {...companyById(o.companyId)} small />
                            {companyById(o.companyId).short}
                          </span>
                        )}
                      </td>
                      <td>{dateLabel(o.date)}</td>
                      <td>
                        <span
                          className={`recurring-pill ${o.recurring ? "is-recurring" : ""}`}
                        >
                          {o.recurring && <Repeat2 size={12} />}{" "}
                          {o.recurring
                            ? o.frequency === "monthly"
                              ? "Monthly"
                              : "Yearly"
                            : "One-time"}
                        </span>
                      </td>
                      <td className="amount cell-money">
                        {money(o.amount, true)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <IconButton
                            label={`Edit ${o.description}`}
                            onClick={() => setForm(o)}
                          >
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            label={`Delete ${o.description}`}
                            onClick={() => setDeleting(o)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total for this view</td>
                    <td className="amount">{money(total, true)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <Empty
              title="No overhead costs found"
              text="Add a business cost or adjust the filters."
            />
          )}
        </section>
        <aside className="panel cost-breakdown">
          <div className="panel-heading">
            <div>
              <h2>Cost breakdown</h2>
              <p>By expense category</p>
            </div>
          </div>
          <div className="breakdown-list">
            {catData.length ? (
              catData.map((c, i) => (
                <div key={c.name}>
                  <div>
                    <span>{c.name}</span>
                    <strong>{money(c.value)}</strong>
                  </div>
                  <div className="breakdown-track">
                    <span
                      style={{
                        width: `${(c.value / total) * 100}%`,
                        background: companies[i % 5].color,
                      }}
                    />
                  </div>
                  <small>
                    {Math.round((c.value / total) * 100)}% of overhead costs
                  </small>
                </div>
              ))
            ) : (
              <Empty
                title="No costs yet"
                text="Your category breakdown appears here."
              />
            )}
          </div>
          <div className="panel-divider" />
          <div className="company-costs">
            <h3>By company</h3>
            {[
              ...companies.map((c) => ({
                id: c.id,
                name: c.short,
                color: c.color,
              })),
              { id: "shared", name: "Shared / General", color: "#9894a5" },
            ].map((c) => (
              <div key={c.id}>
                <span className="legend-dot" style={{ background: c.color }} />
                <span>{c.name}</span>
                <strong>
                  {money(
                    sum(
                      rows.filter((o) => o.companyId === c.id),
                      (o) => o.amount,
                    ),
                  )}
                </strong>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="note-panel">
        <Repeat2 size={17} />
        <p>
          Recurring costs are recorded once per period. Shared costs stay
          separate and are counted once in consolidated reports.
        </p>
      </div>
      {form && (
        <CostForm
          kind="overhead"
          record={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {deleting && (
        <Confirm
          title="Delete overhead cost?"
          text={`“${deleting.description}” and its attachment references will be removed.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await repository.deleteOverhead(deleting.id);
              setDeleting(null);
              toast("Overhead cost deleted");
            } catch (e) {
              toast(errorMessage(e), true);
            }
          }}
        />
      )}
      {ownersOpen && (
        <CostForm
          kind="overhead"
          ownerCost
          onClose={() => setOwnersOpen(false)}
        />
      )}
    </div>
  );
}
