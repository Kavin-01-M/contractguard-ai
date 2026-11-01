import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  supabase,
  isSupabaseConfigured,
  localAuth,
  getLocalStoredSession,
  DEFAULT_DEMO_USERS,
  type AuthUserProfile,
} from "../lib/supabase";

export interface AuthContextType {
  user: AuthUserProfile | null;
  loading: boolean;
  isSupabase: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    role?: "admin" | "reviewer",
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: (demoEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync session with optional backend if available
  const syncBackendSession = useCallback(async (u: AuthUserProfile | null) => {
    if (u) {
      try {
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: u.email,
            name: u.name,
            role: u.role,
          }),
        });
      } catch {
        // Backend optional in pure Vercel SPA mode
      }
    } else {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Backend optional
      }
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user && mounted) {
            const profile: AuthUserProfile = {
              id: session.user.id,
              email: session.user.email || "",
              name:
                session.user.user_metadata?.name ||
                session.user.email?.split("@")[0] ||
                "Reviewer",
              role:
                (session.user.user_metadata?.role as "admin" | "reviewer") ||
                "reviewer",
              createdAt: session.user.created_at,
            };
            setUser(profile);
            syncBackendSession(profile);
          }
        } catch (err) {
          console.error("Failed to fetch Supabase session:", err);
        }

        // Listen for auth state changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (session?.user) {
            const profile: AuthUserProfile = {
              id: session.user.id,
              email: session.user.email || "",
              name:
                session.user.user_metadata?.name ||
                session.user.email?.split("@")[0] ||
                "Reviewer",
              role:
                (session.user.user_metadata?.role as "admin" | "reviewer") ||
                "reviewer",
              createdAt: session.user.created_at,
            };
            setUser(profile);
            syncBackendSession(profile);
          } else {
            setUser(null);
            syncBackendSession(null);
          }
        });

        if (mounted) setLoading(false);
        return () => subscription.unsubscribe();
      } else {
        // Use persistent local auth
        const localSession = getLocalStoredSession();
        if (localSession?.user && mounted) {
          setUser(localSession.user);
          syncBackendSession(localSession.user);
        }
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, [syncBackendSession]);

  const login = useCallback(
    async (email: string, password: string, _rememberMe = true) => {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.user) {
          const profile: AuthUserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            name:
              data.user.user_metadata?.name ||
              data.user.email?.split("@")[0] ||
              "Reviewer",
            role:
              (data.user.user_metadata?.role as "admin" | "reviewer") ||
              "reviewer",
            createdAt: data.user.created_at,
          };
          setUser(profile);
          await syncBackendSession(profile);
        }
      } else {
        const profile = await localAuth.login(email, password);
        setUser(profile);
        await syncBackendSession(profile);
      }
    },
    [syncBackendSession],
  );

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      role: "admin" | "reviewer" = "reviewer",
    ) => {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
              role,
            },
          },
        });
        if (error) throw error;
        if (data.user) {
          const profile: AuthUserProfile = {
            id: data.user.id,
            email: data.user.email || email,
            name: name.trim(),
            role,
            createdAt: data.user.created_at,
          };
          // If auto sign-in is enabled in Supabase project:
          if (data.session) {
            setUser(profile);
            await syncBackendSession(profile);
          }
        }
      } else {
        const profile = await localAuth.register(name, email, password, role);
        setUser(profile);
        await syncBackendSession(profile);
      }
    },
    [syncBackendSession],
  );

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localAuth.logout();
    setUser(null);
    await syncBackendSession(null);
  }, [syncBackendSession]);

  const resetPassword = useCallback(async (email: string) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
    } else {
      await localAuth.resetPassword(email);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } else {
      throw new Error(
        "Google Sign-In requires your Supabase Project URL & Anon Key to be configured in Vercel Environment Variables.",
      );
    }
  }, []);

  const loginAsDemo = useCallback(
    async (demoEmail: string) => {
      const demoUser = DEFAULT_DEMO_USERS.find(
        (u) => u.email.toLowerCase() === demoEmail.toLowerCase(),
      );
      if (demoUser) {
        await login(demoUser.email, demoUser.password);
      } else {
        await login("admin@contractguard.ai", "Password123!");
      }
    },
    [login],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabase: isSupabaseConfigured,
        login,
        signup,
        logout,
        resetPassword,
        loginWithGoogle,
        loginAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

