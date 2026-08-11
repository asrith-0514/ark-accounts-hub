import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { User, UserRole } from "./types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadUserProfile(userId: string, fallbackEmail: string): Promise<User> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("name, email").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const role: UserRole =
    roles?.some((r) => r.role === "owner") ? "owner" : "accountant";

  return {
    id: userId,
    email: profile?.email ?? fallbackEmail,
    name: profile?.name || (profile?.email ?? fallbackEmail).split("@")[0],
    role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe first, then check existing session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // defer to avoid deadlocks inside the callback
        setTimeout(() => {
          void loadUserProfile(newSession.user.id, newSession.user.email ?? "").then(setUser);
        }, 0);
      } else {
        setUser(null);
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const u = await loadUserProfile(data.session.user.id, data.session.user.email ?? "");
        setUser(u);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? "Login failed");
    const u = await loadUserProfile(data.user.id, data.user.email ?? email);
    setUser(u);
    return u;
  };

  const signup = async (email: string, password: string, name: string): Promise<void> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, isAuthenticated: !!user, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export type SupplierAction =
  | "view"
  | "add"
  | "edit"
  | "archive"
  | "restore"
  | "delete"
  | "import";

export function can(user: User | null, action: SupplierAction): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  if (action === "delete") return false;
  return true;
}

export function useUserRole() {
  const { user } = useAuth();
  return user?.role ?? null;
}

