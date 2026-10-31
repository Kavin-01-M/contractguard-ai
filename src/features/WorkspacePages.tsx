import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { api, uploadFile } from "../lib/api";
import type {
  DocumentRecord,
  Finding,
  Severity,
  Task,
  TaskStatus,
} from "../types/domain";
import {
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SeverityBadge,
  formatDate,
} from "../components/Primitives";

const docTypes = [
  "Vendor Contract",
  "Service-Level Agreement",
  "NDA",
  "Data Processing Agreement",
  "Internal Security Policy",
  "Privacy Policy",
  "Procurement Policy",
  "Other",
];
function ErrorLine({ error }: { error: unknown }) {
  return error ? (
    <div className="inline-error">
      {(error as Error).message || "Request failed. Please try again."}
    </div>
  ) : null;
}
function DocumentRow({
  doc,
  onDelete,
}: {
  doc: DocumentRecord;
  onDelete: (id: string) => void;
}) {
  return (
    <tr>
      <td>
        <Link to={`/documents/${doc.id}`} className="doc-cell">
          <span className="file-icon">
            <FileText size={16} />
          </span>
          <span>
            <b>{doc.file_name}</b>
            <small>
              v{doc.version} ·{" "}
              {doc.page_count
                ? `${doc.page_count} pages`
                : "page count unavailable"}
            </small>
          </span>
          {doc.is_demo && <em>SYNTHETIC</em>}
        </Link>
      </td>
      <td>{doc.document_type}</td>
      <td>
        <Badge tone={doc.processing_status === "analyzed" ? "success" : "info"}>
          {doc.processing_status}
        </Badge>
      </td>
      <td>
        <Badge
          tone={doc.extraction_status === "needs_ocr" ? "warning" : "neutral"}
        >
          {doc.extraction_status.replace("_", " ")}
        </Badge>
      </td>
      <td>{formatDate(doc.upload_date.slice(0, 10))}</td>
      <td>
        <button
          className="table-action danger-text"
          onClick={() => onDelete(doc.id)}
          aria-label="Delete document"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
export function DocumentsPage() {
  const qc = useQueryClient(),
    [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || ""),
    [type, setType] = useState(""),
    [progress, setProgress] = useState<Record<string, number>>({}),
    [uploadError, setUploadError] = useState("");
  const docs = useQuery({
    queryKey: ["documents", search, type],
    queryFn: () => api.documents(search, type),
  });
  const del = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => qc.invalidateQueries(),
  });
  const [docType, setDocType] = useState("Vendor Contract");
  const onDrop = async (files: File[]) => {
    setUploadError("");
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        setUploadError(`${file.name}: file exceeds 20 MB.`);
        continue;
      }
      const key = `${file.name}-${Date.now()}`;
      try {
        await uploadFile(file, docType, (value) =>
          setProgress((p) => ({ ...p, [key]: value })),
        );
        await qc.invalidateQueries();
      } catch (e) {
        setUploadError((e as Error).message);
      } finally {
        setProgress((p) => {
          const n = { ...p };
          delete n[key];
          return n;
        });
      }
    }
  };
  const drop = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 20 * 1024 * 1024,
  });
  function remove(id: string) {
    if (
      window.confirm(
        "Hide this document from the workspace? Stored bytes may be retained by the storage provider.",
      )
    )
      del.mutate(id);
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SOURCE LIBRARY"
        title="Documents"
        description="Upload and preserve contracts and policy sources before running cross-document analysis."
        action={
          <Button
            onClick={() =>
              document
                .getElementById("upload-zone")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          >
            <UploadCloud size={16} />
            Upload documents
          </Button>
        }
      />
      <Panel className="upload-panel">
        <div
          {...drop.getRootProps()}
          id="upload-zone"
          className={`dropzone ${drop.isDragActive ? "drag-active" : ""}`}
        >
          <input {...drop.getInputProps()} />
          <div className="upload-symbol">
            <UploadCloud size={20} />
          </div>
          <div>
            <strong>
              {drop.isDragActive
                ? "Drop source files here"
                : "Drag documents here or browse"}
            </strong>
            <p>PDF, DOCX, or TXT · maximum 20 MB per file</p>
          </div>
          <div className="upload-controls">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Document type"
            >
              {docTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                drop.open();
              }}
            >
              Choose files
            </Button>
          </div>
        </div>
        {Object.entries(progress).map(([name, value]) => (
          <div className="upload-progress" key={name}>
            <span>{name.split("-")[0]}</span>
            <div>
              <i style={{ width: `${value}%` }} />
            </div>
            <b>{value}%</b>
          </div>
        ))}
        <ErrorLine error={uploadError || del.error} />
      </Panel>
      <div className="list-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="Search documents"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
          />
        </div>
        <label className="select-filter">
          <Filter size={14} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All document types</option>
            {docTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <span className="result-count">{docs.data?.length || 0} documents</span>
      </div>
      <Panel className="table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>FILE</th>
                <th>DOCUMENT TYPE</th>
                <th>PROCESSING</th>
                <th>EXTRACTION</th>
                <th>UPLOADED</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {docs.data?.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onDelete={remove} />
              ))}
            </tbody>
          </table>
          {!docs.data?.length && (
            <EmptyState
              title="No source documents yet"
              description="Upload PDF, DOCX, or TXT files. For a guided preview, load the synthetic demo from Overview."
            />
          )}
        </div>
      </Panel>
      {Boolean(docs.data?.length) && (
        <div className="below-table">
          <span>
            Originals and extracted text remain linked to each source record.
          </span>
          <Link to="/obligations">
            View extracted obligations <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}

export function ObligationsPage() {
  const [q, setQ] = useState("");
  const data = useQuery({
    queryKey: ["obligations", q],
    queryFn: () => api.obligations(q),
  });
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CONTRACT DUTIES"
        title="Obligations"
        description="Structured duties extracted from source clauses. Unknown values stay unknown and require review."
        action={
          <Link to="/documents" className="button button-secondary">
            <UploadCloud size={15} />
            Add sources
          </Link>
        }
      />
      <div className="list-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="Find an obligation"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="result-count">{data.data?.length || 0} records</span>
      </div>
      <Panel className="table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>OBLIGATION / SOURCE</th>
                <th>RESPONSIBLE PARTY</th>
                <th>DEADLINE</th>
                <th>CATEGORY</th>
                <th>CONFIDENCE</th>
                <th>REVIEW</th>
              </tr>
            </thead>
            <tbody>
              {data.data?.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="obligation-cell">
                      <b>
                        {o.description.slice(0, 100)}
                        {o.description.length > 100 ? "…" : ""}
                      </b>
                      <Link to={`/documents/${o.document_id}`}>
                        {o.document_name} ·{" "}
                        {o.source_section || "section not provided"}
                      </Link>
                      <span className="quote-preview">“{o.exact_quote}”</span>
                    </div>
                  </td>
                  <td>{o.responsible_party}</td>
                  <td>
                    {o.deadline_duration
                      ? `${o.deadline_duration} ${o.deadline_unit} ${o.trigger_event !== "Unknown" ? "from trigger" : ""}`
                      : o.absolute_deadline || "Not specified"}
                  </td>
                  <td>{o.category}</td>
                  <td>
                    <span className="confidence-cell">
                      <span className="confidence-track">
                        <i
                          style={{
                            width: `${Math.round(o.confidence * 100)}%`,
                          }}
                        />
                      </span>
                      {Math.round(o.confidence * 100)}%
                    </span>
                  </td>
                  <td>
                    <Badge
                      tone={
                        o.review_status === "needs_review"
                          ? "warning"
                          : "success"
                      }
                    >
                      {o.review_status === "needs_review"
                        ? "Review required"
                        : "Extracted"}
                    </Badge>
                    {o.is_demo && <em className="demo-inline">DEMO</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.data?.length && (
            <EmptyState
              title="No obligations extracted"
              description="Upload a contract and run analysis. Each obligation will retain its source quotation and available section reference."
            />
          )}
        </div>
      </Panel>
    </div>
  );
}

export function RisksPage() {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["findings"],
    queryFn: () => api.findings(),
  });
  const [severity, setSeverity] = useState("All"),
    [status, setStatus] = useState("All");
  const findings = useMemo(
    () =>
      data.data?.filter(
        (f) =>
          (severity === "All" || f.severity === severity) &&
          (status === "All" || f.status === status),
      ) || [],
    [data.data, severity, status],
  );
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      api.reviewFinding(id, { decision }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="HUMAN REVIEW QUEUE"
        title="Risk Center"
        description="Potential gaps are prioritized for review; severity and evidence confidence are shown separately."
        action={
          <Button variant="secondary" onClick={() => data.refetch()}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />
      <div className="risk-summary-strip">
        <div>
          <span>Open</span>
          <b>{data.data?.filter((f) => f.status !== "Resolved").length || 0}</b>
        </div>
        <div>
          <span>High + Critical</span>
          <b className="risk-red">
            {data.data?.filter(
              (f) => f.severity === "High" || f.severity === "Critical",
            ).length || 0}
          </b>
        </div>
        <div>
          <span>Awaiting review</span>
          <b>
            {data.data?.filter((f) => f.status === "Awaiting Review").length ||
              0}
          </b>
        </div>
        <div className="risk-summary-note">
          <ShieldAlert size={17} />
          Scores are operational prioritization, not legal assessment.
        </div>
      </div>
      <div className="list-toolbar">
        <label className="select-filter">
          <Filter size={14} />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option>All</option>
            {["Critical", "High", "Medium", "Low"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="select-filter">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All</option>
            {["Open", "Awaiting Review", "Resolved"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <span className="result-count">{findings.length} findings</span>
      </div>
      <div className="risk-card-list">
        {findings.map((f) => (
          <FindingCard
            key={f.id}
            f={f}
            onReview={() => review.mutate({ id: f.id, decision: "Reviewed" })}
          />
        ))}
        {!findings.length && (
          <Panel>
            <EmptyState
              title="No findings in this view"
              description="Load synthetic demo data or analyze uploaded contract and policy documents."
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
function FindingCard({ f, onReview }: { f: Finding; onReview: () => void }) {
  return (
    <div className="risk-card">
      <div className={`risk-bar risk-${f.severity.toLowerCase()}`} />
      <div className="risk-card-main">
        <div className="risk-card-top">
          <div>
            <div className="eyebrow">{f.category}</div>
            <Link to={`/findings/${f.id}`}>
              <h3>{f.title}</h3>
            </Link>
          </div>
          <SeverityBadge severity={f.severity} />
        </div>
        <p>{f.explanation}</p>
        <div className="risk-evidence-line">
          {f.citations.slice(0, 2).map((c) => (
            <span key={`${c.document_name}-${c.role}`}>
              <FileText size={13} />
              {c.document_name}
              {c.section ? ` · ${c.section}` : ""}
            </span>
          ))}
        </div>
        <div className="risk-card-bottom">
          <span>
            Priority score <b>{f.score.toFixed(0)}/100</b>
          </span>
          <span>
            Evidence confidence <b>{Math.round(f.confidence * 100)}%</b>
          </span>
          <span>
            Status{" "}
            <Badge tone={f.status === "Resolved" ? "success" : "warning"}>
              {f.status}
            </Badge>
          </span>
          {f.is_demo && <Badge tone="demo">SYNTHETIC</Badge>}
          <Link to={`/findings/${f.id}`} className="text-link">
            Review evidence <ArrowUpRight size={13} />
          </Link>
          <button className="small-action" onClick={onReview}>
            <Check size={14} /> Mark reviewed
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeadlinesPage() {
  const qc = useQueryClient(),
    data = useQuery({ queryKey: ["deadlines"], queryFn: api.deadlines });
  const trigger = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      api.triggerDeadline(id, date),
    onSuccess: () => qc.invalidateQueries(),
  });
  const [month, setMonth] = useState(new Date());
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="TIME-BASED CONTROLS"
        title="Deadline Radar"
        description="A deadline is dated only when the contract trigger and required date information are known."
        action={
          <Button variant="secondary" onClick={() => data.refetch()}>
            <RefreshCw size={15} />
            Refresh
          </Button>
        }
      />
      <div className="deadline-layout">
        <Panel className="calendar-panel">
          <div className="calendar-toolbar">
            <button
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              ›
            </button>
          </div>
          <div className="calendar-grid calendar-weekdays">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: start }, (_, i) => (
              <div className="calendar-day muted-day" key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const num = i + 1;
              const marked = data.data?.some(
                (d) =>
                  d.due_date ===
                  `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(num).padStart(2, "0")}`,
              );
              return (
                <div
                  className={`calendar-day ${marked ? "has-deadline" : ""}`}
                  key={num}
                >
                  <span>{num}</span>
                  {marked && <i />}
                </div>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i />
              Recorded due date
            </span>
            <small>
              Relative dates remain unset until the trigger is recorded.
            </small>
          </div>
        </Panel>
        <Panel
          title="Upcoming and unresolved"
          className="deadline-detail-panel"
        >
          <div className="deadline-rows">
            {data.data?.map((d) => (
              <div className="deadline-detail-row" key={d.id}>
                <div className="deadline-date-chip">
                  <CalendarDays size={15} />
                  <strong>
                    {d.due_date ? formatDate(d.due_date) : "Trigger needed"}
                  </strong>
                </div>
                <div className="deadline-copy">
                  <b>{d.title}</b>
                  <span>
                    {d.document_name} · {d.owner}
                  </span>
                  <small>
                    {d.source_section || "Source section not provided"} ·
                    reminder {d.reminder_days} days before
                  </small>
                </div>
                <Badge
                  tone={
                    d.status === "Overdue"
                      ? "critical"
                      : d.due_date
                        ? "info"
                        : "warning"
                  }
                >
                  {d.status}
                </Badge>
                {!d.trigger_date && d.obligation_id && (
                  <Button
                    variant="ghost"
                    className="mini-button"
                    onClick={() => {
                      const value = window.prompt(
                        "Enter the date the contractual trigger occurred (YYYY-MM-DD). The due date will be calculated from the stored duration.",
                      );
                      if (value) trigger.mutate({ id: d.id, date: value });
                    }}
                  >
                    Record trigger
                  </Button>
                )}
              </div>
            ))}
            {!data.data?.length && (
              <EmptyState
                title="No deadlines recorded"
                description="Deadline entries appear after analysis; relative dates remain undated until trigger dates are known."
              />
            )}
          </div>
          <ErrorLine error={trigger.error} />
        </Panel>
      </div>
    </div>
  );
}

export function ActionsPage() {
  const qc = useQueryClient(),
    data = useQuery({ queryKey: ["tasks"], queryFn: api.tasks }),
    [show, setShow] = useState(false),
    [title, setTitle] = useState(""),
    [owner, setOwner] = useState(""),
    [due, setDue] = useState(""),
    [priority, setPriority] = useState<Severity>("Medium");
  const create = useMutation({
    mutationFn: api.createTask,
    onSuccess: () => {
      qc.invalidateQueries();
      setShow(false);
      setTitle("");
      setOwner("");
      setDue("");
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      status,
      comment,
    }: {
      id: string;
      status?: TaskStatus;
      comment?: string;
    }) => api.updateTask(id, { status, comment }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const groups: TaskStatus[] = [
    "Open",
    "In Progress",
    "Awaiting Review",
    "Resolved",
  ];
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="REMEDIATION WORKFLOW"
        title="Action Center"
        description="Assign review work, record decisions, and keep task status history attached to the evidence."
        action={
          <Button onClick={() => setShow(!show)}>
            <Plus size={16} />
            New task
          </Button>
        }
      />
      {show && (
        <Panel className="task-form-panel">
          <div className="task-form-grid">
            <label>
              Task title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Describe the review action"
              />
            </label>
            <label>
              Assigned owner
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Role or reviewer"
              />
            </label>
            <label>
              Due date
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label>
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Severity)}
              >
                {["Critical", "High", "Medium", "Low"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="heading-buttons">
            <Button
              onClick={() =>
                create.mutate({
                  title,
                  owner: owner || "Unassigned",
                  due_date: due || null,
                  priority,
                })
              }
              disabled={title.trim().length < 3 || create.isPending}
            >
              <Check size={15} />
              Create task
            </Button>
            <Button variant="ghost" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <ErrorLine error={create.error} />
          </div>
        </Panel>
      )}
      <div className="task-kanban">
        {groups.map((group) => {
          const rows = data.data?.filter((t) => t.status === group) || [];
          return (
            <section className="task-column" key={group}>
              <div className="task-column-head">
                <h2>{group}</h2>
                <span>{rows.length}</span>
              </div>
              {rows.map((t) => (
                <TaskCard
                  task={t}
                  key={t.id}
                  onStatus={(status) => update.mutate({ id: t.id, status })}
                  onComment={() => {
                    const comment = window.prompt(
                      "Add a comment to the task history",
                    );
                    if (comment) update.mutate({ id: t.id, comment });
                  }}
                />
              ))}
              {!rows.length && (
                <div className="task-column-empty">
                  No {group.toLowerCase()} tasks
                </div>
              )}
            </section>
          );
        })}
      </div>
      <ErrorLine error={update.error} />
    </div>
  );
}
function TaskCard({
  task,
  onStatus,
  onComment,
}: {
  task: Task;
  onStatus: (s: TaskStatus) => void;
  onComment: () => void;
}) {
  return (
    <article className="task-card">
      <div className="task-card-top">
        <Badge tone={task.priority}>{task.priority}</Badge>
        <button
          className="table-action"
          onClick={onComment}
          title="Add comment"
        >
          <Plus size={15} />
        </button>
      </div>
      <h3>{task.title}</h3>
      <p>{task.description || "No additional description."}</p>
      <div className="task-card-meta">
        <span>
          <i className="avatar-mini">{task.owner.slice(0, 1)}</i>
          {task.owner}
        </span>
        <span>
          <CalendarDays size={13} />
          {formatDate(task.due_date)}
        </span>
      </div>
      {task.comments?.length > 0 && (
        <div className="task-comment-count">
          {task.comments.length} comments in history
        </div>
      )}
      <select
        value={task.status}
        onChange={(e) => onStatus(e.target.value as TaskStatus)}
        aria-label="Task status"
      >
        {["Open", "In Progress", "Awaiting Review", "Resolved"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      {task.finding_id && (
        <Link className="task-source-link" to={`/findings/${task.finding_id}`}>
          Open linked finding <ArrowUpRight size={13} />
        </Link>
      )}
    </article>
  );
}

export function AuditPage() {
  const data = useQuery({ queryKey: ["audit"], queryFn: api.audit });
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="APPEND-ONLY RECORD"
        title="Audit Trail"
        description="Important workspace actions, reviewer decisions, and changes are recorded with actor and timestamp."
      />
      <Panel className="table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>EVENT</th>
                <th>ACTOR</th>
                <th>AFFECTED RECORD</th>
                <th>DETAIL</th>
                <th>TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {data.data?.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="audit-event">
                      <i />
                      <b>{a.event_type.replace(/[._]/g, " ")}</b>
                    </span>
                  </td>
                  <td>{a.actor_id}</td>
                  <td>
                    {a.entity_type} ·{" "}
                    <code>{a.entity_id?.slice(0, 8) || "—"}</code>
                  </td>
                  <td className="audit-detail">
                    {Object.keys(a.metadata).length
                      ? JSON.stringify(a.metadata)
                      : "—"}
                  </td>
                  <td>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.data?.length && (
            <EmptyState
              title="No activity yet"
              description="Uploads, analyses, reviewer decisions, task updates, and resolutions are recorded here."
            />
          )}
        </div>
      </Panel>
    </div>
  );
}

export function SettingsPage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="WORKSPACE CONFIGURATION"
        title="Settings"
        description="Inspect platform, analysis, and privacy posture for this project."
      />
      <div className="settings-grid">
        <Panel title="Organization">
          <div className="settings-row">
            <div>
              <b>Active workspace</b>
              <span>
                Workspace context is isolated by organization membership.
              </span>
            </div>
            <Badge tone="info">Current</Badge>
          </div>
          <div className="settings-row">
            <div>
              <b>Reviewer role</b>
              <span>
                Review severity overrides and significant tasks with a recorded
                reason.
              </span>
            </div>
            <Badge tone="neutral">Reviewer</Badge>
          </div>
        </Panel>
        <Panel title="Data & analysis">
          <div className="settings-row">
            <div>
              <b>Database engine</b>
              <span>
                {health.data?.database || "Checking…"} · PostgreSQL/pgvector can
                be used through an external DSN.
              </span>
            </div>
            <Badge
              tone={
                health.data?.database === "postgresql" ? "success" : "warning"
              }
            >
              {health.data?.database || "Unknown"}
            </Badge>
          </div>
          <div className="settings-row">
            <div>
              <b>Policy retrieval</b>
              <span>
                Lexical relevance is a review aid and is never proof of
                compliance.
              </span>
            </div>
            <Badge tone="info">
              {health.data?.semantic_search || "Loading"}
            </Badge>
          </div>
          <div className="settings-row">
            <div>
              <b>External AI</b>
              <span>Document contents are not sent to an LLM by default.</span>
            </div>
            <Badge tone="success">Disabled by default</Badge>
          </div>
          <div className="settings-row">
            <div>
              <b>Authentication</b>
              <span>
                Hosted mode expects a validated Manus account session. Local
                demo mode is labeled.
              </span>
            </div>
            <Badge tone="neutral">{health.data?.auth_mode || "Checking"}</Badge>
          </div>
        </Panel>
        <Panel title="Risk scoring">
          <div className="settings-copy">
            <p>
              Default weighted score (configurable in the backend): impact 30%,
              deadline urgency 25%, likelihood 20%, control gap 15%, and
              evidence confidence 10%.
            </p>
            <p>
              Evidence confidence is shown separately from severity. Scores
              prioritize review only; they are not legally validated
              assessments.
            </p>
          </div>
        </Panel>
        <Panel title="Privacy & retention">
          <div className="settings-copy">
            <p>
              Uploaded bytes are saved to a private local storage directory in
              the reference implementation. For hosted production, attach a
              durable private object store and its authorization layer before
              storing confidential contracts.
            </p>
            <p>
              Soft-deleting a document hides its workspace record; it does not
              claim that the storage provider has physically erased its bytes.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
