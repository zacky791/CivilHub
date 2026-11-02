import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  ChartNoAxesCombined,
} from "lucide-react";
import { ActionsContext } from "./lib/actions";
import { companies, companyById } from "./lib/constants";
import type { CompanyId, Job } from "./lib/types";
import { dateLabel, download } from "./lib/finance";
import { repository, useWorkspace } from "./services/repository";
import { clearFiles } from "./services/files";
import {
  CompanyMark,
  Empty,
  errorMessage,
  IconButton,
  Logo,
  Modal,
  useToast,
} from "./components/ui";
import JobForm, { CompanyChooser } from "./components/JobForm";
import JobDetails from "./components/JobDetails";
import NewJob from "./pages/NewJob";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Overheads = lazy(() => import("./pages/Overheads"));
const navigation = [
  { path: "/", label: "New job", icon: FilePlus2 },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/expenses", label: "Expenses", icon: ReceiptText },
  { path: "/reports", label: "Reports", icon: ChartNoAxesCombined },
  { path: "/overheads", label: "Overhead costs", icon: Wallet },
];
function Login({ onLogin }: { onLogin: () => void }) {
  const [show, setShow] = useState(false),
    [error, setError] = useState("");
  const navigate = useNavigate();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      String(f.get("email")).toLowerCase() !== "demo@civilhub.my" ||
      f.get("password") !== "civilhub123"
    ) {
      setError("Use the demo credentials shown below.");
      return;
    }
    onLogin();
    navigate("/");
  }
  return (
    <div className="login-page">
      <div className="login-visual">
        <Logo />
        <div className="login-copy">
          <span className="eyebrow">MADE FOR THE WAY YOU BUILD</span>
          <h1>
            A solid foundation
            <br />
            for every job<span>.</span>
          </h1>
          <p>
            Your companies, projects and finances.
            <br />
            Finally, all in one place.
          </p>
          <div className="login-companies">
            {companies.map((c) => (
              <CompanyMark key={c.id} {...c} />
            ))}
          </div>
        </div>
        <div className="login-visual-footer">
          <HardHat size={17} />
          Built for Malaysian construction businesses.
        </div>
        <div className="login-grid" />
      </div>
      <div className="login-form-area">
        <span className="demo-badge">
          <span />
          Interactive demo
        </span>
        <div className="login-form">
          <h2>Welcome back.</h2>
          <p>Let’s get your next great project moving.</p>
          <form onSubmit={submit}>
            <label>
              Email or username
              <input
                type="email"
                name="email"
                defaultValue="demo@civilhub.my"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  defaultValue="civilhub123"
                  required
                  autoComplete="current-password"
                />
                <IconButton
                  label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </IconButton>
              </div>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="button button-primary">
              Enter workspace <ArrowRight size={17} />
            </button>
          </form>
        </div>
        <span className="login-footer">
          © 2026 CivilHub. Built to bring it all together.
        </span>
      </div>
    </div>
  );
}
export default function App() {
  const w = useWorkspace(),
    toast = useToast(),
    location = useLocation(),
    navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(
    () => sessionStorage.getItem("civilhub:demo-session") !== "signed-out",
  );
  const [sidebar, setSidebar] = useState(false),
    [chooser, setChooser] = useState(false),
    [form, setForm] = useState<{ companyId: CompanyId; job?: Job } | null>(
      null,
    ),
    [detail, setDetail] = useState<string | null>(null),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false),
    [seen, setSeen] = useState(
      () => sessionStorage.getItem("civilhub:seen") === "yes",
    ),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [reset, setReset] = useState<"demo" | "empty" | null>(null),
    [resetting, setResetting] = useState(false);
  useEffect(() => {
    setSidebar(false);
    setNotifications(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const title =
    navigation.find((n) => n.path === location.pathname)?.label ?? "Workspace";
  function newJob(companyId?: CompanyId) {
    if (companyId) setForm({ companyId });
    else setChooser(true);
  }
  function logout() {
    sessionStorage.setItem("civilhub:demo-session", "signed-out");
    setLoggedIn(false);
    setSettings(false);
    setHelp(false);
    setNotifications(false);
    setDetail(null);
    setForm(null);
    setChooser(false);
    setSearch(false);
    navigate("/login");
  }
  function login() {
    sessionStorage.setItem("civilhub:demo-session", "active");
    setLoggedIn(true);
  }
  const searchResults = w.jobs
    .filter((j) =>
      `${j.number} ${j.client} ${j.workType} ${j.location} ${companyById(j.companyId).name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 8);
  if (location.pathname === "/login") return <Login onLogin={login} />;
  if (!loggedIn) return <Navigate to="/login" replace />;
  return (
    <ActionsContext.Provider value={{ newJob, viewJob: setDetail }}>
      <div className="app-shell">
        {sidebar && (
          <button
            aria-label="Close navigation"
            className="sidebar-overlay"
            onClick={() => setSidebar(false)}
          />
        )}
        <aside className={`sidebar ${sidebar ? "sidebar-open" : ""}`}>
          <NavLink to="/" className="brand-link" aria-label="CivilHub home">
            <Logo />
          </NavLink>
          <div className="nav-eyebrow">WORKSPACE</div>
          <nav>
            {navigation.map((n) => (
              <NavLink
                key={n.path}
                to={n.path}
                end={n.path === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "nav-active" : ""}`
                }
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.path === "/" ? (
                  <Plus size={15} className="nav-end" />
                ) : n.path === "/dashboard" ? (
                  <span className="nav-count">{w.jobs.length}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-companies">
            <div className="nav-eyebrow">
              YOUR COMPANIES <span>05</span>
            </div>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  navigate(`/dashboard?company=${c.id}`);
                  setSidebar(false);
                }}
              >
                <span className="legend-dot" style={{ background: c.color }} />
                <span>{c.short}</span>
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <div className="user-profile">
              <span className="avatar">ZA</span>
              <div>
                <strong>Zakaria</strong>
                <small>Workspace admin</small>
              </div>
              <IconButton label="Log out" onClick={logout}>
                <LogOut size={17} />
              </IconButton>
            </div>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <div className="topbar-left">
              <IconButton
                className="mobile-menu"
                label="Open navigation"
                onClick={() => setSidebar(true)}
              >
                <Menu size={21} />
              </IconButton>
              <span className="breadcrumb-home">
                <Building2 size={15} />
                Workspace
              </span>
              <ChevronRight size={13} />
              <span className="breadcrumb-current">{title}</span>
            </div>
            <div className="topbar-right">
              <span className="demo-badge">
                <span />
                Demo workspace
              </span>
              <span className="topbar-divider" />
              <button
                className="global-search"
                onClick={() => setSearch(true)}
                aria-label="Search workspace"
              >
                <Search size={18} />
                <kbd>⌘ K</kbd>
              </button>
              <div className="notification-container">
                <IconButton
                  label="Notifications"
                  className={`notification-button ${!seen ? "has-notifications" : ""}`}
                  onClick={() => {
                    setNotifications(!notifications);
                    setSeen(true);
                    sessionStorage.setItem("civilhub:seen", "yes");
                  }}
                >
                  <Bell size={19} />
                </IconButton>
                {notifications && (
                  <div className="notification-popover">
                    <div className="section-heading">
                      <h3>Workspace activity</h3>
                      <span className="count">{w.activities.length}</span>
                    </div>
                    {w.activities.length ? (
                      w.activities.slice(0, 5).map((a) => (
                        <div className="activity-row" key={a.id}>
                          <span className={`activity-icon ${a.kind}`}>
                            {a.kind === "job" ? (
                              <BriefcaseBusiness size={15} />
                            ) : a.kind === "expense" ? (
                              <ReceiptText size={15} />
                            ) : (
                              <Wallet size={15} />
                            )}
                          </span>
                          <div>
                            <strong>{a.title}</strong>
                            <p>{a.detail}</p>
                            <small>{dateLabel(a.createdAt)}</small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        Your recent activity appears here.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                className="top-avatar avatar"
                onClick={() => setSettings(true)}
                aria-label="Account settings"
              >
                ZA
              </button>
            </div>
          </header>
          <main>
            <Suspense
              fallback={
                <div className="page-skeleton">
                  <div className="skeleton" />
                  <div className="stats-grid">
                    {[1, 2, 3, 4].map((i) => (
                      <div className="skeleton" key={i} />
                    ))}
                  </div>
                  <div className="skeleton" />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<NewJob />} />
                <Route
                  path="/dashboard"
                  element={<Dashboard key={location.search} />}
                />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/overheads" element={<Overheads />} />
                <Route
                  path="*"
                  element={
                    <div className="panel">
                      <Empty
                        title="This page isn’t on the plan"
                        text="Head back to your workspace to keep building."
                        action={
                          <button
                            className="button button-primary"
                            onClick={() => navigate("/")}
                          >
                            Back to workspace
                          </button>
                        }
                      />
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
      {chooser && (
        <CompanyChooser
          onClose={() => setChooser(false)}
          onSelect={(companyId) => {
            setChooser(false);
            setForm({ companyId });
          }}
        />
      )}
      {form && (
        <JobForm
          companyId={form.companyId}
          job={form.job}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {detail && !form && (
        <JobDetails
          id={detail}
          onClose={() => setDetail(null)}
          onEdit={(job) => {
            setDetail(null);
            setForm({ companyId: job.companyId, job });
          }}
        />
      )}
      {search && (
        <Modal
          title="Find anything in your workspace"
          subtitle="Search jobs by ID, company, client, work type or location."
          onClose={() => {
            setSearch(false);
            setQuery("");
          }}
        >
          <div className="modal-body">
            <div className="search-field command-search">
              <Search size={19} />
              <input
                autoFocus
                placeholder="Search your jobs…"
                aria-label="Search workspace jobs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="search-results">
              {searchResults.map((j) => (
                <button
                  key={j.id}
                  onClick={() => {
                    setSearch(false);
                    setQuery("");
                    setDetail(j.id);
                  }}
                >
                  <CompanyMark {...companyById(j.companyId)} small />
                  <span>
                    <strong>
                      {j.number} · {j.workType}
                    </strong>
                    <small>
                      {j.client} · {j.location}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!searchResults.length && (
                <Empty
                  title="No jobs found"
                  text="Try a company name, client or job number."
                />
              )}
            </div>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal
          title="Workspace settings"
          subtitle="A place for everything that keeps your workspace running."
          onClose={() => setSettings(false)}
        >
          <div className="modal-body">
            <div className="settings-profile">
              <span className="avatar">ZA</span>
              <div>
                <strong>Zakaria</strong>
                <p>Workspace administrator</p>
              </div>
              <span className="tiny-pill">
                <ShieldCheck size={12} />
                Admin
              </span>
            </div>
            <div className="settings-info">
              <div>
                <span>Workspace</span>
                <strong>Construction group</strong>
              </div>
              <div>
                <span>Currency</span>
                <strong>Malaysian Ringgit (MYR)</strong>
              </div>
              <div>
                <span>Timezone</span>
                <strong>Asia/Kuala_Lumpur</strong>
              </div>
              <div>
                <span>Date format</span>
                <strong>DD/MM/YYYY</strong>
              </div>
              <div>
                <span>Data storage</span>
                <strong>This browser · Demo mode</strong>
              </div>
            </div>
            <div className="demo-settings-note">
              <Sparkles size={18} />
              <p>
                This is your interactive demo. Your changes and attachments stay
                on this device. Supabase, real authentication and team access
                will be connected in the integration phase.
              </p>
            </div>
            <div className="settings-actions">
              <button
                className="button"
                onClick={() => {
                  download(
                    new Blob([JSON.stringify(w, null, 2)], {
                      type: "application/json",
                    }),
                    "civilhub-demo-data.json",
                  );
                  toast(
                    "Demo data exported. Attachment files are downloaded separately.",
                  );
                }}
              >
                <Download size={15} />
                Export demo records
              </button>
              <small>
                Exports records and attachment metadata. Download files
                individually from each record.
              </small>
              <div className="panel-divider" />
              <button onClick={() => setReset("demo")} className="button">
                Restore sample workspace
              </button>
              <button
                onClick={() => setReset("empty")}
                className="button button-ghost text-rose"
              >
                Start with an empty workspace
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={logout}>
              <LogOut size={15} />
              Log out of demo
            </button>
            <button
              className="button button-primary"
              onClick={() => setSettings(false)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal
          title={
            reset === "demo"
              ? "Restore the sample workspace?"
              : "Start with a clean slate?"
          }
          subtitle="This replaces the demo records saved in this browser."
          onClose={() => setReset(null)}
        >
          <div className="modal-body">
            <p>
              Your current jobs, costs and attachments will be removed. Export
              anything you want to keep before continuing.
            </p>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => setReset(null)}>
              Cancel
            </button>
            <button
              className="button button-danger"
              disabled={resetting}
              onClick={async () => {
                setResetting(true);
                try {
                  await clearFiles();
                  repository.reset(reset === "empty");
                  setReset(null);
                  setSettings(false);
                  setDetail(null);
                  toast(
                    reset === "demo"
                      ? "Sample workspace restored"
                      : "Your empty workspace is ready",
                  );
                  navigate("/");
                } catch (e) {
                  toast(errorMessage(e), true);
                } finally {
                  setResetting(false);
                }
              }}
            >
              {resetting
                ? "Resetting…"
                : reset === "demo"
                  ? "Restore samples"
                  : "Start empty"}
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="Your quick guide to CivilHub"
          subtitle="From the first job to the final ringgit."
          onClose={() => setHelp(false)}
        >
          <div className="modal-body quick-guide">
            {[
              {
                icon: Building2,
                title: "Start with your company",
                text: "On New job, select a company card. Add the work type, client, value, date and location, then save.",
              },
              {
                icon: BriefcaseBusiness,
                title: "Keep the details together",
                text: "Open a job from the dashboard to edit it or attach invoices, receipts and supporting documents.",
              },
              {
                icon: ReceiptText,
                title: "Track every direct cost",
                text: "Choose a job in Expenses. Add costs and watch the remaining balance update without changing the original job value.",
              },
              {
                icon: Wallet,
                title: "See the whole business",
                text: "Record general operating costs in Overhead costs. Reports combine jobs, direct costs and overheads into a financial picture.",
              },
            ].map((s, i) => (
              <div key={s.title}>
                <span className="guide-number">0{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
            <div className="demo-settings-note">
              <Sparkles size={18} />
              <p>
                Try editing the sample records. Everything saves in this
                browser. You can restore the sample workspace in Settings
                whenever you like.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="button button-primary"
              onClick={() => setHelp(false)}
            >
              Let’s get building <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </ActionsContext.Provider>
  );
}
