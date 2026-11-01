import React, { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Bootstrap } from "./types/domain";
import { api } from "./lib/api";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./context/AuthContext";

const Overview = lazy(() => import("./features/Overview"));
const DocumentsPage = lazy(() =>
  import("./features/WorkspacePages").then((m) => ({
    default: m.DocumentsPage,
  })),
);
const ObligationsPage = lazy(() =>
  import("./features/WorkspacePages").then((m) => ({
    default: m.ObligationsPage,
  })),
);
const RisksPage = lazy(() =>
  import("./features/WorkspacePages").then((m) => ({ default: m.RisksPage })),
);
const DeadlinesPage = lazy(() =>
  import("./features/WorkspacePages").then((m) => ({
    default: m.DeadlinesPage,
  })),
);
const ActionsPage = lazy(() =>
  import("./features/WorkspacePages").then((m) => ({ default: m.ActionsPage })),
);
const AuditPage = lazy(() =>
  import("./features/WorkspacePages").then((m) => ({ default: m.AuditPage })),
);
const SettingsPage = lazy(() =>
  import("./features/WorkspacePages").then((m) => ({
    default: m.SettingsPage,
  })),
);
const FindingDetail = lazy(() => import("./features/FindingDetail"));
const Intelligence = lazy(() => import("./features/Intelligence"));
const DocumentDetail = lazy(() => import("./features/DocumentDetail"));
const LoginPage = lazy(() => import("./features/LoginPage"));
const SignupPage = lazy(() => import("./features/SignupPage"));

function RouteLoading() {
  return (
    <div className="auth-loading min-h-[50vh] flex flex-col items-center justify-center space-y-3">
      <div className="brand-mark animate-pulse">
        <ShieldCheck size={28} className="text-blue-600" />
      </div>
      <span className="text-xs font-medium text-slate-500">
        Opening ContractGuard workspace…
      </span>
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading min-h-screen flex flex-col items-center justify-center space-y-3 bg-[#0d1624] text-white">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
          <ShieldCheck size={26} />
        </div>
        <span className="text-xs text-slate-400">Verifying secure workspace access…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return <Workspace />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  if (loading) {
    return (
      <div className="auth-loading min-h-screen flex flex-col items-center justify-center space-y-3 bg-[#0d1624] text-white">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
          <ShieldCheck size={26} />
        </div>
        <span className="text-xs text-slate-400">Connecting to authentication…</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

function Workspace() {
  const query = useQuery<Bootstrap>({
    queryKey: ["bootstrap"],
    queryFn: api.bootstrap,
    retry: false,
  });
  return <AppShell data={query.data || null} />;
}

function NotFound() {
  return (
    <div className="page-stack">
      <div className="not-found">
        <ShieldCheck size={22} />
        <h1>Page not found</h1>
        <p>This workspace route is not available.</p>
        <Link to="/" className="button button-secondary">
          Return to overview
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route index element={<Overview />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentDetail />} />
            <Route path="/obligations" element={<ObligationsPage />} />
            <Route path="/intelligence" element={<Intelligence />} />
            <Route path="/risks" element={<RisksPage />} />
            <Route path="/findings/:id" element={<FindingDetail />} />
            <Route path="/deadlines" element={<DeadlinesPage />} />
            <Route path="/actions" element={<ActionsPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
