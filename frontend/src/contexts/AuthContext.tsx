import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { API_BASE } from "../lib/api";

/** Auth uses same API_BASE as rest of app – dev proxy = same-origin for cookies */

export type UserRole =
  | "owner"
  | "general_manager"
  | "brand_manager"
  | "branch_supervisor"
  | "external_accountant";

export type UserPermissions = {
  view_financial_reports?: boolean;
  upload_files?: boolean;
  view_activity_log?: boolean;
  edit_chart_of_accounts?: boolean;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  brand_id: number | null;
  branch_id: number | null;
  brand_slug?: string | null;
  branch_name?: string | null;
  employee_id?: string | null;
  display_name?: string | null;
  permissions?: UserPermissions;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

/** Returns true if user has Operations Mode (prefix A or B). */
export function isOperationsUser(user: AuthUser | null): boolean {
  const eid = (user?.employee_id || "").toUpperCase();
  return /^A\d+$/.test(eid) || /^B\d+$/.test(eid);
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : null;
}

async function fetchWithCsrf(url: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  const token = getCsrfToken();
  if (token) headers["X-CSRFToken"] = token;
  return fetch(url, { ...opts, credentials: "include", headers });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithCsrf(`${API_BASE}/auth/me/`);
      if (res.ok) {
        const data = await res.json();
        setState({ user: data.user, loading: false, error: null });
      } else {
        setState({ user: null, loading: false, error: null });
      }
    } catch {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<AuthUser | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchWithCsrf(`${API_BASE}/auth/login/`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }
      const user = data.user as AuthUser;
      setState({ user, loading: false, error: null });
      return user;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isNetworkError =
        msg === "Failed to fetch" ||
        msg.toLowerCase().includes("network") ||
        msg.toLowerCase().includes("load failed") ||
        msg.toLowerCase().includes("connection") ||
        msg.toLowerCase().includes("fetch");
      const friendly = isNetworkError
        ? "Cannot connect to server. Make sure the backend is running (python manage.py runserver in backend folder)."
        : msg;
      setState({
        user: null,
        loading: false,
        error: friendly,
      });
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchWithCsrf(`${API_BASE}/auth/logout/`, { method: "POST" });
    } finally {
      setState({ user: null, loading: false, error: null });
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchWithCsrf(`${API_BASE}/auth/csrf/`);
      } finally {
        refresh();
      }
    })();
  }, [refresh]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
