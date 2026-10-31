import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Info, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { sourceLocation } from "../lib/evidence";
import {
  Badge,
  PageHeading,
  Panel,
  formatDate,
} from "../components/Primitives";

export default function DocumentDetail() {
  const { id = "" } = useParams();
  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.document(id),
    enabled: !!id,
  });
  if (isLoading)
    return <div className="loading-state">Loading source record…</div>;
  if (!doc)
    return (
      <div className="page-stack">
        <Link to="/documents" className="back-link">
          <ArrowLeft size={15} />
          Documents
        </Link>
        <Panel>Document not found in this organization.</Panel>
      </div>
    );
  return (
    <div className="page-stack">
      <Link to="/documents" className="back-link">
        <ArrowLeft size={15} />
        Documents
      </Link>
      <PageHeading
        eyebrow="SOURCE RECORD"
        title={doc.file_name}
        description={`${doc.document_type} · version ${doc.version} · uploaded ${formatDate(doc.upload_date.slice(0, 10))}`}
        action={
          <a
            href={`/api/documents/${doc.id}/file`}
            className="button button-secondary"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={15} />
            Open original
          </a>
        }
      />
      {doc.is_demo && (
        <div className="demo-notice">
          <ShieldCheck size={15} />
          <span>
            <strong>Synthetic sample source.</strong> This document and its
            analysis are demonstration content, not actual organizational
            records.
          </span>
        </div>
      )}
      <div className="doc-detail-grid">
        <div>
          <Panel title="Processing & extraction">
            <div className="doc-meta-grid">
              <div>
                <span>Processing</span>
                <Badge tone="success">{doc.processing_status}</Badge>
              </div>
              <div>
                <span>Extraction</span>
                <Badge
                  tone={
                    doc.extraction_status === "needs_ocr"
                      ? "warning"
                      : "success"
                  }
                >
                  {doc.extraction_status.replace("_", " ")}
                </Badge>
              </div>
              <div>
                <span>Page count</span>
                <b>{doc.page_count ?? "Not available"}</b>
              </div>
              <div>
                <span>Organization record</span>
                <code>{doc.organization_id.slice(0, 8)}…</code>
              </div>
              <div>
                <span>Original version</span>
                <b>v{doc.version}</b>
              </div>
              <div>
                <span>Text extracted</span>
                <b>{doc.text_length.toLocaleString()} characters</b>
              </div>
            </div>
          </Panel>
          <Panel title="Extracted obligations">
            <div className="doc-obligations">
              {doc.obligations?.length ? (
                doc.obligations.map((o) => (
                  <div className="doc-obligation" key={o.id}>
                    <span className="obligation-number">{o.category}</span>
                    <blockquote>{o.exact_quote}</blockquote>
                    <div>
                      <Badge
                        tone={
                          o.review_status === "needs_review"
                            ? "warning"
                            : "success"
                        }
                      >
                        {o.review_status}
                      </Badge>
                      <span>
                        {o.responsible_party} ·{" "}
                        {o.deadline_duration
                          ? `${o.deadline_duration} ${o.deadline_unit}`
                          : "deadline not specified"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted small padding-16">
                  No obligations linked to this document yet. Run analysis to
                  inspect eligible clauses.
                </div>
              )}
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Clause references">
            <div className="clause-list">
              {doc.clauses?.map((c, index) => (
                <article key={c.id} className="source-clause">
                  <div>
                    <span className="clause-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="source-loc">
                      {sourceLocation(c.section, c.page_number)}
                    </span>
                    <Badge tone={c.is_policy ? "success" : "info"}>
                      {c.is_policy ? "Policy" : "Contract"}
                    </Badge>
                  </div>
                  <p>{c.text}</p>
                </article>
              ))}
            </div>
            {!doc.clauses?.length && (
              <p className="muted small">
                No clauses were extracted from this source.
              </p>
            )}
          </Panel>
          <Panel className="source-note">
            <div>
              <Info size={16} />
              <span>
                Quotes and section references reflect extracted text. Page and
                section values remain blank if unavailable; the viewer does not
                invent citations.
              </span>
            </div>
          </Panel>
        </div>
      </div>
      <Panel title="Extracted source text" className="extracted-text-panel">
        <pre>{doc.extracted_text || "No text extracted."}</pre>
      </Panel>
    </div>
  );
}
