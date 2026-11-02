import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  FilePlus2,
  Plus,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useActions } from "../lib/actions";
import { companies, companyById } from "../lib/constants";
import { dateLabel, exportCSV, financials, money, sum } from "../lib/finance";
import { useWorkspace } from "../services/repository";
import { CompanyMark, StatCard } from "../components/ui";
import JobsTable from "../components/JobsTable";
export default function NewJob() {
  const w = useWorkspace(),
    { newJob, viewJob } = useActions(),
    f = financials(w.jobs, w.expenses, w.overheads);
  const chart = companies.map((c) => ({
    ...c,
    value: sum(
      w.jobs.filter((j) => j.companyId === c.id),
      (j) => j.price,
    ),
  }));
  function exportJobs() {
    exportCSV(
      "civilhub-jobs.csv",
      [
        "Job ID",
        "Company",
        "Work type",
        "Client",
        "Value (RM)",
        "Date",
        "Location",
        "Status",
      ],
      w.jobs.map((j) => [
        j.number,
        companyById(j.companyId).name,
        j.workType,
        j.client,
        (j.price / 100).toFixed(2),
        dateLabel(j.date),
        j.location,
        j.status,
      ]),
    );
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            YOUR CONSTRUCTION WORKSPACE
          </div>
          <h1>
            Good work starts here<span className="heading-dot">.</span>
          </h1>
          <p>Five companies. Every job. One clear picture.</p>
        </div>
        <div className="page-heading-actions">
          <button className="button" onClick={exportJobs}>
            <Download size={16} />
            Export jobs
          </button>
          <button className="button button-primary" onClick={() => newJob()}>
            <Plus size={17} />
            New job
          </button>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard
          label="Total registered jobs"
          value={String(f.jobs).padStart(2, "0")}
          note={`${w.jobs.filter((j) => j.status === "Active").length} jobs currently active`}
          type="jobs"
        />
        <StatCard
          label="Total job value"
          value={money(f.revenue)}
          note="Across all five companies"
          type="value"
        />
        <StatCard
          label="Direct job expenses"
          value={money(f.direct)}
          note="All recorded project costs"
          type="expense"
        />
        <StatCard
          label="Gross job balance"
          value={money(f.gross)}
          note={`${f.revenue ? ((f.gross / f.revenue) * 100).toFixed(1) : 0}% of registered job value`}
          type="balance"
          accent
        />
      </div>
      <section className="company-section">
        <div className="section-heading">
          <div>
            <h2>
              Choose a company <span className="count">05</span>
            </h2>
            <p>Select a company to register a new job.</p>
          </div>
          <span className="subtle-label">
            <Building2 size={14} />
            Your group of companies
          </span>
        </div>
        <div className="company-grid">
          {companies.map((c, i) => {
            const jobs = w.jobs.filter((j) => j.companyId === c.id);
            return (
              <button
                key={c.id}
                className={`company-card company-card-${i}`}
                onClick={() => newJob(c.id)}
                style={
                  {
                    "--company-color": c.color,
                    "--company-light": c.light,
                  } as React.CSSProperties
                }
              >
                <div className="company-card-top">
                  <CompanyMark {...c} />
                  <span className="company-arrow">
                    <ArrowUpRight size={17} />
                  </span>
                </div>
                <h3>{c.name}</h3>
                <div className="company-job-count">
                  <span className="mini-dot" />
                  {jobs.length} registered jobs
                </div>
                <div className="company-card-bottom">
                  <div>
                    <span>Total job value</span>
                    <strong>{money(sum(jobs, (j) => j.price))}</strong>
                  </div>
                  <span className="company-plus">
                    <Plus size={16} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <div className="main-split">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Recent jobs <span className="count">{w.jobs.length}</span>
              </h2>
              <p>The latest work across your companies.</p>
            </div>
            <Link to="/dashboard" className="text-link">
              View all jobs <ArrowUpRight size={14} />
            </Link>
          </div>
          <JobsTable jobs={w.jobs} onView={viewJob} pageSize={5} />
        </section>
        <aside className="insight-rail">
          <section className="panel portfolio-panel">
            <div className="panel-heading">
              <div>
                <h2>Company overview</h2>
                <p>Share of registered job value</p>
              </div>
              <span className="tiny-pill">All time</span>
            </div>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={177}>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={chart}
                    dataKey="value"
                    nameKey="short"
                    innerRadius={60}
                    outerRadius={77}
                    paddingAngle={4}
                    cornerRadius={5}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {chart.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => money(Number(v))}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #eceaf0",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span>Total job value</span>
                <strong>
                  {(f.revenue / 100_000_000).toFixed(2)}
                  <small>m</small>
                </strong>
                <span className="donut-currency">MYR</span>
              </div>
            </div>
            <div className="company-legend">
              {chart.map((c) => (
                <div key={c.id}>
                  <span
                    className="legend-dot"
                    style={{ background: c.color }}
                  />
                  <span>{c.short}</span>
                  <strong>
                    {f.revenue ? Math.round((c.value / f.revenue) * 100) : 0}%
                  </strong>
                </div>
              ))}
            </div>
            <Link to="/reports" className="insight-footer">
              Explore financial reports <ArrowRight size={15} />
            </Link>
          </section>
          <section className="quick-tip">
            <span className="tip-icon">
              <Sparkles size={18} />
            </span>
            <h3>Built for your next big job.</h3>
            <p>
              Keep invoices, costs and site details together. Your future self
              will thank you.
            </p>
            <button className="text-link" onClick={() => newJob()}>
              Register a job <ArrowRight size={14} />
            </button>
            <div className="tip-decoration" />
          </section>
        </aside>
      </div>
      <div className="workspace-footnote">
        <span>
          <span className="mini-dot" />
          All changes saved in this browser
        </span>
        <span>Values in MYR · Dates in DD/MM/YYYY · Kuala Lumpur time</span>
      </div>
    </div>
  );
}
