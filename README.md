# ContractGuard AI

ContractGuard AI is an evidence-first contract and compliance review workspace. It connects extracted contractual duties to internal policy clauses, records the evidence behind each relationship, prioritizes review questions, and routes follow-up into task and audit workflows. Retrieval similarity is a review signal, never proof of compliance; findings are operational review prompts, not legal conclusions.

## Stack and runtime compatibility

The frontend uses React, TypeScript, Vite, Tailwind, React Router, TanStack Query, Lucide, Recharts, React Flow, and drag-and-drop uploads. The API uses FastAPI, Pydantic, SQLAlchemy, and Alembic. SQLAlchemy supports local SQLite, the managed host's MySQL-compatible database when its `DATABASE_URL` is injected, and an externally provisioned PostgreSQL DSN. The managed service is MySQL-compatible; it is not PostgreSQL and does not provide pgvector. Docker Compose includes PostgreSQL with the pgvector image as optional infrastructure, but this application build does not wire embeddings or pgvector queries. Policy retrieval currently uses deterministic lexical overlap only.

## Local development

Requirements: Node.js, pnpm 11, Python 3.12, and optionally Docker Compose.

```bash
pnpm install
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
```

Run the API and frontend in separate terminals from the project root:

```bash
# Terminal 1
. .venv/bin/activate
pnpm dev:api

# Terminal 2
pnpm dev
```

Vite serves port 3000 and proxies `/api` requests to FastAPI on port 8000. With no `DATABASE_URL`, the API creates a local SQLite database at `backend/data/contractguard.db`. The hosted Preview for this project deliberately uses a separate local SQLite database and hosted OAuth; demo loading there cannot write synthetic rows to the shared managed MySQL database. Original uploads in local mode are stored under `backend/data/uploads/` and served only through organization-authorized API routes. Local disk storage is not an appropriate durable store for confidential production documents.

## Docker Compose

```bash
docker compose up --build
```

The SPA and FastAPI share port 3000; PostgreSQL is on port 5432. Replace the example database password outside local demonstrations. The app container persists its local DB and upload directory through volumes. The supplied storage is filesystem-based, not object storage. Before using confidential contracts in a public deployment, configure durable private storage, access controls, backups, TLS, retention, and operational alerts. The hosted container may also use an injected managed MySQL-compatible DSN.

## First-run synthetic demo

The database starts empty. From Overview, select **Load synthetic demo data**. The seed creates six clearly labeled sample sources (two vendor agreements, information-security and procurement policy examples, an incident-response procedure, and a data-retention/privacy policy), ten synthetic obligations, policy mappings, seven review findings, deadlines, tasks, and audit entries. These are synthetic examples, not actual organizational findings. Sample text carries section labels but no page numbers; unavailable citations stay unavailable. Try the evidence path from contract obligation to policy comparison, finding, assigned action, and audit history.

Uploaded formats are PDF, DOCX, and TXT, up to 20 MB. PyMuPDF and python-docx extract available text. Scanned PDFs with no text are flagged `needs_ocr`; OCR is not bundled. Extraction and analysis use conservative deterministic rules. Unknown actors, triggers, dates, and other unsupported facts are not invented; uncertain obligations remain flagged for review. Calendar due-date calculation supports days, weeks, months, years, and weekday-only business days; unsupported hour-based date calculations are rejected rather than guessed. Re-running analysis after uploading a policy revisits existing obligations and adds or updates policy mappings without duplicating obligations or findings.

## Authentication and data handling

Hosted sessions are organization-scoped and validate the `webdev_app_session` JWT against `MANUS_JWT_SECRET` and `MANUS_PROJECT_ID`. OAuth state is signed, nonce-bound, and constrained to an exact allowed-origin list. The default list permits the initialized Preview origin and localhost; set `CONTRACTGUARD_ALLOWED_ORIGINS` to comma-separated exact HTTPS origins for any published domain. Reviewer memberships may analyze documents, manage tasks, and review findings; only owners/admins may delete documents or override severity. The Preview cookie uses `SameSite=None; Secure` for the embedded HTTPS workspace. Hosted mode presents the platform sign-in flow and does not invent a user identity. Without platform OAuth configuration, local demo mode is clearly labeled and uses synthetic records. Uploaded text is treated as untrusted and is not sent to any language model. The evidence assistant uses stored citations and deterministic response templates; generative LLM integration is not active in this build.

Soft deletion hides a document record but does not claim to erase stored file bytes. The project database is shared by development and publication; schema/data writes in that database affect the same service. The delivered Preview is isolated on SQLite. Review/backup a live database before applying changes to any existing installation.

## Database and migrations

`backend/app/models.py` defines organizations, users, memberships, documents/versions, clauses, obligations, deadlines, policy mappings, findings, evidence citations, tasks, notifications, human reviews, and audit events. The API creates missing tables at startup for first-run demonstrations. Alembic migrations are also provided:

```bash
alembic -c backend/alembic.ini upgrade head
```

## API documentation

With the API running, OpenAPI JSON is at `/openapi.json` and interactive Swagger UI is at `/docs` on the API origin (port 8000 in local development). Main routes include:

- Authentication and health: `GET /api/health`, `GET /api/auth/me`, `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/logout`
- Documents and processing: `GET/POST /api/documents`, `GET /api/documents/{id}`, `GET /api/documents/{id}/file`, `DELETE /api/documents/{id}`, `POST /api/analyze`
- Analysis: `GET /api/obligations`, `GET /api/findings`, `GET /api/findings/{id}`, `POST /api/findings/{id}/review`, `GET /api/graph`, `POST /api/copilot`
- Workflow: `GET /api/deadlines`, `POST /api/deadlines/{id}/trigger`, `GET/POST/PATCH /api/tasks`, `GET /api/audit`, `GET /api/bootstrap`, `POST /api/demo/load`

## Tests

```bash
pytest -q backend/tests
pnpm test
pnpm typecheck
pnpm build
```

The tests cover deterministic parsing, evidence-preserving citations, retrieval scoring, risk prioritization, and calendar-aware date arithmetic. One API workflow test uses a temporary SQLite database to verify contract-first/policy-later analysis, idempotency, reviewer permissions, cross-organization citation filtering, graph endpoint integrity, OAuth origin allowlisting, and tampered-state rejection. It does not perform a live exchange with the platform OAuth service. No manually labeled evaluation dataset or measured precision/recall/F1, retrieval precision@k, citation accuracy, or deadline accuracy is claimed.

## Architecture

`src/` contains the routes, shell, feature screens, shared components, typed records, and API client. `backend/app/` contains FastAPI routes, schemas, database selection, extraction, lexical retrieval, evidence-aware comparison, scoring, authentication, and private local storage. `backend/demo/` holds synthetic source texts, `backend/alembic/` contains migrations, and `backend/tests/` contains focused unit and API workflow tests. Vite proxies to FastAPI in development; the root Dockerfile builds the SPA and serves it through FastAPI at the single `PORT` listener.
