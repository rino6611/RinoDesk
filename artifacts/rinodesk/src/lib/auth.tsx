import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loginWithCredential: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function loginWithCredential(credential: string) {
    const res = await fetch(`${API}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new Error("Login failed");
    setUser(await res.json());
  }

  async function logout() {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithCredential, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
