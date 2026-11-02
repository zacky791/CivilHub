import { useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HardHat,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { companies } from "../lib/constants";
import { createSupabaseClient } from "../services/supabase";
import { useAuth } from "../services/auth";
import { CompanyMark, IconButton, Logo } from "./ui";
function Frame({ children }: { children: ReactNode }) {
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
          <ShieldCheck size={12} />
          Secure workspace
        </span>
        <div className="login-form">{children}</div>
        <span className="login-footer">
          Your password and session are protected by Supabase Auth.
        </span>
      </div>
    </div>
  );
}
function Password({
  name = "password",
  label = "Password",
  confirm = false,
  minLength,
}: {
  name?: string;
  label?: string;
  confirm?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <div className="password-field">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={128}
          autoComplete={
            confirm || minLength ? "new-password" : "current-password"
          }
        />
        <IconButton
          label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </IconButton>
      </div>
    </label>
  );
}
const redirectTo = () => `${window.location.origin}/auth/callback`;
export function AuthScreen() {
  const location = useLocation(),
    navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(
      params.get("setup") === "1" ? "signup" : "login",
    ),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(params.get("email") ?? "");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      f = new FormData(form),
      password = String(f.get("password") ?? "");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = createSupabaseClient();
      if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirectTo() },
        );
        if (error) throw new Error(error.message);
        setMessage(
          "If this email has an account, a password-reset link has been sent. Open it, then choose a new password.",
        );
      } else if (mode === "signup") {
        if (password !== String(f.get("confirmPassword")))
          throw new Error("The passwords do not match.");
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: String(f.get("name")).trim() },
            emailRedirectTo: redirectTo(),
          },
        });
        if (error) throw new Error(error.message);
        if (data.session) navigate("/");
        else {
          form.reset();
          setMessage(
            "Check your inbox and confirm your email address. Then return here and sign in. Your admin workspace will be created after verification.",
          );
          setMode("login");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error(error.message);
        navigate("/");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setError("");
    setMessage("");
  }
  return (
    <Frame>
      <h2>
        {mode === "signup"
          ? "Set up your account."
          : mode === "forgot"
            ? "Reset your password."
            : "Welcome back."}
      </h2>
      <p>
        {mode === "signup"
          ? "Create your administrator login. Verify your email to finish setup."
          : mode === "forgot"
            ? "We’ll email a link to help you get back in."
            : "Sign in to your construction workspace."}
      </p>
      {message && (
        <div className="auth-success" role="status">
          <CheckCircle2 size={17} />
          <span>{message}</span>
        </div>
      )}
      <form key={mode} onSubmit={submit}>
        {mode === "signup" && (
          <label>
            Full name
            <input
              name="name"
              required
              maxLength={160}
              autoComplete="name"
              placeholder="Your full name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            autoComplete="username"
            placeholder="you@company.com"
          />
        </label>
        {mode !== "forgot" && (
          <Password minLength={mode === "signup" ? 12 : undefined} />
        )}{" "}
        {mode === "signup" && (
          <>
            <Password
              name="confirmPassword"
              label="Confirm password"
              confirm
              minLength={12}
            />
            <p className="auth-hint">
              Use at least 12 characters. Only an approved, verified
              administrator can create the first workspace.
            </p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Send reset link"
                : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
      <div className="auth-links">
        {mode === "login" ? (
          <>
            <button
              className="text-button"
              onClick={() => changeMode("forgot")}
            >
              Forgot password?
            </button>
            <button
              className="text-button"
              onClick={() => changeMode("signup")}
            >
              First-time administrator setup
            </button>
          </>
        ) : (
          <button className="text-button" onClick={() => changeMode("login")}>
            Back to sign in
          </button>
        )}
      </div>
    </Frame>
  );
}
export function WorkspaceSetup() {
  const auth = useAuth(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { error } = await createSupabaseClient().rpc(
        "create_construction_workspace",
        { workspace_name: String(f.get("workspaceName")).trim() },
      );
      if (error) throw new Error(error.message);
      auth.reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to create the workspace.",
      );
      setBusy(false);
    }
  }
  return (
    <Frame>
      <h2>Your workspace starts here.</h2>
      <p>
        Signed in as {auth.session?.user.email}. Create your construction group
        to finish administrator setup.
      </p>
      <form onSubmit={submit}>
        <label>
          Workspace name
          <input
            name="workspaceName"
            defaultValue="Construction group"
            required
            maxLength={120}
          />
        </label>
        <div className="setup-company-list">
          {companies.map((c) => (
            <span key={c.id}>
              <CompanyMark {...c} small />
              {c.short}
            </span>
          ))}
        </div>
        <p className="auth-hint">
          Your five company records and the Sunway client will be created.
          Financial records start empty.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "Creating workspace…" : "Create workspace"}
          <ArrowRight size={17} />
        </button>
      </form>
      <div className="auth-links">
        <button className="text-button" onClick={() => void auth.signOut()}>
          Use another account
        </button>
      </div>
    </Frame>
  );
}
export function PasswordRecovery() {
  const auth = useAuth(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const password = String(f.get("password"));
      if (password !== String(f.get("confirmPassword")))
        throw new Error("The passwords do not match.");
      const { error } = await createSupabaseClient().auth.updateUser({
        password,
      });
      if (error) throw new Error(error.message);
      await auth.signOut();
      navigate("/login");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update the password.",
      );
      setBusy(false);
    }
  }
  return (
    <Frame>
      <h2>Choose a new password.</h2>
      <p>
        Use at least 12 characters. After saving, sign in with your new
        password.
      </p>
      <form onSubmit={submit}>
        <Password minLength={12} />
        <Password
          name="confirmPassword"
          label="Confirm password"
          confirm
          minLength={12}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary" type="submit" disabled={busy}>
          <LockKeyhole size={16} />
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </Frame>
  );
}
