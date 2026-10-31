# ContractGuard AI — Implementation Plan

## Approved direction

Build ContractGuard AI as a functional evidence-first compliance workspace. Use the managed Webdev project for the Preview and the already-enabled managed MySQL-compatible database when its DSN is available. Do not describe MySQL as PostgreSQL or pgvector. Keep FastAPI as the product API; provide a local/Docker PostgreSQL + pgvector configuration and a MySQL-compatible SQLAlchemy path for the managed host. Use exact environment-based database selection and a labeled SQLite fallback for local demo runs where no DSN is configured. This build implements lexical ranking only; the PostgreSQL/pgvector image is infrastructure, not wired vector search. Similarity is a review signal, never proof of compliance.

The frontend is a Vite + React + TypeScript SPA. Vite serves Preview on the configured port 3000 and proxies `/api` to the FastAPI process on port 8000. The application API and database schema/migrations live in `backend/`; the frontend build can be served by FastAPI in the root container for a one-port production deployment. A root Docker Compose configuration runs the app and PostgreSQL with the pgvector image. Uploaded bytes are currently stored on a private local filesystem; there is no object-storage adapter in this implementation, so hosted production must configure durable private storage before confidential uploads. Keep original text and evidence references with records.

No external LLM provider receives document contents by default. The implemented analyzer uses deterministic extraction and lexical rules; the evidence assistant uses source-grounded response templates and does not call an LLM. Adding a provider requires a separately authorized configuration step with server-side credentials only. Demo data is synthetic, opt-in, clearly labeled, and must never be presented as real organization findings. The live UI makes stored evidence paths inspectable from contract clause through obligation and policy match to finding and task. Unknown fields stay unknown and require review. Risks are potential operational issues, never legal conclusions.

## Implementation approach

1. Create a coherent design system and multi-page dashboard shell with working navigation, search, organization context, notifications, and profile/session states.
2. Build typed domain records, a FastAPI API, SQLAlchemy models, migration setup, upload/text-extraction services (TXT plus optional PDF/DOCX parser support), and reusable evidence references.
3. Implement deterministic structured obligation extraction, lexical policy retrieval and mappings, and transparent risk scoring/rules with citation validation.
4. Implement actual stored relationship graph data, evidence-first finding detail, calendar-aware deadline trigger handling, task lifecycle/history, and append-only audit events. Scheduled reminder delivery is not implemented in this build.
5. Add opt-in synthetic demo seed data, API documentation, tests, Docker/local setup, and an accurate README. Do not report metrics until an evaluation has actually been run.

## Architecture and project structure

- `src/`: React app entry, routes, layouts, and feature screens.
- `src/components/`: reusable navigation, tables, badges, evidence blocks, charts, dialogs, and form elements.
- `src/features/`: dashboard, documents, obligations, graph, findings/copilot, deadlines, tasks, audit, and settings UI/domain clients.
- `src/lib/`: API client, query client, formatting, permissions/session display, and validation helpers.
- `src/types/`: shared frontend API/domain types.
- `backend/app/`: FastAPI app, Pydantic schemas, SQLAlchemy models, services, routes, rules, retrieval, extraction, authentication, storage, and audit logic.
- `backend/alembic/`: versioned relational schema migrations.
- `backend/tests/`: unit/integration tests for parsing, schemas, retrieval, risk/evidence, authorization, tasks, and reminders.
- `backend/demo/`: synthetic demonstration fixture documents and deterministic seed records.
- `public/`: app mark, static metadata, and required `/manus-routes.json`.
- Root: pinned Node tooling/config, `pyproject.toml`, `.env.example`, `README.md`, `Dockerfile`, and `docker-compose.yml`.

## Design

- **Alternative styles (low-probability tails):** Swiss editorial legal ledger (0.06); warm paper archive with vermilion marks (0.04); dark terminal SOC console (0.03). Chosen: Swiss editorial legal ledger, adapted to the requested white/light surfaces and deep navy enterprise palette.
- **Design Movement:** Swiss editorial information design meets a modern compliance control room.
- **Core Principles:** Evidence before interpretation; compact hierarchy for high information density; clear separation of severity and confidence; calm, accessible controls that make human review explicit.
- **Color Philosophy:** Deep ink navy communicates authority and focus; cool slate and paper-white keep dense evidence legible; restrained amber/red/green are reserved for risk and workflow states. Brand signature is a crisp electric-cobalt accent for evidence links and active analysis, not decorative gradients.
- **Layout Paradigm:** Persistent, narrow left rail and top command strip frame a broad working canvas. Detail screens use paired interpretation/evidence columns; list screens prioritize filters and source-aware rows instead of generic oversized metric tiles.
- **Signature Elements:** Fine ruled dividers and numbered evidence markers; compact source chips linking page/section references; a small shield/check wordmark that doubles as an evidence-path motif.
- **Interaction Philosophy:** Every action has an explicit consequence and status; review and resolution are reversible/audited; source citations open their document context; confidence never masquerades as severity.
- **Animation:** Restrained 120–180 ms hover/focus transitions, quiet panel/dialog entry, no ambient motion, respect reduced-motion preferences.
- **Typography System:** Geist Sans for UI and Inter fallback; Geist Mono for IDs, scores, and citations. Use tabular numerals for metrics and a compact type scale with strong, readable section labels.
- **Brand Essence:** A source-traceable contract control workspace for legal, security, and procurement teams; precise, sober, accountable.
- **Brand Voice:** Direct, evidence-qualified, and non-alarmist. Examples: “Review the escalation path against the 24-hour notice clause.” “Evidence is incomplete; confirm the responsible owner before closing.”
- **Wordmark & Logo:** Custom `CG` monogram formed by two document rules inside an open shield/check outline, paired with a carefully spaced ContractGuard AI wordmark.
- **Signature Brand Color:** Evidence cobalt `#3157D5`.

## Material constraints

- The managed data service is MySQL-compatible and project-shared across development/publication; schema and data changes affect that same database. PostgreSQL/pgvector is available through the local/Docker path or an explicitly supplied external DSN, not via the managed MySQL DSN.
- The UI and README must not claim unimplemented LLM/embedding analysis, OCR, scheduled reminder delivery, object-storage integration, physical object deletion, or measured evaluation. Hosted authentication is organization-scoped, OAuth state is signed and nonce-bound, redirects use an exact `CONTRACTGUARD_ALLOWED_ORIGINS` allowlist, and reviewer/admin/owner write boundaries are enforced. The real platform OAuth exchange should still be exercised with an authorized account before production use. Any fallback mode is visible and accurately described.
- The managed server uses platform environment variables at runtime; secrets stay server-side. Preview is embedded cross-site and the route manifest must describe all app pages before starting the dev server.
