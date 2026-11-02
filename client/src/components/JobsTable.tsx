import {
  ArrowDown,
  ArrowUpDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Job } from "../lib/types";
import { companyById } from "../lib/constants";
import { dateLabel, money } from "../lib/finance";
import { CompanyMark, Empty, IconButton, Status } from "./ui";
export default function JobsTable({
  jobs,
  onView,
  pageSize = 6,
  searchable = true,
  showCompany = true,
}: {
  jobs: Job[];
  onView: (id: string) => void;
  pageSize?: number;
  searchable?: boolean;
  showCompany?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [sort, setSort] = useState<"date" | "price" | "number">("date"),
    [asc, setAsc] = useState(false);
  const filtered = useMemo(
    () =>
      jobs
        .filter((j) =>
          `${j.number} ${j.workType} ${j.client} ${j.location} ${companyById(j.companyId).name}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          const v =
            sort === "price"
              ? a.price - b.price
              : sort === "date"
                ? a.date.localeCompare(b.date)
                : a.number.localeCompare(b.number);
          return asc ? v : -v;
        }),
    [jobs, query, sort, asc],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages),
    rows = filtered.slice((current - 1) * pageSize, current * pageSize);
  function toggle(s: typeof sort) {
    if (sort === s) setAsc(!asc);
    else {
      setSort(s);
      setAsc(false);
    }
  }
  return (
    <>
      {searchable && (
        <div className="table-search">
          <Search size={16} />
          <input
            aria-label="Search jobs"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search jobs, clients or locations…"
          />
        </div>
      )}
      <div className="table-scroll">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>
                <button onClick={() => toggle("number")}>
                  Job / Work type <ArrowUpDown size={12} />
                </button>
              </th>
              {showCompany && <th>Company</th>}
              <th>Client</th>
              <th>
                <button onClick={() => toggle("date")}>
                  Date{" "}
                  {sort === "date" ? (
                    <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} />
                  )}
                </button>
              </th>
              <th className="amount">
                <button onClick={() => toggle("price")}>
                  Job value <ArrowUpDown size={12} />
                </button>
              </th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} onClick={() => onView(j.id)}>
                <td>
                  <button
                    className="job-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(j.id);
                    }}
                  >
                    {j.number}
                  </button>
                  <span className="table-secondary">
                    {j.workType === "Traffic Management Plan (TMP)"
                      ? "Traffic Management"
                      : j.workType}
                  </span>
                </td>
                {showCompany && (
                  <td>
                    <span className="company-cell">
                      <CompanyMark {...companyById(j.companyId)} small />
                      <span>{companyById(j.companyId).short}</span>
                    </span>
                  </td>
                )}
                <td>{j.client}</td>
                <td className="date-cell">{dateLabel(j.date)}</td>
                <td className="amount cell-money">{money(j.price)}</td>
                <td>
                  <Status status={j.status} />
                </td>
                <td>
                  <IconButton
                    label={`View ${j.number}`}
                    onClick={() => onView(j.id)}
                  >
                    <ArrowUpRight size={16} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <Empty
          title="No matching jobs"
          text="Try a different search or register your first job."
        />
      )}
      <div className="table-footer">
        <span>
          Showing{" "}
          <strong>
            {filtered.length ? (current - 1) * pageSize + 1 : 0}–
            {Math.min(current * pageSize, filtered.length)}
          </strong>{" "}
          of <strong>{filtered.length}</strong> jobs
        </span>
        <div className="pagination">
          <IconButton
            label="Previous page"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={16} />
          </IconButton>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pages || Math.abs(p - current) <= 1)
            .map((p, i, a) => (
              <span key={p}>
                {i > 0 && p - a[i - 1] > 1 && (
                  <span className="page-ellipsis">…</span>
                )}
                <button
                  className={p === current ? "page-active" : ""}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              </span>
            ))}
          <IconButton
            label="Next page"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>
    </>
  );
}
