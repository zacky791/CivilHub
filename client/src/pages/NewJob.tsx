import { ArrowUpRight, Download, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useActions } from "../lib/actions";
import { companies, companyById } from "../lib/constants";
import { dateLabel, exportCSV, money, sum } from "../lib/finance";
import { useWorkspace, isDemoMode } from "../services/repository";
import { CompanyMark } from "../components/ui";
import JobsTable from "../components/JobsTable";
export default function NewJob() {
  const w = useWorkspace(),
    { newJob, viewJob } = useActions();
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
            Choose a company <span className="count">05</span>
          </h1>
          <p>Select a company to register a new job.</p>
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
      <section className="company-section">
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
      <div>
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
      </div>
      <div className="workspace-footnote">
        <span>
          <span className="mini-dot" />
          {isDemoMode
            ? "All changes saved in this browser"
            : "Records saved to your private workspace"}
        </span>
        <span>Values in MYR · Dates in DD/MM/YYYY · Kuala Lumpur time</span>
      </div>
    </div>
  );
}
