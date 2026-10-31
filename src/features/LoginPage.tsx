import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  FileText,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";

const PRESET_ACCOUNTS = [
  {
    role: "admin",
    name: "Alex Vance",
    email: "alex.admin@contractguard.ai",
    title: "Workspace Administrator",
    badge: "Full Admin",
    desc: "Manage documents, policy schemas, members, and audit overrides.",
  },
  {
    role: "reviewer",
    name: "Sarah Chen",
    email: "sarah.compliance@contractguard.ai",
    title: "Compliance Officer",
    badge: "Compliance Lead",
    desc: "Verify obligation mappings, review risk findings, and assign tasks.",
  },
  {
    role: "reviewer",
    name: "Marcus Reid",
    email: "marcus.legal@contractguard.ai",
    title: "Legal & Audit Reviewer",
    badge: "Auditor",
    desc: "Inspect evidence citations, track contract clauses, and export audit trails.",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "reviewer">("reviewer");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"quick" | "custom">("quick");
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(credentials: {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
  }) {
    setError(null);
    setLoading(true);
    try {
      await api.login(credentials);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(
        err?.message || "Failed to sign in. Please verify your credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your work email.");
      return;
    }
    handleLogin({
      email: email.trim(),
      password,
      role,
    });
  }

  return (
    <div className="min-h-screen bg-[#0d1624] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Header bar */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-slate-800/80 max-w-7xl mx-auto w-full">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base">
              ContractGuard
            </span>
            <span className="ml-1 text-[11px] font-semibold tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-400/20">
              AI
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Local Environment Ready</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Product Value Narrative */}
          <div className="lg:col-span-6 space-y-6 lg:pr-6 text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles size={14} />
              <span>Evidence-First Compliance Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Contract review backed by{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                verifiable citations
              </span>
              .
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed">
              Connect contractual duties to organizational policies, audit
              deadlines with deterministic calendar precision, and resolve
              compliance gaps without hallucinated claims.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 text-blue-400">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    Zero-Hallucination Obligations
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Exact-quote matching preserves verifiable clause sources.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="mt-0.5 text-blue-400">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    Strict Organization Scoping
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Complete data isolation between reviewers, vendors, and
                    auditors.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="mt-0.5 text-blue-400">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    Actionable Task Remediations
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Convert high-risk findings into trackable workflows and audit
                    logs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-6">
            <div className="bg-[#121c2d]/90 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Sign in to your workspace
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select a test profile or enter your work credentials to
                  continue.
                </p>
              </div>

              {/* Tabs */}
              <div className="flex rounded-lg bg-slate-800/60 p-1 mb-5 border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setActiveTab("quick")}
                  className={`flex-1 text-xs py-2 rounded-md font-medium transition ${
                    activeTab === "quick"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⚡ Instant 1-Click Access
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("custom")}
                  className={`flex-1 text-xs py-2 rounded-md font-medium transition ${
                    activeTab === "custom"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🔑 Custom Credentials
                </button>
              </div>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {activeTab === "quick" ? (
                /* Quick Presets Mode */
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Select a Role to Sign In:
                  </div>
                  {PRESET_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        handleLogin({
                          name: acc.name,
                          email: acc.email,
                          role: acc.role,
                        })
                      }
                      className="w-full text-left p-3.5 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800 hover:border-blue-500/50 transition duration-150 flex items-center justify-between group disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                          <UserCheck size={16} />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-slate-100">
                              {acc.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/80 text-blue-300 font-medium border border-slate-600/50">
                              {acc.badge}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {acc.title}
                          </div>
                        </div>
                      </div>
                      <div className="text-slate-500 group-hover:text-blue-400 transition-colors">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* Custom Credentials Form */
                <form onSubmit={handleCustomSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Work Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Mail size={15} />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Lock size={15} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-9 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Organization Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole("reviewer")}
                        className={`text-xs py-2 px-3 rounded-lg border text-center transition font-medium ${
                          role === "reviewer"
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        Reviewer / Analyst
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("admin")}
                        className={`text-xs py-2 px-3 rounded-lg border text-center transition font-medium ${
                          role === "admin"
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        Workspace Admin
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Signing in…</span>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Bottom security assurance */}
              <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center space-x-1">
                  <FileText size={13} className="text-slate-400" />
                  <span>Demo Mode Supported</span>
                </span>
                <span>Audit Scoped & Secure</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 px-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
        ContractGuard AI · Evidence-First Contract & Compliance Review
        Intelligence
      </footer>
    </div>
  );
}

