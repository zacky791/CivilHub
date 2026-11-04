import PaymentModal from "../components/PaymentModal";
import type { Job } from "../lib/types";
import {
  ArrowUpRight,
  ChevronDown,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useActions } from "../lib/actions";
import { companies, workTypes } from "../lib/constants";
import {
  exportCSV,
  financials,
  money,
  monthKey,
  sum,
} from "../lib/finance";
import { useWorkspace } from "../services/repository";
import { CompanyMark, Empty, SelectWrap, StatCard } from "../components/ui";
import JobsTable from "../components/JobsTable";
export default function Dashboard() {
  const w = useWorkspace(),
    { viewJob, newJob } = useActions(),
    [params] = useSearchParams();
  const [company, setCompany] = useState(() =>
      companies.some((c) => c.id === params.get("company"))
        ? params.get("company")!
        : "all",
    ),
    [work, setWork] = useState("all"),
    [client, setClient] = useState("all"),
    [query, setQuery] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [paymentJob, setPaymentJob] = useState<Job | null>(null);
  const [closed, setClosed] = useState<string[]>([]),
    [showDates, setShowDates] = useState(false);
  const jobs = w.jobs.filter(
    (j) =>
      (company === "all" || j.companyId === company) &&
      (work === "all" || j.workType === work) &&
      (client === "all" || j.client === client) &&
      (!from || j.date >= from) &&
      (!to || j.date <= to) &&
      `${j.number} ${j.location} ${j.workType} ${j.client}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const f = financials(jobs, w.expenses, []),
    jobIds = new Set(jobs.map((j) => j.id)),
    thisMonth = monthKey(),
    thisYear = thisMonth.slice(0, 4),
    monthDirect = sum(
      w.expenses.filter(
        (e) => jobIds.has(e.jobId) && e.date.startsWith(thisMonth),
      ),
      (e) => e.amount,
    ),
    yearDirect = sum(
      w.expenses.filter(
        (e) => jobIds.has(e.jobId) && e.date.startsWith(thisYear),
      ),
      (e) => e.amount,
    ),
    ownerTotal = sum(
      w.expenses.filter((e) => jobIds.has(e.jobId) && e.category === "Owner" && (!from || e.date >= from) && (!to || e.date <= to)),
      (e) => e.amount,
    ) + sum(
      w.overheads.filter((o) => o.category === "Owner" && (company === "all" || o.companyId === company) && (!from || o.date >= from) && (!to || o.date <= to) && work === "all" && client === "all" && !query),
      (o) => o.amount,
    ),
    active =
      company !== "all" ||
      work !== "all" ||
      client !== "all" ||
      query ||
      from ||
      to;
  return (
    <div className="page-enter">
      {paymentJob && <PaymentModal job={w.jobs.find((j) => j.id === paymentJob.id) ?? paymentJob} onClose={() => setPaymentJob(null)} />}
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE BIG PICTURE</div>
          <h1>
            Job dashboard<span className="heading-dot">.</span>
          </h1>
          <p>Every project, organised by company. Always up to date.</p>
        </div>
        <button className="button button-primary" onClick={() => newJob()}>
          <Plus size={17} />
          New job
        </button>
      </div>
      <div className="stats-grid stats-grid-5">
        <StatCard
          label="Total jobs"
          value={String(f.jobs)}
          type="jobs"
          note="Matching your filters"
        />
        <StatCard
          label="Total job value"
          value={money(f.revenue)}
          type="value"
          note="Original contracted value"
        />
        <div className="stat-card stat-expense-periods">
          <div className="stat-top">
            <span>Direct expenses</span>
            <span className="stat-icon expense">
              <ArrowUpRight size={17} />
            </span>
          </div>
          <div className="expense-period-split">
            <div>
              <span>This month</span>
              <strong>{money(monthDirect)}</strong>
            </div>
            <div>
              <span>This year</span>
              <strong>{money(yearDirect)}</strong>
            </div>
          </div>
        </div>
        <div className="stat-card stat-owner">
          <div className="stat-top">
            <span>Owner</span>
            <span className="stat-icon owner">
              <Users size={17} />
            </span>
          </div>
          <div className="stat-value">{money(ownerTotal)}</div>
          <div className="owner-share-note">
            Recorded owner costs
          </div>
        </div>
        <StatCard
          label="Balance"
          value={money(f.gross)}
          type="balance"
          note="Job value less direct expenses"
          accent
        />
      </div>
      <div className="filters-bar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search all jobs"
            placeholder="Search Job ID or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <SelectWrap>
          <select
            aria-label="Filter by company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option value={c.id} key={c.id}>
                {c.short}
              </option>
            ))}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select
            aria-label="Filter by work type"
            value={work}
            onChange={(e) => setWork(e.target.value)}
          >
            <option value="all">All work types</option>
            {[...new Set([...workTypes, ...w.jobs.map((j) => j.workType)])].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select
            aria-label="Filter by client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          >
            <option value="all">All clients</option>
            {w.clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </SelectWrap>
        <button
          className={`button ${showDates ? "button-selected" : ""}`}
          onClick={() => setShowDates(!showDates)}
        >
          <SlidersHorizontal size={15} />
          Dates
        </button>
        <button
          className="button"
          onClick={() =>
            exportCSV(
              "civilhub-filtered-jobs.csv",
              [
                "Job ID",
                "Company",
                "Client",
                "Work type",
                "Value RM",
                "Money in RM",
                "Still due RM",
                "Date",
                "Location",
              ],
              jobs.map((j) => [
                j.number,
                j.companyId,
                j.client,
                j.workType,
                (j.price / 100).toFixed(2),
                (sum(w.payments.filter((p) => p.jobId === j.id), (p) => p.amount) / 100).toFixed(2),
                (Math.max(0, j.price - sum(w.payments.filter((p) => p.jobId === j.id), (p) => p.amount)) / 100).toFixed(2),
                j.date,
                j.location,
              ]),
            )
          }
        >
          <Download size={15} />
          Export
        </button>
      </div>
      {showDates && (
        <div className="date-filters">
          <label>
            From
            <input
              aria-label="Jobs from date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              aria-label="Jobs to date"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {active && (
        <div className="filter-summary">
          <span>{jobs.length} matching jobs</span>
          <button
            className="text-button"
            onClick={() => {
              setCompany("all");
              setWork("all");
              setClient("all");
              setQuery("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters <X size={13} />
          </button>
        </div>
      )}
      <div className="company-groups">
        {companies
          .filter((c) => company === "all" || c.id === company)
          .map((c) => {
            const rows = jobs.filter((j) => j.companyId === c.id),
              isClosed = closed.includes(c.id);
            return (
              <section key={c.id} className="panel">
                <button
                  className="group-heading"
                  onClick={() =>
                    setClosed((a) =>
                      isClosed ? a.filter((x) => x !== c.id) : [...a, c.id],
                    )
                  }
                  aria-expanded={!isClosed}
                >
                  <CompanyMark {...c} small />
                  <h2>{c.name}</h2>
                  <span className="count">{rows.length} jobs</span>
                  <span className="spacer" />
                  <strong>
                    {money(rows.reduce((s, j) => s + j.price, 0))}
                  </strong>
                  <ChevronDown
                    size={18}
                    style={{ transform: isClosed ? "rotate(-90deg)" : "" }}
                  />
                </button>
                {!isClosed &&
                  (rows.length ? (
                    <JobsTable
                      jobs={rows}
                      payments={w.payments}
                      onPayment={setPaymentJob}
                      onView={viewJob}
                      searchable={false}
                      showCompany={false}
                    />
                  ) : (
                    <Empty
                      title="No jobs to show"
                      text={
                        active
                          ? "No jobs match your current filters."
                          : `Start a new job for ${c.short}.`
                      }
                      action={
                        !active ? (
                          <button
                            className="button button-small"
                            onClick={() => newJob(c.id)}
                          >
                            <Plus size={14} />
                            Register a job
                          </button>
                        ) : undefined
                      }
                    />
                  ))}
              </section>
            );
          })}
      </div>
    </div>
  );
}
