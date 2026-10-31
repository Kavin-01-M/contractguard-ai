import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Bootstrap } from "./types/domain";
import { api } from "./lib/api";
import { AppShell } from "./components/AppShell";

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
function RouteLoading() {
  return <div className="loading-state">Opening workspace view…</div>;
}
function Gate() {
  const auth = useQuery({
    queryKey: ["auth"],
    queryFn: api.auth,
    retry: false,
    staleTime: 30_000,
  });
  if (auth.isLoading)
    return (
      <div className="auth-loading">
        <div className="brand-mark">
          <ShieldCheck size={21} />
        </div>
        <span>Verifying workspace access…</span>
      </div>
    );
  if (auth.data && !auth.data.authenticated) {
    return <LoginPage />;
  }
  return <Workspace />;
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
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Gate />}>
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
  );
}
