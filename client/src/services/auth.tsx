import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useLocation, Navigate } from "react-router-dom";
import { createSupabaseClient } from "./supabase";
import {
  isDemoMode,
  isSupabaseConfigured,
  refreshWorkspace,
} from "./repository";
import {
  clearCloudWorkspace,
  initializeCloudWorkspace,
  type CloudIdentity,
} from "./cloud-repository";
import {
  AuthScreen,
  PasswordRecovery,
  WorkspaceSetup,
} from "../components/AuthScreen";
interface AuthState {
  session: Session | null;
  account: CloudIdentity | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  reload: () => void;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState>({
  session: null,
  account: null,
  loading: false,
  error: "",
  recovery: false,
  reload: () => {},
  signOut: async () => {},
});
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const activeUser = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [account, setAccount] = useState<CloudIdentity | null>(null),
    [loading, setLoading] = useState(!isDemoMode),
    [authReady, setAuthReady] = useState(isDemoMode),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (isDemoMode || !isSupabaseConfigured) {
      setLoading(false);
      setAuthReady(true);
      return;
    }
    let active = true;
    let eventReceived = false;
    const client = createSupabaseClient();
    function acceptSession(next: Session | null) {
      const nextUser = next?.user.id ?? null;
      if (nextUser !== activeUser.current) {
        clearCloudWorkspace();
        setAccount(null);
        setError("");
        setLoading(Boolean(next));
        activeUser.current = nextUser;
      }
      setSession(next);
      setAuthReady(true);
    }
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      eventReceived = true;
      acceptSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        clearCloudWorkspace();
        setAccount(null);
        setRecovery(false);
        setError("");
      }
    });
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        if (!eventReceived) acceptSession(data.session);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setAuthReady(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    if (isDemoMode || !authReady) return;
    let active = true;
    setError("");
    setAccount(null);
    if (!session) {
      clearCloudWorkspace();
      setLoading(false);
      return;
    }
    setLoading(true);
    initializeCloudWorkspace(session.user)
      .then((account) => {
        if (active) setAccount(account);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, authReady, revision]);
  useEffect(() => {
    if (isDemoMode || !account) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        refreshWorkspace().catch((e) => setError(e.message));
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [account?.workspaceId]);
  async function signOut() {
    if (isDemoMode) return;
    const { error } = await createSupabaseClient().auth.signOut({
      scope: "local",
    });
    if (error) throw error;
    clearCloudWorkspace();
    setSession(null);
    setAccount(null);
    setError("");
    setRecovery(false);
  }
  return (
    <AuthContext.Provider
      value={{
        session,
        account,
        loading: loading || !authReady,
        error,
        recovery,
        reload: () => setRevision((v) => v + 1),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    location = useLocation();
  if (isDemoMode) return children;
  if (!isSupabaseConfigured)
    return (
      <div className="auth-status">
        <h1>Connect CivilHub to Supabase</h1>
        <p>
          Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the project
          environment, then restart or rebuild the app.
        </p>
      </div>
    );
  if (auth.loading)
    return (
      <div className="auth-status">
        <span className="auth-spinner" />
        <h2>Opening your workspace…</h2>
        <p>Checking your session and loading saved records.</p>
      </div>
    );
  if (auth.recovery && auth.session) return <PasswordRecovery />;
  if (!auth.session) {
    if (
      location.pathname !== "/login" &&
      location.pathname !== "/auth/callback"
    )
      return <Navigate to="/login" replace />;
    return <AuthScreen />;
  }
  if (auth.error)
    return (
      <div className="auth-status">
        <h1>We couldn’t open your workspace</h1>
        <p role="alert">{auth.error}</p>
        <div>
          <button className="button button-primary" onClick={auth.reload}>
            Try again
          </button>
          <button className="button" onClick={() => void auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  if (!auth.account) return <WorkspaceSetup />;
  if (location.pathname === "/login" || location.pathname === "/auth/callback")
    return <Navigate to="/" replace />;
  return children;
}
