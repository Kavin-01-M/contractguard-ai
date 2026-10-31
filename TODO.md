# ContractGuard AI — Outcome Checklist

> Requirements below preserve the attached brief's explicit outcomes. Demo content is synthetic and must be labeled as such. Do not mark an outcome complete without the relevant implementation evidence. Completed items are checked; partially delivered items remain open.

## 1. Responsive enterprise workspace and navigation
- [ ] Build a professional enterprise SaaS interface with white/light-gray surfaces, deep navy primary color, slate-colored text, red/amber/green risk indicators, Inter or Geist typography, consistent spacing, rounded cards, subtle borders/shadows, restrained hover transitions, and responsive desktop/tablet/mobile layouts.
- [ ] Avoid generic template-looking dashboards, excessive gradients/animations, large empty spaces, unnecessary decoration, and fake statistics presented as real analysis results. Use reusable design components.
- [ ] Keep a persistent left sidebar with Overview, Documents, Obligations, Compliance Intelligence, Risk Center, Deadline Radar, Action Center, Audit Trail, Settings. Top navigation includes global search, current organization selector, notification bell, user profile menu, and breadcrumbs where appropriate. The main content changes with the selected page.

## 2. Data-backed dashboard and onboarding
- [x] Show total contracts analyzed, extracted obligations, open compliance findings, high-priority risks, upcoming deadlines, and findings awaiting review using database-derived values rather than hardcoded numbers.
- [x] Include risk distribution, obligations by category, upcoming deadline timeline, recent findings, recent document activity, and quick actions: Upload Documents, Analyze Documents, Review High-Risk Findings, View Upcoming Deadlines.
- [x] When the database is empty, show useful onboarding and an action to load clearly labeled demo data.

## 3. Document management and source preservation
- [x] Support drag/drop upload, validation, progress, processing status, search, type filters, detail view, deletion confirmation, version tracking, and processing errors for PDF, DOCX, and TXT.
- [x] Document types: Vendor Contract, Service-Level Agreement, NDA, Data Processing Agreement, Internal Security Policy, Privacy Policy, Procurement Policy, Other.
- [x] Store document ID, filename, type, upload date, processing status, page count when available, extraction status, organization ID, and version. Preserve the original file and extracted text. Every extracted clause retains document ID and available page/section references.
- [x] Treat uploads as untrusted, validate file type/size and API inputs, protect file access, handle errors, and support deletion workflow without claiming physical deletion when storage does not provide it.

## 4. Obligation extraction and evidence
- [ ] Extract structured obligations with ID, description, responsible party, required action, object, triggering event, deadline duration/unit, absolute deadline where applicable, category, explicit consequence, source document/page/clause, exact supporting quote, extraction confidence, and review status.
- [ ] Validate structured output with Pydantic. Do not invent information absent from the source. Unknown actor, deadline, or trigger must remain unknown and be flagged for review.
- [ ] Preserve source quotation, document ID, and available page/section evidence; never fabricate citations.

## 5. Policy retrieval and relationship graph
- [ ] Retrieve relevant internal policy clauses for obligations using sentence embeddings, PostgreSQL pgvector where configured, keyword matching, optional metadata filtering/reranking; return source references.
- [ ] Store obligation ID, policy clause ID, relevance score, relationship type, supporting evidence, explanation, review status. Relationship types: Supports, Potentially conflicts with, Partially supports, Insufficient evidence, Requires human review.
- [ ] Do not treat semantic similarity as proof of compliance. Compare meaning, deadlines, actors, conditions, scope, exceptions, and applicability.
- [ ] Build an interactive React Flow graph with document, contract clause, obligation, policy clause, finding, recommended-action nodes and CONTAINS, CREATES_OBLIGATION, MATCHES_POLICY, SUPPORTS, POTENTIALLY_CONFLICTS_WITH, GENERATES_FINDING, REQUIRES_ACTION edges. It displays stored relationships, distinguishes node types and risk colors, supports click-to-details/evidence/relationship rationale, filters by document/category/risk, pan/zoom, and highlights the evidence path.

## 6. Transparent risk detection and prioritization
- [ ] Implement explainable rules for potential deadline conflict, missing policy coverage, potentially weaker internal control, missing responsible owner, upcoming contractual deadline, upcoming renewal/notice deadline, conflicting internal policy clauses, and missing/insufficient supporting evidence.
- [ ] Different recipients do not establish a direct contradiction: a 24-hour client notification and 72-hour internal reporting should be treated as a possible operational gap/review question, not an assumed conflict. Insufficient evidence must not become a manufactured conclusion.
- [ ] Every finding stores ID, category, title, explanation, contract evidence, applicable policy evidence, confidence, severity, status, suggested action, assigned owner, created date, and review history.
- [ ] Prioritize by configurable weighted impact, deadline urgency, likelihood, control coverage, and evidence confidence. Keep confidence separate from severity. Labels: Critical, High, Medium, Low. Explain severity; do not call a score a legally validated assessment. Authorized severity overrides require a recorded reason.

## 7. Evidence-first finding view and contextual copilot
- [ ] Finding detail uses two columns. Left: title, severity, explanation, risk factors, recommended action, owner, review status. Right: contract/policy source evidence, filename, page, section, exact quote, relationship explanation, and original-document page opening when supported; highlight source text when possible.
- [ ] Every substantive finding traces to evidence. Never fabricate page numbers, quotations, sections, or citations.
- [ ] Contextual copilot answers why flagged, supporting clauses, possible business impact, missing information, review recommendations, and relevant policy clause using retrieved evidence with citations. Say when evidence is insufficient and additional review is needed.
- [ ] Proposed action plans include action description, suggested owner role, priority, due date only when justified, and supporting evidence. No autonomous policy changes, external legal notices, or declarations of legal violations; human approval before significant actions.

## 8. Deadline Radar and reminders
- [ ] Provide calendar, upcoming/overdue obligations, renewal notice deadlines, filters, owner, related contract, source evidence, and reminder configuration.
- [ ] Support relative deadlines. Do not calculate a final date unless trigger and required date information are known. Authorized users may record a trigger date. Implement in-app notifications and scheduled reminders initially.

## 9. Action Center and audit trail
- [ ] Create tasks from findings; assign users, set due dates/priority, update status, add comments/evidence, record resolution notes, resolve findings after review, reopen when needed, and record status-change history.
- [ ] Statuses: Open, In Progress, Awaiting Review, Resolved.
- [ ] Append-only normal-operation audit events cover document upload/deletion, analysis, extraction, policy mapping, risk generation, severity changes, reviewer decisions, task assignments, and resolution. Store timestamp, actor ID, affected entities, and change metadata; no API keys or unnecessary sensitive text.

## 10. Organization data, API, and security
- [ ] Relational schema for organizations, users, memberships, documents, versions, clauses, obligations, deadlines, policy mappings, findings, evidence citations, action tasks, notifications, human reviews, and audit logs. Use UUIDs, foreign keys, indexes, timestamps, constraints, organization-level isolation, and migrations.
- [ ] Provide documented REST endpoints for auth, documents/processing, clauses, obligations, policy search/mappings, compliance analysis, findings, deadlines, tasks, notifications, audit history; consistent responses and meaningful HTTP status codes; FastAPI OpenAPI docs.
- [ ] Secure authentication, role-based access control, organization authorization, size/type validation, safe storage, API validation, rate limiting where appropriate, env-based secrets, unauthorized-file protection, clear errors, data deletion workflows. Resist instructions embedded in uploaded documents. Do not send confidential documents to an external AI provider without explicit configuration and user authorization.

## 11. Synthetic demonstration and non-fabrication
- [x] Provide clearly labeled synthetic demo documents: two vendor contracts, two internal policies, one incident-response procedure, one data-retention policy; at least ten synthetic obligations, several mappings/findings, sample action tasks and upcoming deadlines.
- [x] Demonstrate contract obligation → relevant policy → comparison → potential gap/conflict → exact evidence → reviewer-assigned task. Never present synthetic results as actual organizational findings.
- [ ] If no external AI key is configured, provide a clearly labeled demo mode and provider abstraction.

## 12. Testing, evaluation, setup, and deliverables
- [ ] Provide unit/integration tests for PDF/DOCX extraction, obligation schema, deadlines, semantic retrieval, deadline-conflict and missing-policy coverage detection, citation validation, risk scoring, authorization, organization isolation, task creation, reminder scheduling.
- [ ] Create a manually labeled test dataset. Measure extraction precision/recall/F1, retrieval precision@k, risk precision/recall, evidence citation accuracy, and deadline extraction accuracy; report measured results only after running the evaluation.
- [ ] Provide complete frontend/backend source, schema/migrations, extraction pipeline, retrieval, rule engine, relationship graph, evidence-first findings, deadlines, tasks, synthetic docs, automated tests, Docker Compose, `.env.example` without real secrets, README with exact frontend/backend commands, API docs, and architecture explanation.
- [ ] Ensure application starts successfully. Do not stop at diagrams/pseudocode/mockups or leave critical features as empty functions/TODOs.
- [ ] Acceptance flow: upload contract and internal policy; run analysis; inspect extracted obligations and policy matches; identify potential compliance risks; inspect exact source evidence; assign an action task; review audit history.
