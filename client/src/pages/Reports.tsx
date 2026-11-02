import { Download, Printer, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { companies, workTypes } from "../lib/constants";
import {
  dateLabel,
  exportCSV,
  financials,
  jobExpense,
  money,
  sum,
  today,
} from "../lib/finance";
import { useWorkspace } from "../services/repository";
import { CompanyMark, Empty, SelectWrap, StatCard } from "../components/ui";
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #ebe8f1",
  boxShadow: "0 8px 30px #2015400a",
  fontSize: 12,
};
const axisMoney = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}m`
    : v >= 1000
      ? `${Math.round(v / 1000)}k`
      : String(v);
export default function Reports() {
  const w = useWorkspace(),
    [company, setCompany] = useState("all"),
    [work, setWork] = useState("all"),
    [month, setMonth] = useState("all"),
    [year, setYear] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const inPeriod = (date: string) =>
    (month === "all" || date.slice(5, 7) === month) &&
    (year === "all" || date.slice(0, 4) === year) &&
    (!from || date >= from) &&
    (!to || date <= to);
  const jobs = w.jobs.filter(
    (j) =>
      (company === "all" || j.companyId === company) &&
      (work === "all" || j.workType === work) &&
      inPeriod(j.date),
  );
  const expenses = w.expenses.filter((e) => inPeriod(e.date));
  const overheads = w.overheads.filter(
    (o) => (company === "all" || o.companyId === company) && inPeriod(o.date),
  );
  const f = financials(jobs, expenses, overheads);
  const data = companies
    .filter((c) => company === "all" || c.id === company)
    .map((c) => {
      const rows = jobs.filter((j) => j.companyId === c.id),
        revenue = sum(rows, (j) => j.price),
        direct = sum(rows, (j) => jobExpense(j.id, expenses)),
        overhead = sum(
          overheads.filter((o) => o.companyId === c.id),
          (o) => o.amount,
        );
      return {
        ...c,
        revenue: revenue / 100,
        expenses: direct / 100,
        balance: (revenue - direct) / 100,
        overhead: overhead / 100,
        jobs: rows.length,
        net: (revenue - direct - overhead) / 100,
      };
    });
  const periods = [...new Set(jobs.map((j) => j.date.slice(0, 7)))].sort();
  const trend = periods.map((p) => ({
    name: new Date(`${p}-15T12:00:00`).toLocaleDateString("en-MY", {
      month: "short",
      year: year === "all" ? "2-digit" : undefined,
    }),
    value:
      sum(
        jobs.filter((j) => j.date.startsWith(p)),
        (j) => j.price,
      ) / 100,
    expense:
      sum(
        expenses.filter(
          (e) => e.date.startsWith(p) && jobs.some((j) => j.id === e.jobId),
        ),
        (e) => e.amount,
      ) / 100,
  }));
  const years = [
    ...new Set([
      today().slice(0, 4),
      ...w.jobs.map((j) => j.date.slice(0, 4)),
      ...w.overheads.map((o) => o.date.slice(0, 4)),
    ]),
  ]
    .sort()
    .reverse();
  const active =
    company !== "all" ||
    work !== "all" ||
    month !== "all" ||
    year !== "all" ||
    from ||
    to;
  function exportReport() {
    const rows: (string | number)[][] = data.map((c) => [
      c.name,
      c.jobs,
      c.revenue.toFixed(2),
      c.expenses.toFixed(2),
      c.overhead.toFixed(2),
      c.net.toFixed(2),
    ]);
    if (company === "all") {
      const shared =
        sum(
          overheads.filter((o) => o.companyId === "shared"),
          (o) => o.amount,
        ) / 100;
      rows.push([
        "Shared / General",
        0,
        "0.00",
        "0.00",
        shared.toFixed(2),
        (-shared).toFixed(2),
      ]);
    }
    rows.push([
      "TOTAL",
      f.jobs,
      (f.revenue / 100).toFixed(2),
      (f.direct / 100).toFixed(2),
      (f.overhead / 100).toFixed(2),
      (f.net / 100).toFixed(2),
    ]);
    exportCSV(
      "civilhub-financial-report.csv",
      [
        "Company",
        "Jobs",
        "Contracted value RM",
        "Direct expenses RM",
        "Overhead RM",
        "Estimated net RM",
      ],
      rows,
    );
  }
  return (
    <div className="page-enter reports-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM NUMBERS TO CLARITY</div>
          <h1>
            Financial reports<span className="heading-dot">.</span>
          </h1>
          <p>A clearer view of how your companies are performing.</p>
        </div>
        <div className="page-heading-actions">
          <button className="button" onClick={() => window.print()}>
            <Printer size={16} />
            Print report
          </button>
          <button className="button button-primary" onClick={exportReport}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>
      <div className="filters-bar report-filters">
        <SelectWrap>
          <select
            aria-label="Report company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select
            aria-label="Report month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="all">All months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={String(i + 1).padStart(2, "0")}>
                {new Date(2026, i, 1).toLocaleDateString("en-MY", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select
            aria-label="Report year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select
            aria-label="Report work type"
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
        <label className="compact-date">
          From
          <input
            type="date"
            aria-label="Report from date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="compact-date">
          To
          <input
            type="date"
            aria-label="Report to date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {active && (
          <button
            className="text-button"
            onClick={() => {
              setCompany("all");
              setWork("all");
              setMonth("all");
              setYear("all");
              setFrom("");
              setTo("");
            }}
          >
            <X size={13} />
            Clear
          </button>
        )}
      </div>
      <div className="stats-grid">
        <StatCard
          label="Total job value"
          value={money(f.revenue)}
          note={`${f.jobs} jobs in this view`}
          type="value"
        />
        <StatCard
          label="Total direct expenses"
          value={money(f.direct)}
          note="Recorded costs in selected period"
          type="expense"
        />
        <StatCard
          label="Total overhead costs"
          value={money(f.overhead)}
          note={
            company === "all"
              ? "Includes shared business costs"
              : "Company-assigned costs only"
          }
          type="jobs"
        />
        <StatCard
          label="Estimated net profit"
          value={money(f.net)}
          note={`${f.revenue ? ((f.net / f.revenue) * 100).toFixed(1) : "0"}% estimated net margin`}
          type="balance"
          accent
        />
      </div>
      {!jobs.length && !overheads.length ? (
        <section className="panel">
          <Empty
            title="No data for this period"
            text="Try another date range or company to see your financial picture."
          />
        </section>
      ) : (
        <>
          <div className="report-chart-grid">
            <section className="panel report-pie">
              <div className="panel-heading">
                <div>
                  <h2>Job value by company</h2>
                  <p>Each company’s share of the bigger picture.</p>
                </div>
                <span className="tiny-pill">MYR</span>
              </div>
              {f.revenue > 0 ? (
                <>
                  <div className="report-donut">
                    <ResponsiveContainer width="100%" height={245}>
                      <PieChart>
                        <Pie
                          isAnimationActive={false}
                          data={data}
                          dataKey="revenue"
                          nameKey="name"
                          innerRadius={77}
                          outerRadius={102}
                          paddingAngle={4}
                          cornerRadius={6}
                          stroke="none"
                          startAngle={90}
                          endAngle={-270}
                        >
                          {data.map((c) => (
                            <Cell key={c.id} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => money(Number(v) * 100)}
                          contentStyle={tooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <span>Contracted value</span>
                      <strong>
                        {(f.revenue / 100_000_000).toFixed(2)}
                        <small>m</small>
                      </strong>
                      <span className="donut-currency">MYR</span>
                    </div>
                  </div>
                  <div className="report-legend">
                    {data.map((c) => (
                      <div key={c.id}>
                        <span
                          className="legend-dot"
                          style={{ background: c.color }}
                        />
                        <span>{c.short}</span>
                        <strong>{money(c.revenue * 100)}</strong>
                        <small>
                          {f.revenue
                            ? (((c.revenue * 100) / f.revenue) * 100).toFixed(1)
                            : 0}
                          %
                        </small>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty
                  title="No job value"
                  text="No registered jobs match these filters."
                />
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Job value vs. expenses</h2>
                  <p>Registered value and direct costs by company.</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={335}>
                  <BarChart
                    data={data}
                    barGap={6}
                    barSize={24}
                    margin={{ top: 12, right: 18, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="#eeeaf4"
                    />
                    <XAxis
                      dataKey="short"
                      tick={{ fontSize: 11, fill: "#918b9e" }}
                      axisLine={false}
                      tickLine={false}
                      dy={9}
                    />
                    <YAxis
                      tickFormatter={axisMoney}
                      tick={{ fontSize: 11, fill: "#918b9e" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(v) => money(Number(v) * 100)}
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "#f8f6fc" }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
                    />
                    <Bar
                      dataKey="revenue"
                      name="Job value"
                      fill="#8058ef"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      dataKey="expenses"
                      name="Direct expenses"
                      fill="#d9ccfb"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Monthly job value</h2>
                  <p>How registered work has changed over time.</p>
                </div>
                <TrendingUp size={18} className="text-purple" />
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={trend}
                    margin={{ top: 15, right: 20, left: 0, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient
                        id="trendFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#8860f0"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#8860f0"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="#eeeaf4"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#918b9e" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={axisMoney}
                      tick={{ fontSize: 11, fill: "#918b9e" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(v) => money(Number(v) * 100)}
                      contentStyle={tooltipStyle}
                    />
                    <Area
                      dataKey="value"
                      name="Job value"
                      stroke="#8058ef"
                      strokeWidth={3}
                      fill="url(#trendFill)"
                      dot={{ r: 4, fill: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Profitability by company</h2>
                  <p>Job value less direct expenses, before overhead.</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 10, right: 25, left: 15, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 5"
                      horizontal={false}
                      stroke="#eeeaf4"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={axisMoney}
                      tick={{ fontSize: 11, fill: "#918b9e" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="short"
                      tick={{ fontSize: 11, fill: "#777180" }}
                      axisLine={false}
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip
                      formatter={(v) => money(Number(v) * 100)}
                      contentStyle={tooltipStyle}
                    />
                    <Bar
                      dataKey="balance"
                      name="Gross job balance"
                      radius={[0, 5, 5, 0]}
                      barSize={19}
                    >
                      {data.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="panel report-table">
            <div className="panel-heading">
              <div>
                <h2>The numbers, together</h2>
                <p>Company-level financial summary.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Jobs</th>
                    <th className="amount">Job value</th>
                    <th className="amount">Direct expenses</th>
                    <th className="amount">Overhead</th>
                    <th className="amount">Estimated net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="company-cell">
                          <CompanyMark {...c} small />
                          {c.short}
                        </span>
                      </td>
                      <td>{c.jobs}</td>
                      <td className="amount">{money(c.revenue * 100)}</td>
                      <td className="amount">{money(c.expenses * 100)}</td>
                      <td className="amount">{money(c.overhead * 100)}</td>
                      <td
                        className={`amount cell-money ${c.net < 0 ? "text-rose" : "text-green"}`}
                      >
                        {money(c.net * 100)}
                      </td>
                    </tr>
                  ))}
                  {company === "all" && (
                    <tr>
                      <td>Shared / General</td>
                      <td>—</td>
                      <td className="amount">—</td>
                      <td className="amount">—</td>
                      <td className="amount">
                        {money(
                          sum(
                            overheads.filter((o) => o.companyId === "shared"),
                            (o) => o.amount,
                          ),
                        )}
                      </td>
                      <td className="amount text-rose">
                        {money(
                          -sum(
                            overheads.filter((o) => o.companyId === "shared"),
                            (o) => o.amount,
                          ),
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Consolidated total</td>
                    <td>{f.jobs}</td>
                    <td className="amount">{money(f.revenue)}</td>
                    <td className="amount">{money(f.direct)}</td>
                    <td className="amount">{money(f.overhead)}</td>
                    <td className="amount">{money(f.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
      <div className="report-disclaimer">
        <p>
          Job value is contracted value, rather than cash received. Net profit
          is an estimate after direct expenses and overheads.
        </p>
        <p>
          Dates filter registered jobs and their expense entries. Company views
          exclude unallocated shared costs; group totals include shared costs
          once. Work-type filters apply to jobs and direct costs; overhead stays
          company-wide.
        </p>
      </div>
    </div>
  );
}
