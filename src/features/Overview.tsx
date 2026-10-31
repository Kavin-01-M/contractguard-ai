import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  FileUp,
  ListChecks,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import {
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SeverityBadge,
  formatDate,
} from "../components/Primitives";
const COLORS = ["#c8474e", "#e5943d", "#3157d5", "#94a3b8"];
export default function Overview() {
  const qc = useQueryClient(),
    navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: api.bootstrap,
  });
  const demo = useMutation({
    mutationFn: api.loadDemo,
    onSuccess: () => qc.invalidateQueries(),
  });
  const analyze = useMutation({
    mutationFn: api.analyze,
    onSuccess: () => qc.invalidateQueries(),
  });
  if (isLoading)
    return <div className="loading-state">Loading organization workspace…</div>;
  const s = data?.summary;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="EXECUTIVE OVERVIEW"
        title="Contract posture"
        description={`Evidence-first view of obligations, control coverage, and decisions · ${data?.organization.name || "Workspace"}`}
        action={
          <div className="heading-buttons">
            <Button variant="secondary" onClick={() => navigate("/documents")}>
              <FileUp size={16} />
              Upload documents
            </Button>
            <Button
              onClick={() => analyze.mutate()}
              disabled={!data?.has_data || analyze.isPending}
            >
              <Sparkles size={16} />
              {analyze.isPending ? "Analyzing…" : "Run analysis"}
            </Button>
          </div>
        }
      />
      {!data?.has_data ? (
        <Panel className="onboarding-panel">
          <EmptyState
            title="Start with your source documents"
            description="Upload a contract and an internal policy to map obligations to controls. Or load clearly labeled synthetic records to explore the evidence trail."
            action={
              <div className="heading-buttons">
                <Button onClick={() => demo.mutate()} disabled={demo.isPending}>
                  <Sparkles size={16} />
                  {demo.isPending
                    ? "Loading demo…"
                    : "Load synthetic demo data"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/documents")}
                >
                  <FileUp size={16} />
                  Upload a document
                </Button>
              </div>
            }
          />
          {demo.isError && (
            <div className="inline-error">{(demo.error as Error).message}</div>
          )}
          <div className="onboarding-steps">
            <div>
              <span>01</span>
              <strong>Add sources</strong>
              <small>Contracts and internal policies</small>
            </div>
            <ArrowRight size={16} />
            <div>
              <span>02</span>
              <strong>Compare evidence</strong>
              <small>Review obligations and policy matches</small>
            </div>
            <ArrowRight size={16} />
            <div>
              <span>03</span>
              <strong>Assign follow-up</strong>
              <small>Track owners and decisions</small>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <div className="metric-grid">
            {[
              {
                label: "Contracts analyzed",
                value: s?.contracts_analyzed,
                icon: FileSearch,
                sub: "Source agreements",
              },
              {
                label: "Extracted obligations",
                value: s?.obligations,
                icon: ListChecks,
                sub: "Across active sources",
              },
              {
                label: "Open findings",
                value: s?.open_findings,
                icon: ShieldAlert,
                sub: "Human review required",
              },
              {
                label: "High-priority risks",
                value: s?.high_risks,
                icon: AlertTriangle,
                sub: "Critical and high severity",
              },
              {
                label: "Upcoming deadlines",
                value: s?.upcoming_deadlines,
                icon: CalendarClock,
                sub: "Next 30 days",
              },
              {
                label: "Awaiting review",
                value: s?.awaiting_review,
                icon: CheckCircle2,
                sub: "Reviewer decision needed",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div className="metric-card" key={item.label}>
                  <div className="metric-top">
                    <span>{item.label}</span>
                    <i>
                      <Icon size={16} />
                    </i>
                  </div>
                  <strong>{item.value || 0}</strong>
                  <small>{item.sub}</small>
                </div>
              );
            })}
          </div>
          <div className="dashboard-grid">
            <Panel
              title="Risk distribution"
              action={
                <Link to="/risks" className="text-link">
                  View risk center <ArrowUpRight size={13} />
                </Link>
              }
              className="chart-panel"
            >
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={214}>
                  <PieChart>
                    <Pie
                      data={data?.risk_distribution.filter((x) => x.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {data?.risk_distribution.map((e, i) => (
                        <Cell key={e.name} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-center">
                  <strong>{s?.open_findings || 0}</strong>
                  <small>open findings</small>
                </div>
              </div>
              <div className="chart-legend">
                {data?.risk_distribution.map((item, i) => (
                  <div key={item.name}>
                    <span style={{ background: COLORS[i] }} />
                    <span>{item.name}</span>
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Obligations by category"
              action={
                <Link to="/obligations" className="text-link">
                  View obligations <ArrowUpRight size={13} />
                </Link>
              }
              className="chart-panel"
            >
              <div className="bar-chart">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={data?.obligations_by_category.slice(0, 6)}
                    layout="vertical"
                    margin={{ left: 8, right: 12, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#eef1f5" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#8995a6" }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={118}
                      tick={{ fontSize: 11, fill: "#657287" }}
                    />
                    <Tooltip cursor={{ fill: "#f6f8fb" }} />
                    <Bar
                      dataKey="value"
                      fill="#3157d5"
                      radius={[0, 5, 5, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel
              title="Upcoming deadlines"
              action={
                <Link to="/deadlines" className="text-link">
                  Open radar <ArrowUpRight size={13} />
                </Link>
              }
              className="wide-panel"
            >
              <div className="deadline-list">
                {data?.deadlines.length ? (
                  data.deadlines.slice(0, 4).map((d) => (
                    <div className="deadline-row" key={d.id}>
                      <div className="deadline-date">
                        <strong>
                          {d.due_date
                            ? new Date(`${d.due_date}T12:00:00`).getDate()
                            : "—"}
                        </strong>
                        <small>
                          {d.due_date
                            ? new Date(
                                `${d.due_date}T12:00:00`,
                              ).toLocaleDateString("en-US", { month: "short" })
                            : "TBD"}
                        </small>
                      </div>
                      <div className="deadline-copy">
                        <strong>{d.title}</strong>
                        <span>
                          {d.document_name} · {d.owner}
                        </span>
                      </div>
                      <Badge
                        tone={
                          d.status === "Overdue"
                            ? "critical"
                            : d.due_date
                              ? "info"
                              : "neutral"
                        }
                      >
                        {d.status}
                      </Badge>
                      <span className="deadline-full-date">
                        {formatDate(d.due_date)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="muted small padding-16">
                    No deadlines recorded. Dates are only calculated when the
                    triggering event is known.
                  </div>
                )}
              </div>
            </Panel>
            <Panel
              title="Recent findings"
              action={
                <Link to="/risks" className="text-link">
                  All findings <ArrowUpRight size={13} />
                </Link>
              }
              className="wide-panel"
            >
              <div className="finding-list">
                {data?.recent_findings.length ? (
                  data.recent_findings.map((f) => (
                    <Link
                      to={`/findings/${f.id}`}
                      className="finding-row"
                      key={f.id}
                    >
                      <span
                        className={`finding-dot dot-${f.severity.toLowerCase()}`}
                      />
                      <div className="finding-copy">
                        <strong>{f.title}</strong>
                        <span>
                          {f.category} ·{" "}
                          {f.obligation?.document_name || "Source under review"}
                        </span>
                      </div>
                      <SeverityBadge severity={f.severity} />
                      <span className="finding-score">
                        {f.score.toFixed(0)} <small>score</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="muted small padding-16">
                    No findings yet. Run analysis after adding contracts and
                    policies.
                  </div>
                )}
              </div>
            </Panel>
            <Panel
              title="Recent document activity"
              action={
                <Link to="/documents" className="text-link">
                  All documents <ArrowUpRight size={13} />
                </Link>
              }
              className="wide-panel"
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>DOCUMENT</th>
                      <th>TYPE</th>
                      <th>STATUS</th>
                      <th>ADDED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_documents.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <Link to={`/documents/${d.id}`} className="doc-cell">
                            <span className="file-icon">
                              <FileSearch size={16} />
                            </span>
                            <span>
                              <b>{d.file_name}</b>
                              {d.is_demo && <em>SYNTHETIC</em>}
                            </span>
                          </Link>
                        </td>
                        <td>{d.document_type}</td>
                        <td>
                          <Badge
                            tone={
                              d.processing_status === "analyzed"
                                ? "success"
                                : "info"
                            }
                          >
                            {d.processing_status}
                          </Badge>
                        </td>
                        <td>{formatDate(d.upload_date.slice(0, 10))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
      {data?.demo_mode && (
        <div className="demo-notice">
          <Sparkles size={15} />
          <span>
            <strong>Local demo workspace.</strong> Sample records are synthetic
            and not actual organization findings.
          </span>
        </div>
      )}
    </div>
  );
}
