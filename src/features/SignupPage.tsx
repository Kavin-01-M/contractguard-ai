import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileCheck2,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, isSupabase } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"admin" | "reviewer">("reviewer");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password requirement checks
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your work email.");
      return;
    }

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError(
        "Please meet all password requirements (at least 8 characters with letters and numbers).",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify and try again.");
      return;
    }

    if (!agreeTerms) {
      setError(
        "Please accept the Terms of Service and Privacy Policy to create your account.",
      );
      return;
    }

    setLoading(true);
    try {
      await signup(fullName.trim(), email.trim(), password, role);
      setSuccess(true);
      // Small pause so user sees confirmation, then navigate to dashboard
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1200);
    } catch (err: any) {
      setError(
        err?.message ||
          "Could not create account. Please verify your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans antialiased text-slate-800">
      {/* LEFT COLUMN: Modern Signup Form with White / Clean Surface */}
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
              Create your account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Start analyzing and protecting your contracts in minutes.
            </p>
          </div>

          {/* Success Notification Banner */}
          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-3 animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <strong className="block font-semibold">
                  Account created successfully!
                </strong>
                <span>Redirecting you to your ContractGuard workspace…</span>
              </div>
            </div>
          )}

          {/* Error Alert Box */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2.5 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Vance"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
            </div>

            {/* Email Address */}
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

            {/* Role Preference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Primary Responsibility
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("reviewer")}
                  className={`text-xs py-2 px-3 rounded-xl border text-center transition font-medium ${
                    role === "reviewer"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-sm"
                      : "border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Compliance Reviewer
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`text-xs py-2 px-3 rounded-xl border text-center transition font-medium ${
                    role === "admin"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-sm"
                      : "border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  Workspace Admin
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
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

              {/* Password Requirements Checklist */}
              {password.length > 0 && (
                <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[10px]">
                  <span
                    className={`flex items-center space-x-1 ${
                      hasMinLength ? "text-emerald-600 font-medium" : "text-slate-400"
                    }`}
                  >
                    {hasMinLength ? <Check size={12} /> : <X size={12} />}
                    <span>8+ characters</span>
                  </span>
                  <span
                    className={`flex items-center space-x-1 ${
                      hasLetter ? "text-emerald-600 font-medium" : "text-slate-400"
                    }`}
                  >
                    {hasLetter ? <Check size={12} /> : <X size={12} />}
                    <span>Letters</span>
                  </span>
                  <span
                    className={`flex items-center space-x-1 ${
                      hasNumber ? "text-emerald-600 font-medium" : "text-slate-400"
                    }`}
                  >
                    {hasNumber ? <Check size={12} /> : <X size={12} />}
                    <span>Numbers</span>
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <div className="mt-1 text-[11px]">
                  {passwordsMatch ? (
                    <span className="text-emerald-600 font-medium flex items-center space-x-1">
                      <Check size={13} />
                      <span>Passwords match</span>
                    </span>
                  ) : (
                    <span className="text-red-500 font-medium flex items-center space-x-1">
                      <X size={13} />
                      <span>Passwords do not match</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Terms and Conditions */}
            <div className="pt-1">
              <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  I agree to the{" "}
                  <a
                    href="#terms"
                    onClick={(e) => {
                      e.preventDefault();
                      alert(
                        "Terms of Service: By using ContractGuard AI, your uploaded data is kept strictly private within your organization scope and never shared or sent to unauthorized third-party language models.",
                      );
                    }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="#privacy"
                    onClick={(e) => {
                      e.preventDefault();
                      alert(
                        "Privacy Policy: ContractGuard AI enforces organization-scoped access control, encryption in transit, and immutable audit logs.",
                      );
                    }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating Account…</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Login Redirect Link */}
          <div className="text-center mt-7">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition"
              >
                Sign In
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

      {/* RIGHT COLUMN: Matching Dark Navy / Blue Gradient Panel */}
      <div className="hidden lg:flex w-1/2 bg-[#0c1626] text-white flex-col justify-between p-12 lg:p-16 relative overflow-hidden">
        {/* Subtle decorative glow & gradients */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

        {/* Top Tagline */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 backdrop-blur">
            <Sparkles size={14} className="text-blue-400" />
            <span>Built for Enterprise Legal & Compliance Teams</span>
          </div>

          <div className="flex items-center space-x-1 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>SOC-2 Ready</span>
          </div>
        </div>

        {/* Visual Graphic Representation */}
        <div className="relative z-10 my-auto py-10 max-w-lg mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 mb-6">
            <FileCheck2 size={34} />
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-snug">
            Streamline Vendor & Policy Reviews in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400">
              Minutes, Not Weeks
            </span>
            .
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Gain immediate confidence in vendor agreements, SLAs, and privacy
            frameworks. ContractGuard maps your organizational policies to
            extracted obligations with mathematical auditability.
          </p>

          {/* Signup Highlight Steps */}
          <div className="space-y-3.5 pt-4">
            <div className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">
                1
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">
                  Upload Any Contract or Policy
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supports PDF, DOCX, and TXT agreements with automatic structure extraction.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">
                2
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">
                  Instant Conflict & Gap Detection
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Discover SLA discrepancies, data retention mismatches, and indemnification risks.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-500/30">
                3
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">
                  Actionable Task Workflows
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Assign remediation items to owners and track status to completion.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Social Proof */}
        <div className="relative z-10 p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-blue-400" />
            <span>Strict Zero-Training AI Policy</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Private & Confidential
          </span>
        </div>
      </div>
    </div>
  );
}

