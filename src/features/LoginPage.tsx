import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  FileText,
  CheckCircle2,
  Sparkles,
  Cpu,
  Layers,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";
import { DEFAULT_DEMO_USERS } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const { login, loginWithGoogle, loginAsDemo, isSupabase } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password, rememberMe);
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to sign in. Please verify your email and password.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err?.message || "Google sign-in could not be completed.");
      setGoogleLoading(false);
    }
  }

  async function handleSelectDemo(demoEmail: string) {
    setError(null);
    setLoading(true);
    try {
      await loginAsDemo(demoEmail);
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Failed to sign in with demo account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans antialiased text-slate-800">
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        initialEmail={email}
      />

      {/* LEFT COLUMN: Modern Login Form with White / Clean Surface */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white border-r border-slate-100 shadow-sm relative z-10">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck size={22} />
            </div>
            <div className="flex items-center">
              <span className="font-bold tracking-tight text-slate-900 text-lg">
                ContractGuard
              </span>
              <span className="ml-1.5 text-[10px] font-bold tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase">
                AI
              </span>
            </div>
          </Link>

          <span className="text-[11px] font-medium text-slate-400">
            {isSupabase ? "Supabase Auth" : "Enterprise Workspace"}
          </span>
        </div>

        {/* Form Container */}
        <div className="my-auto py-8 max-w-md w-full mx-auto">
          <div className="mb-8 text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Sign in to manage and protect your contracts with AI.
            </p>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2.5 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Social Sign-In (Google) */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition disabled:opacity-50 mb-5"
          >
            {googleLoading ? (
              <Loader2 size={16} className="animate-spin text-slate-500" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">
                Or sign in with email
              </span>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-600 font-medium">
                  Remember Me
                </span>
              </label>
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Demo Profiles */}
          <div className="mt-7 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Quick 1-Click Test Personas</span>
              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-normal">
                Instant Access
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEFAULT_DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => handleSelectDemo(u.email)}
                  disabled={loading}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 bg-slate-50/60 text-left transition group disabled:opacity-50"
                >
                  <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 truncate">
                    {u.name}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {u.role === "admin" ? "Admin" : "Reviewer"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Signup Redirect Link */}
          <div className="text-center mt-7">
            <p className="text-xs text-slate-500">
              Don’t have an account?{" "}
              <Link
                to="/signup"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-400 text-center flex items-center justify-between pt-6 border-t border-slate-100">
          <span>ContractGuard AI · v0.1</span>
          <span>Enterprise Grade Compliance</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Attractive Dark Navy / Blue Gradient Panel */}
      <div className="hidden lg:flex w-1/2 bg-[#0c1626] text-white flex-col justify-between p-12 lg:p-16 relative overflow-hidden">
        {/* Subtle decorative glow & gradients */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

        {/* Top Tagline */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 backdrop-blur">
            <Sparkles size={14} className="text-blue-400" />
            <span>Deterministic Legal AI Architecture</span>
          </div>

          <div className="flex items-center space-x-1 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Audit-Certified</span>
          </div>
        </div>

        {/* Visual Graphic Representation */}
        <div className="relative z-10 my-auto py-10 max-w-lg mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 mb-6">
            <ShieldCheck size={36} />
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-snug">
            Intelligent Contract & Compliance Review with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400">
              Zero Hallucinations
            </span>
            .
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            ContractGuard extracts contractual duties, correlates policy clauses
            with exact citations, and prioritizes operational risk without
            guessing unknown dates or actors.
          </p>

          {/* Interactive Feature Cards */}
          <div className="space-y-3.5 pt-4">
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 backdrop-blur-sm flex items-start space-x-3.5 hover:border-blue-500/40 transition">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-100">
                  Exact Citation Provenance
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Every compliance finding links directly back to verbatim source text in your vendor agreements.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 backdrop-blur-sm flex items-start space-x-3.5 hover:border-blue-500/40 transition">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-100">
                  Deterministic Policy Overlap
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Lexical similarity is scored as a review signal, giving human reviewers total audit clarity.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 backdrop-blur-sm flex items-start space-x-3.5 hover:border-blue-500/40 transition">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Cpu size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-100">
                  Calendar-Aware Deadline Radar
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Precise business-day calculations guarantee renewal, notice, and termination compliance.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Social Proof / Testimonial */}
        <div className="relative z-10 p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-blue-400" />
            <span>Organization Scoped Data Security</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            AES-256 / TLS
          </span>
        </div>
      </div>
    </div>
  );
}
