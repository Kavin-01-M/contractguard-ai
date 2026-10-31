import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Check,
  ClipboardList,
  FileSearch,
  MessageSquareText,
  Send,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { api } from "../lib/api";
import { sourceLocation } from "../lib/evidence";
import {
  Badge,
  Button,
  PageHeading,
  Panel,
  SeverityBadge,
  formatDate,
} from "../components/Primitives";
export default function FindingDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data: finding, isLoading } = useQuery({
    queryKey: ["finding", id],
    queryFn: () => api.finding(id),
    enabled: !!id,
  });
  const [question, setQuestion] = useState("Why was this flagged?");
  const [answer, setAnswer] = useState<{
    answer: string;
    citations: Array<{
      document_name: string;
      quote: string;
      section: string | null;
      page_number: number | null;
      role: string;
    }>;
  } | null>(null);
  const review = useMutation({
    mutationFn: (decision: string) => api.reviewFinding(id, { decision }),
    onSuccess: () => {
      qc.invalidateQueries();
      qc.invalidateQueries({ queryKey: ["finding", id] });
    },
  });
  const task = useMutation({
    mutationFn: () =>
      api.createTask({
        title: `Review: ${finding?.category || "compliance finding"}`,
        description: finding?.suggested_action || "",
        finding_id: id,
        owner: finding?.assigned_owner || "Unassigned",
        priority: finding?.severity || "Medium",
      }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const copilot = useMutation({
    mutationFn: () => api.copilot(id, question),
    onSuccess: setAnswer,
  });
  if (isLoading)
    return <div className="loading-state">Loading source evidence…</div>;
  if (!finding)
    return (
      <div className="page-stack">
        <Link to="/risks" className="back-link">
          <ArrowLeft size={15} />
          Back to Risk Center
        </Link>
        <Panel>Finding not found in this organization.</Panel>
      </div>
    );
  return (
    <div className="page-stack">
      <Link to="/risks" className="back-link">
        <ArrowLeft size={15} />
        Risk Center
      </Link>
      <PageHeading
        eyebrow={`FINDING · ${finding.category.toUpperCase()}`}
        title={finding.title}
        description={`${finding.is_demo ? "Synthetic demonstration finding · " : ""}Created ${formatDate(finding.created_at.slice(0, 10))}`}
        action={
          <div className="heading-buttons">
            <SeverityBadge severity={finding.severity} />
            <Badge tone={finding.status === "Resolved" ? "success" : "warning"}>
              {finding.status}
            </Badge>
          </div>
        }
      />
      <div className="finding-detail-grid">
        <div className="finding-main-column">
          <Panel title="Finding assessment">
            <p className="finding-explanation">{finding.explanation}</p>
            <div className="risk-factor-grid">
              <div>
                <span>Prioritization score</span>
                <strong>
                  {finding.score.toFixed(1)}
                  <small>/100</small>
                </strong>
              </div>
              <div>
                <span>Evidence confidence</span>
                <strong>
                  {Math.round(finding.confidence * 100)}
                  <small>%</small>
                </strong>
              </div>
              <div>
                <span>Severity</span>
                <strong>
                  <SeverityBadge severity={finding.severity} />
                </strong>
              </div>
            </div>
            <div className="scoring-note">
              <ShieldAlert size={15} />
              <span>
                Transparent review-priority score; not a legally validated
                assessment. Evidence confidence is distinct from severity.
              </span>
            </div>
          </Panel>
          <Panel title="Recommended action">
            <div className="recommendation-box">
              <span className="recommendation-icon">
                <ClipboardList size={17} />
              </span>
              <div>
                <b>
                  {finding.suggested_action ||
                    "Review the source clauses and determine the appropriate control owner."}
                </b>
                <p>
                  Significant actions require human approval. No external notice
                  or policy change is taken automatically.
                </p>
              </div>
            </div>
            <div className="owner-line">
              <span>
                <UserRound size={15} />
                Suggested owner
              </span>
              <b>{finding.assigned_owner || "Unassigned"}</b>
            </div>
            <div className="heading-buttons">
              <Button
                onClick={() => task.mutate()}
                disabled={task.isPending || task.isSuccess}
              >
                <ClipboardList size={15} />
                {task.isSuccess ? "Task created" : "Create action task"}
              </Button>
              {finding.status === "Resolved" ? (
                <Button
                  variant="secondary"
                  onClick={() => review.mutate("Reopened")}
                >
                  Reopen finding
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => review.mutate("Resolved")}
                >
                  <Check size={15} />
                  Mark resolved
                </Button>
              )}
            </div>
            {(task.error || review.error) && (
              <div className="inline-error">
                {((task.error || review.error) as Error).message}
              </div>
            )}
          </Panel>
          <Panel title="AI Risk Copilot" className="copilot-panel">
            <div className="copilot-intro">
              <span>
                <Bot size={17} />
              </span>
              <div>
                <b>Evidence-grounded assistant</b>
                <p>
                  Answers are generated from this finding’s saved citations;
                  unsupported claims are not inferred.
                </p>
              </div>
              <Badge tone="neutral">{answer ? "Evidence-only" : "Ready"}</Badge>
            </div>
            <div className="suggestion-chips">
              {[
                "Why was this flagged?",
                "What information is missing?",
                "Which clauses support this?",
              ].map((q) => (
                <button key={q} onClick={() => setQuestion(q)}>
                  {q}
                </button>
              ))}
            </div>
            <div className="copilot-input">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && question.trim()) copilot.mutate();
                }}
                placeholder="Ask about the evidence…"
              />
              <Button
                onClick={() => copilot.mutate()}
                disabled={copilot.isPending || !question.trim()}
                aria-label="Ask copilot"
              >
                <Send size={15} />
              </Button>
            </div>
            {copilot.error && (
              <div className="inline-error">
                {(copilot.error as Error).message}
              </div>
            )}
            {answer && (
              <div className="copilot-answer">
                <div>
                  <MessageSquareText size={15} />
                  <b>Answer</b>
                </div>
                <p>{answer.answer}</p>
                <div className="copilot-citations">
                  {answer.citations.map((c, i) => (
                    <div key={i}>
                      <span>
                        {c.document_name}
                        {c.section ? ` · ${c.section}` : ""}
                        {c.page_number ? ` · p. ${c.page_number}` : ""}
                      </span>
                      <q>{c.quote}</q>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
        <div className="finding-evidence-column">
          <div className="evidence-column-title">
            <div>
              <span className="eyebrow">SOURCE RECORD</span>
              <h2>Evidence</h2>
            </div>
            <span className="evidence-count">
              {finding.citations.length} citations
            </span>
          </div>
          {finding.citations.length ? (
            finding.citations.map((citation, i) => (
              <Panel
                key={citation.id || i}
                className={`evidence-card evidence-${citation.role}`}
              >
                <div className="evidence-card-head">
                  <span className={`evidence-role ${citation.role}`}>
                    {citation.role === "contract"
                      ? "CONTRACT EVIDENCE"
                      : "POLICY EVIDENCE"}
                  </span>
                  <Link
                    to={
                      citation.document_id
                        ? `/documents/${citation.document_id}`
                        : "#"
                    }
                    className="evidence-open"
                  >
                    <FileSearch size={14} />
                    {citation.document_name}
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
                <div className="evidence-location">
                  {sourceLocation(citation.section, citation.page_number)}
                </div>
                <blockquote>{citation.quote}</blockquote>
                <p className="evidence-explain">{citation.explanation}</p>
                <a
                  href={
                    citation.document_id
                      ? `/api/documents/${citation.document_id}/file`
                      : undefined
                  }
                  className="open-original"
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileSearch size={14} />
                  Open original source <ArrowUpRight size={13} />
                </a>
              </Panel>
            ))
          ) : (
            <Panel>
              <p className="muted">
                No exact evidence citations are stored for this finding.
                Additional review is needed.
              </p>
            </Panel>
          )}
          <div className="evidence-caveat">
            Source quotations are retained exactly as extracted. Missing page or
            section references are left blank; no citation is fabricated.
          </div>
        </div>
      </div>
    </div>
  );
}
