import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    supabaseAnonKey.length > 20,
);

// If Supabase keys are provided, initialize the real client; otherwise use a placeholder to avoid runtime crash.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as unknown as SupabaseClient);

export interface AuthUserProfile {
  id: string;
  email: string;
  name: string;
  role: "admin" | "reviewer" | "auditor";
  createdAt: string;
}

// Local storage key for fallback offline/demo auth persistence
const LOCAL_STORAGE_USERS_KEY = "contractguard_auth_users";
const LOCAL_STORAGE_SESSION_KEY = "contractguard_auth_session";

// Default demo accounts available out-of-the-box
export const DEFAULT_DEMO_USERS: (AuthUserProfile & { password: string })[] = [
  {
    id: "usr-admin-01",
    email: "admin@contractguard.ai",
    name: "Alex Vance",
    role: "admin",
    password: "Password123!",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-compliance-02",
    email: "compliance@contractguard.ai",
    name: "Sarah Chen",
    role: "reviewer",
    password: "Password123!",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-auditor-03",
    email: "auditor@contractguard.ai",
    name: "Marcus Reid",
    role: "reviewer",
    password: "Password123!",
    createdAt: new Date().toISOString(),
  },
];

function getStoredUsers(): (AuthUserProfile & { password: string })[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (!raw) {
      localStorage.setItem(
        LOCAL_STORAGE_USERS_KEY,
        JSON.stringify(DEFAULT_DEMO_USERS),
      );
      return DEFAULT_DEMO_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DEMO_USERS;
  }
}

function saveStoredUsers(users: (AuthUserProfile & { password: string })[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

export function getLocalStoredSession(): {
  user: AuthUserProfile;
  token: string;
} | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLocalStoredSession(
  session: { user: AuthUserProfile; token: string } | null,
) {
  try {
    if (session) {
      localStorage.setItem(
        LOCAL_STORAGE_SESSION_KEY,
        JSON.stringify(session),
      );
    } else {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

// Fallback local auth handlers for development or offline testing
export const localAuth = {
  async register(
    name: string,
    email: string,
    password: string,
    role: "admin" | "reviewer" = "reviewer",
  ): Promise<AuthUserProfile> {
    const users = getStoredUsers();
    const normalizedEmail = email.toLowerCase().trim();
    const existing = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail,
    );
    if (existing) {
      throw new Error(
        "An account with this email address already exists. Please sign in instead.",
      );
    }

    const newUser: AuthUserProfile & { password: string } = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: normalizedEmail,
      name: name.trim() || normalizedEmail.split("@")[0],
      role,
      password,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveStoredUsers(users);

    const session = {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
      token: `local_token_${Date.now()}`,
    };
    setLocalStoredSession(session);
    return session.user;
  },

  async login(email: string, password: string): Promise<AuthUserProfile> {
    const users = getStoredUsers();
    const normalizedEmail = email.toLowerCase().trim();
    const match = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!match) {
      throw new Error(
        "No account found with this email. Please check your spelling or sign up.",
      );
    }

    if (match.password !== password) {
      throw new Error(
        "Incorrect password. Please try again or use the forgot password link.",
      );
    }

    const session = {
      user: {
        id: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        createdAt: match.createdAt,
      },
      token: `local_token_${Date.now()}`,
    };
    setLocalStoredSession(session);
    return session.user;
  },

  async resetPassword(email: string): Promise<void> {
    const users = getStoredUsers();
    const normalizedEmail = email.toLowerCase().trim();
    const match = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    // In secure systems, we don't disclose whether the email exists, but simulate sending email
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (!match) {
      // Do nothing, still return success to prevent user enumeration
    }
  },

  logout(): void {
    setLocalStoredSession(null);
  },
};

