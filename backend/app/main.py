from __future__ import annotations
import base64
import json
import os
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit
import httpx
import jwt
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import DATA_DIR, engine, get_db, init_db
from .models import (ActionTask, AuditLog, Clause, Deadline, Document, DocumentVersion, EvidenceCitation, Finding,
                     HumanReview, Membership, Notification, Obligation, Organization, PolicyMapping, User, now_utc, uid)
from .schemas import CopilotQuestion, FindingReview, LoginPayload, TaskCreate, TaskUpdate, TriggerDate
from .services.extraction import extract_obligations, extract_text, split_clauses
from .services.retrieval import compare_obligation_to_policy, prioritize, relevance
from .services.deadlines import calculate_due_date
from .services.storage import read_original, save_original

app = FastAPI(title="ContractGuard AI API", version="0.1.0", description="Evidence-first contract and compliance intelligence API. Analysis results are assistive, not legal conclusions.")
app.add_middleware(CORSMiddleware, allow_origins=[], allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])

SEVERITIES = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
TASK_STATUSES = {"Open", "In Progress", "Awaiting Review", "Resolved"}
DOCUMENT_TYPES = {"Vendor Contract", "Service-Level Agreement", "NDA", "Data Processing Agreement", "Internal Security Policy", "Privacy Policy", "Procurement Policy", "Other"}
ORG_NAME = "ContractGuard Demo Workspace"
DEFAULT_PREVIEW_ORIGIN = "https://8328-isbhdwdxvyllfyipb2bz3-5c3ebd12.sg2.manus.computer"


def _allowed_app_origins() -> set[str]:
    configured = os.getenv("CONTRACTGUARD_ALLOWED_ORIGINS", "").split(",")
    values = {value.strip().rstrip("/").lower() for value in configured if value.strip()}
    return values or {DEFAULT_PREVIEW_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"}


def _validated_app_origin(origin: str):
    parsed = urlsplit(origin)
    normalized = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}".rstrip("/")
    if (parsed.scheme not in {"https", "http"} or not parsed.netloc or parsed.username or parsed.password
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment or normalized not in _allowed_app_origins()
            or (parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1"})):
        raise HTTPException(status_code=403, detail="The application origin is not allowlisted for sign-in.")
    return parsed


SESSION_SECRET = os.getenv("MANUS_JWT_SECRET") or "contractguard-secure-dev-session-2026"
SESSION_APP_ID = os.getenv("MANUS_PROJECT_ID") or "contractguard-local"


def _demo_auth() -> bool:
    return os.getenv("AUTH_MODE", "demo").lower() == "demo" and not (os.getenv("MANUS_PROJECT_ID") and os.getenv("MANUS_JWT_SECRET"))


def _decode_session(request: Request) -> dict[str, Any] | None:
    token = request.cookies.get("webdev_app_session")
    if not token:
        return None
    try:
        claims = jwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
        if claims.get("openId"):
            return claims
    except jwt.PyJWTError:
        pass

    manus_secret = os.getenv("MANUS_JWT_SECRET")
    if manus_secret and manus_secret != SESSION_SECRET:
        try:
            claims = jwt.decode(token, manus_secret, algorithms=["HS256"])
            if claims.get("openId"):
                return claims
        except jwt.PyJWTError:
            pass
    return None


def actor_for(request: Request) -> dict[str, Any]:
    claims = _decode_session(request)
    if claims:
        return {"open_id": claims["openId"], "name": claims.get("name", "Reviewer"), "email": claims.get("email"), "role": claims.get("role", "reviewer"), "demo": claims.get("demo", True)}
    raise HTTPException(status_code=401, detail={"message": "Sign in with your organization account to continue.", "login_required": True})


def get_or_create_context(db: Session, actor: dict[str, Any]) -> tuple[Organization, User, str]:
    user = db.scalar(select(User).where(User.open_id == actor["open_id"]))
    if not user:
        user = User(open_id=actor["open_id"], display_name=actor.get("name") or "Reviewer", email=actor.get("email"), role=actor.get("role") or "reviewer")
        db.add(user)
        db.flush()
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if membership:
        org = db.scalar(select(Organization).where(Organization.id == membership.org_id))
        if not org:
            raise HTTPException(status_code=403, detail="The organization membership is no longer valid.")
        if actor.get("demo") and membership.role != "admin":
            membership.role = "admin"
            user.role = "admin"
    else:
        org = db.scalar(select(Organization).where(Organization.name == ORG_NAME)) if actor.get("demo") else None
        if not org:
            org = Organization(name=ORG_NAME if actor.get("demo") else f"{user.display_name}'s organization")
            db.add(org)
            db.flush()
            role = "admin" if actor.get("demo") else "owner"
        else:
            role = "admin" if actor.get("demo") else "reviewer"
        membership = Membership(org_id=org.id, user_id=user.id, role=role)
        db.add(membership)
        user.role = role
        db.flush()
    db.commit()
    return org, user, membership.role


@dataclass
class Context:
    actor: dict[str, Any]
    org: Organization
    user: User
    role: str


def get_context(request: Request, db: Session = Depends(get_db)) -> Context:
    actor = actor_for(request)
    org, user, role = get_or_create_context(db, actor)
    return Context(actor=actor, org=org, user=user, role=role)


def require_role(ctx: Context, *allowed: str) -> None:
    if ctx.role not in allowed:
        raise HTTPException(status_code=403, detail="Your organization role cannot perform this action.")


def is_contract_document_type(document_type: str) -> bool:
    normalized = (document_type or "").lower()
    return not any(term in normalized for term in ("policy", "procedure"))


def audit(db: Session, org_id: str, actor_id: str, event: str, entity: str, entity_id: str | None = None, metadata: dict | None = None) -> None:
    db.add(AuditLog(org_id=org_id, actor_id=actor_id, event_type=event, entity_type=entity, entity_id=entity_id, metadata_json=metadata or {}))


def visible(db: Session, model, org_id: str, entity_id: str):
    item = db.scalar(select(model).where(model.id == entity_id, model.org_id == org_id))
    if not item:
        raise HTTPException(status_code=404, detail="Record not found in this organization.")
    return item


def serialize_document(doc: Document) -> dict[str, Any]:
    return {"id": doc.id, "file_name": doc.file_name, "document_type": doc.document_type, "mime_type": doc.mime_type,
            "upload_date": doc.upload_date.isoformat(), "processing_status": doc.processing_status,
            "extraction_status": doc.extraction_status, "page_count": doc.page_count, "version": doc.version,
            "organization_id": doc.org_id, "is_demo": doc.is_demo, "text_length": len(doc.extracted_text or "")}


def serialize_obligation(row: Obligation, document: Document | None = None) -> dict[str, Any]:
    return {"id": row.id, "description": row.description, "responsible_party": row.responsible_party,
            "required_action": row.required_action, "action_object": row.action_object, "trigger_event": row.trigger_event,
            "deadline_duration": row.deadline_duration, "deadline_unit": row.deadline_unit,
            "absolute_deadline": row.absolute_deadline.isoformat() if row.absolute_deadline else None,
            "category": row.category, "consequence": row.consequence, "document_id": row.document_id,
            "document_name": document.file_name if document else "Source document", "source_page": row.source_page,
            "source_section": row.source_section, "exact_quote": row.exact_quote, "confidence": row.confidence,
            "review_status": row.review_status, "is_demo": row.is_demo}


def serialize_finding(row: Finding, db: Session) -> dict[str, Any]:
    obligation = db.scalar(select(Obligation).where(Obligation.id == row.obligation_id, Obligation.org_id == row.org_id)) if row.obligation_id else None
    doc = db.scalar(select(Document).where(Document.id == obligation.document_id, Document.org_id == row.org_id)) if obligation else None
    citations = db.execute(select(EvidenceCitation, Document).join(Document, Document.id == EvidenceCitation.document_id).where(
        EvidenceCitation.finding_id == row.id, Document.org_id == row.org_id)).all()
    return {"id": row.id, "category": row.category, "title": row.title, "explanation": row.explanation,
            "severity": row.severity, "score": row.score, "confidence": row.confidence, "status": row.status,
            "suggested_action": row.suggested_action, "assigned_owner": row.assigned_owner,
            "created_at": row.created_at.isoformat(), "is_demo": row.is_demo,
            "obligation": serialize_obligation(obligation, doc) if obligation else None,
            "citations": [{"id": c.id, "document_id": c.document_id, "document_name": source.file_name,
                           "role": c.evidence_role, "quote": c.quote, "page_number": c.page_number, "section": c.section,
                           "explanation": c.explanation} for c, source in citations]}


def ensure_finding_citation(db: Session, finding: Finding, document: Document, clause_id: str | None, role: str,
                            quote: str, page_number: int | None, section: str | None, explanation: str) -> None:
    existing = db.scalar(select(EvidenceCitation.id).where(
        EvidenceCitation.finding_id == finding.id, EvidenceCitation.document_id == document.id,
        EvidenceCitation.evidence_role == role, EvidenceCitation.quote == quote))
    if not existing:
        db.add(EvidenceCitation(finding_id=finding.id, document_id=document.id, clause_id=clause_id,
                                evidence_role=role, quote=quote, page_number=page_number,
                                section=section, explanation=explanation))


def serialize_task(task: ActionTask) -> dict[str, Any]:
    return {"id": task.id, "finding_id": task.finding_id, "title": task.title, "description": task.description,
            "owner": task.owner, "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority, "status": task.status, "comments": task.comments or [],
            "resolution_notes": task.resolution_notes, "created_at": task.created_at.isoformat()}


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "database": engine.dialect.name, "semantic_search": "lexical-review-mode", "auth_mode": "demo" if _demo_auth() else "manus-oauth"}


@app.get("/api/auth/me")
def auth_me(request: Request) -> dict[str, Any]:
    claims = _decode_session(request)
    if claims:
        return {"authenticated": True, "user": {"open_id": claims["openId"], "name": claims.get("name", "Reviewer"), "email": claims.get("email"), "role": claims.get("role", "reviewer"), "demo": claims.get("demo", True)}}
    return {"authenticated": False, "login_required": True, "demo_mode": _demo_auth()}


@app.post("/api/auth/login")
def auth_local_login(payload: LoginPayload):
    email = (payload.email or "").strip()
    name = (payload.name or "").strip()
    role = (payload.role or "reviewer").strip().lower()
    if role not in {"admin", "reviewer", "owner"}:
        role = "reviewer"

    if not name:
        if email and "@" in email:
            name = email.split("@")[0].replace(".", " ").title()
        else:
            name = "Workspace Admin" if role in {"admin", "owner"} else "Demo Reviewer"

    open_id = f"user-{email.lower().replace('@', '-at-').replace('.', '-')}" if email else f"demo-{role}"

    claims = {
        "openId": open_id,
        "appId": SESSION_APP_ID,
        "name": name,
        "email": email or f"{role}@contractguard.local",
        "role": role,
        "demo": True,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    session_token = jwt.encode(claims, SESSION_SECRET, algorithm="HS256")
    response = JSONResponse({
        "ok": True,
        "user": {
            "open_id": open_id,
            "name": name,
            "email": claims["email"],
            "role": role,
            "demo": True,
        }
    })
    response.set_cookie(
        "webdev_app_session",
        session_token,
        httponly=True,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    return response


@app.get("/api/auth/login")
def auth_login(origin: str = Query(..., min_length=8)):
    portal, api, app_id = os.getenv("MANUS_OAUTH_PORTAL_URL"), os.getenv("MANUS_OAUTH_API_URL"), os.getenv("MANUS_PROJECT_ID")
    if not (portal and api and app_id and os.getenv("MANUS_JWT_SECRET")):
        raise HTTPException(status_code=503, detail="Manus OAuth is unavailable in this runtime. Configure the platform OAuth environment before enabling sign-in.")
    parsed = _validated_app_origin(origin)
    redirect_uri = f"{parsed.scheme}://{parsed.netloc}/api/auth/callback"
    nonce = secrets.token_urlsafe(28)
    state = jwt.encode({"nonce": nonce, "redirectUri": redirect_uri, "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}, os.environ["MANUS_JWT_SECRET"], algorithm="HS256")
    query = urlencode({"appId": app_id, "redirectUri": redirect_uri, "state": state, "responseType": "code"})
    response = RedirectResponse(f"{portal.rstrip('/')}/app-auth?{query}", status_code=302)
    response.set_cookie("cg_oauth_nonce", nonce, httponly=True, secure=parsed.scheme == "https", samesite="lax", max_age=600, path="/api/auth")
    return response


@app.get("/api/auth/callback")
async def auth_callback(request: Request, code: str = Query(...), state: str = Query(...), db: Session = Depends(get_db)):
    try:
        state_data = jwt.decode(state, os.environ["MANUS_JWT_SECRET"], algorithms=["HS256"], options={"require": ["exp", "nonce", "redirectUri"]})
    except (jwt.PyJWTError, KeyError) as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired sign-in state.") from exc
    nonce = request.cookies.get("cg_oauth_nonce")
    redirect_uri = state_data.get("redirectUri", "")
    parsed = urlsplit(redirect_uri)
    callback_origin = f"{parsed.scheme}://{parsed.netloc}"
    try:
        _validated_app_origin(callback_origin)
    except HTTPException as exc:
        raise HTTPException(status_code=400, detail="Sign-in state contains an unapproved redirect origin.") from exc
    if (not nonce or not secrets.compare_digest(nonce, state_data.get("nonce", ""))
            or parsed.path != "/api/auth/callback" or parsed.query or parsed.fragment or parsed.username or parsed.password):
        raise HTTPException(status_code=400, detail="Sign-in state could not be verified.")
    api_url = os.environ["MANUS_OAUTH_API_URL"].rstrip("/")
    payload = {"clientId": os.environ["MANUS_PROJECT_ID"], "grantType": "authorization_code", "code": code, "redirectUri": redirect_uri}
    async with httpx.AsyncClient(timeout=20) as client:
        exchange = await client.post(f"{api_url}/webdev.v1.WebDevAuthPublicService/ExchangeToken", json=payload)
        if exchange.is_error:
            raise HTTPException(status_code=401, detail="Sign-in code exchange failed.")
        token_data = exchange.json()
        access_token = token_data.get("accessToken")
        if not access_token:
            raise HTTPException(status_code=401, detail="Identity provider returned no access token.")
        info = await client.post(f"{api_url}/webdev.v1.WebDevAuthPublicService/GetUserInfo", json={"accessToken": access_token})
        if info.is_error:
            raise HTTPException(status_code=401, detail="Could not verify the signed-in account.")
        identity = info.json()
    open_id = identity.get("openId")
    if not open_id:
        raise HTTPException(status_code=401, detail="Identity response did not include an account ID.")
    claims = {"openId": open_id, "appId": os.environ["MANUS_PROJECT_ID"], "name": identity.get("name", "Reviewer"), "email": identity.get("email"), "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    session_token = jwt.encode(claims, os.environ["MANUS_JWT_SECRET"], algorithm="HS256")
    response = RedirectResponse(f"{parsed.scheme}://{parsed.netloc}/", status_code=302)
    response.set_cookie("webdev_app_session", session_token, httponly=True, secure=parsed.scheme == "https", samesite="none" if parsed.scheme == "https" else "lax", max_age=43200, path="/")
    response.delete_cookie("cg_oauth_nonce", path="/api/auth")
    return response


@app.post("/api/auth/logout")
def auth_logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie("webdev_app_session", path="/")
    return response


@app.get("/api/bootstrap")
def bootstrap(ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    org_id = ctx.org.id
    docs = db.scalars(select(Document).where(Document.org_id == org_id, Document.deleted_at.is_(None)).order_by(Document.upload_date.desc())).all()
    obligations = db.scalars(select(Obligation).where(Obligation.org_id == org_id)).all()
    findings = db.scalars(select(Finding).where(Finding.org_id == org_id).order_by(Finding.created_at.desc())).all()
    tasks = db.scalars(select(ActionTask).where(ActionTask.org_id == org_id).order_by(ActionTask.created_at.desc())).all()
    deadlines = db.scalars(select(Deadline).where(Deadline.org_id == org_id).order_by(Deadline.due_date.asc())).all()
    notifications = db.scalars(select(Notification).where(Notification.org_id == org_id, Notification.read.is_(False)).order_by(Notification.created_at.desc())).all()
    today = date.today()
    upcoming = [d for d in deadlines if d.due_date and 0 <= (d.due_date - today).days <= 30]
    open_findings = [f for f in findings if f.status not in {"Resolved", "Closed"}]
    categories: dict[str, int] = {}
    for item in obligations:
        categories[item.category] = categories.get(item.category, 0) + 1
    return {"organization": {"id": ctx.org.id, "name": ctx.org.name}, "user": {**ctx.actor, "role": ctx.role},
            "summary": {"contracts_analyzed": sum(1 for d in docs if is_contract_document_type(d.document_type) and d.processing_status == "analyzed"),
                        "obligations": len(obligations), "open_findings": len(open_findings),
                        "high_risks": sum(1 for f in open_findings if f.severity in {"Critical", "High"}),
                        "upcoming_deadlines": len(upcoming), "awaiting_review": sum(1 for f in open_findings if f.status == "Awaiting Review")},
            "risk_distribution": [{"name": level, "value": sum(1 for f in open_findings if f.severity == level)} for level in ["Critical", "High", "Medium", "Low"]],
            "obligations_by_category": [{"name": key, "value": value} for key, value in categories.items()],
            "deadlines": [serialize_deadline(d, db) for d in deadlines[:8]],
            "recent_findings": [serialize_finding(f, db) for f in findings[:5]],
            "recent_documents": [serialize_document(d) for d in docs[:5]],
            "recent_activity": [serialize_audit(a) for a in db.scalars(select(AuditLog).where(AuditLog.org_id == org_id).order_by(AuditLog.created_at.desc()).limit(6)).all()],
            "notifications": [{"id": n.id, "title": n.title, "message": n.message, "created_at": n.created_at.isoformat()} for n in notifications],
            "demo_mode": ctx.actor.get("demo", False), "has_data": bool(docs or obligations or findings)}


def serialize_deadline(row: Deadline, db: Session) -> dict[str, Any]:
    obligation = db.scalar(select(Obligation).where(Obligation.id == row.obligation_id, Obligation.org_id == row.org_id))
    document = db.scalar(select(Document).where(Document.id == obligation.document_id, Document.org_id == row.org_id)) if obligation else None
    return {"id": row.id, "title": row.title, "obligation_id": row.obligation_id, "due_date": row.due_date.isoformat() if row.due_date else None,
            "trigger_date": row.trigger_date.isoformat() if row.trigger_date else None, "reminder_days": row.reminder_days,
            "owner": row.owner, "status": row.status, "document_name": document.file_name if document else "Unknown source",
            "quote": obligation.exact_quote if obligation else "", "source_section": obligation.source_section if obligation else None,
            "is_demo": obligation.is_demo if obligation else False}


def serialize_audit(row: AuditLog) -> dict[str, Any]:
    return {"id": row.id, "actor_id": row.actor_id, "event_type": row.event_type, "entity_type": row.entity_type,
            "entity_id": row.entity_id, "metadata": row.metadata_json or {}, "created_at": row.created_at.isoformat()}


@app.get("/api/documents")
def list_documents(q: str = "", document_type: str = "", ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    query = select(Document).where(Document.org_id == ctx.org.id, Document.deleted_at.is_(None))
    if q:
        query = query.where(Document.file_name.ilike(f"%{q[:100]}%"))
    if document_type:
        query = query.where(Document.document_type == document_type)
    return [serialize_document(d) for d in db.scalars(query.order_by(Document.upload_date.desc())).all()]


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...), document_type: str = Query("Other"), ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin", "reviewer")
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported document type.")
    content = await file.read(20 * 1024 * 1024 + 1)
    try:
        text, pages, extraction_status = extract_text(file.filename or "document.txt", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    storage_path = save_original(file.filename or "document", content)
    is_policy = any(term in document_type.lower() for term in ["policy", "procedure"])
    doc = Document(org_id=ctx.org.id, file_name=Path(file.filename or "document").name[:255], document_type=document_type,
                   mime_type=file.content_type or "application/octet-stream", processing_status="processed", extraction_status=extraction_status,
                   page_count=pages, version=1, extracted_text=text, storage_path=storage_path, is_demo=False)
    db.add(doc)
    db.flush()
    db.add(DocumentVersion(document_id=doc.id, version=1, file_name=doc.file_name, storage_path=storage_path))
    for clause in split_clauses(text):
        db.add(Clause(org_id=ctx.org.id, document_id=doc.id, text=clause["text"], page_number=clause["page_number"], section=clause["section"], category="Policy" if is_policy else "Contract", is_policy=is_policy))
    audit(db, ctx.org.id, ctx.actor["open_id"], "document.uploaded", "document", doc.id, {"file_name": doc.file_name, "document_type": document_type})
    db.commit()
    return serialize_document(doc)


@app.get("/api/documents/{document_id}")
def get_document(document_id: str, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    doc = visible(db, Document, ctx.org.id, document_id)
    clauses = db.scalars(select(Clause).where(Clause.document_id == doc.id, Clause.org_id == ctx.org.id)).all()
    obligations = db.scalars(select(Obligation).where(Obligation.document_id == doc.id, Obligation.org_id == ctx.org.id)).all()
    return {**serialize_document(doc), "extracted_text": doc.extracted_text, "clauses": [{"id": c.id, "text": c.text, "page_number": c.page_number, "section": c.section, "is_policy": c.is_policy} for c in clauses],
            "obligations": [serialize_obligation(o, doc) for o in obligations]}


@app.get("/api/documents/{document_id}/file")
def get_document_file(document_id: str, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    doc = visible(db, Document, ctx.org.id, document_id)
    data = read_original(doc.storage_path or "")
    if data is None:
        raise HTTPException(status_code=404, detail="Original file is unavailable in this storage environment.")
    path = DATA_DIR / doc.storage_path
    return FileResponse(path, media_type=doc.mime_type, filename=doc.file_name, content_disposition_type="inline")


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin")
    doc = visible(db, Document, ctx.org.id, document_id)
    doc.deleted_at = now_utc()
    audit(db, ctx.org.id, ctx.actor["open_id"], "document.soft_deleted", "document", doc.id, {"file_name": doc.file_name})
    db.commit()
    return {"ok": True, "message": "Document hidden from the workspace. Stored bytes are retained; this runtime cannot promise physical object deletion."}


@app.get("/api/obligations")
def list_obligations(q: str = "", ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    rows = db.scalars(select(Obligation).where(Obligation.org_id == ctx.org.id).order_by(Obligation.created_at.desc())).all()
    if q:
        rows = [o for o in rows if q.lower() in (o.description + o.category + o.responsible_party).lower()]
    return [serialize_obligation(o, db.scalar(select(Document).where(Document.id == o.document_id, Document.org_id == ctx.org.id))) for o in rows]


@app.get("/api/findings")
def list_findings(status: str = "", ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    rows = db.scalars(select(Finding).where(Finding.org_id == ctx.org.id).order_by(Finding.created_at.desc())).all()
    if status:
        rows = [f for f in rows if f.status == status]
    return [serialize_finding(f, db) for f in rows]


@app.get("/api/findings/{finding_id}")
def get_finding(finding_id: str, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    return serialize_finding(visible(db, Finding, ctx.org.id, finding_id), db)


@app.post("/api/analyze")
def analyze(ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin", "reviewer")
    org_id = ctx.org.id
    docs = db.scalars(select(Document).where(Document.org_id == org_id, Document.deleted_at.is_(None))).all()
    contracts = [d for d in docs if is_contract_document_type(d.document_type)]
    require_role(ctx, "owner", "admin", "reviewer")
    policies = db.scalars(select(Clause).join(Document, Document.id == Clause.document_id).where(
        Clause.org_id == org_id, Clause.is_policy.is_(True), Document.org_id == org_id, Document.deleted_at.is_(None))).all()
    new_obligations = 0
    new_findings = 0
    for doc in contracts:
        clauses = db.scalars(select(Clause).where(Clause.org_id == org_id, Clause.document_id == doc.id)).all()
        parsed = extract_obligations([{"text": c.text, "page_number": c.page_number, "section": c.section} for c in clauses])
        existing_rows = db.scalars(select(Obligation).where(Obligation.org_id == org_id, Obligation.document_id == doc.id)).all()
        obligations_by_quote = {row.exact_quote: row for row in existing_rows}
        for item in parsed:
            quote = item["exact_quote"]
            source_clause = next((c for c in clauses if quote in c.text), None)
            obligation = obligations_by_quote.get(quote)
            if obligation is None:
                obligation = Obligation(org_id=org_id, document_id=doc.id, clause_id=source_clause.id if source_clause else None, is_demo=doc.is_demo, **item)
                db.add(obligation)
                db.flush()
                obligations_by_quote[quote] = obligation
                new_obligations += 1

            prior_gap = db.scalar(select(Finding).where(
                Finding.org_id == org_id, Finding.obligation_id == obligation.id,
                Finding.category == "Missing policy coverage", Finding.mapping_id.is_(None)).order_by(Finding.created_at.desc()))
            if not policies:
                if prior_gap is None:
                    explanation = "No policy clause was available for comparison; no compliance conclusion is supported."
                    action = "Add or identify the applicable policy and review this obligation."
                    prior_gap = Finding(org_id=org_id, obligation_id=obligation.id, category="Missing policy coverage",
                                        title="No policy evidence found for this obligation", explanation=explanation,
                                        severity="Medium", score=51.5, confidence=0.35, status="Awaiting Review",
                                        suggested_action=action, is_demo=doc.is_demo)
                    db.add(prior_gap)
                    db.flush()
                    new_findings += 1
                ensure_finding_citation(db, prior_gap, doc, source_clause.id if source_clause else None, "contract",
                                        quote, item["source_page"], item["source_section"],
                                        "Exact contract wording; source location is shown only where available.")
                continue

            best_score, policy = sorted(((relevance(quote, clause.text), clause) for clause in policies), key=lambda pair: pair[0], reverse=True)[0]
            relationship, explanation, action = compare_obligation_to_policy(item, policy.text, best_score)
            mapping = db.scalar(select(PolicyMapping).where(
                PolicyMapping.org_id == org_id, PolicyMapping.obligation_id == obligation.id,
                PolicyMapping.policy_clause_id == policy.id))
            if mapping is None:
                mapping = PolicyMapping(org_id=org_id, obligation_id=obligation.id, policy_clause_id=policy.id,
                                        relevance_score=best_score, relationship_type=relationship,
                                        supporting_evidence=policy.text, explanation=explanation, review_status="needs_review")
                db.add(mapping)
                db.flush()
            else:
                mapping.relevance_score = best_score
                mapping.relationship_type = relationship
                mapping.supporting_evidence = policy.text
                mapping.explanation = explanation

            if prior_gap is not None:
                prior_gap.mapping_id = mapping.id
                prior_gap.category = "Insufficient supporting evidence"
                prior_gap.title = "Policy evidence added — prior gap alert needs review"
                prior_gap.explanation = "This alert was created when no policy clause was available. A policy clause has since been matched; review the linked contract and policy evidence before closing the earlier alert."
                prior_gap.suggested_action = "Review the updated policy comparison and disposition the earlier gap alert."
                if prior_gap.status not in {"Resolved", "Closed"}:
                    prior_gap.status = "Awaiting Review"
                ensure_finding_citation(db, prior_gap, doc, source_clause.id if source_clause else None, "contract",
                                        quote, item["source_page"], item["source_section"], "Exact contract wording from the source document.")
                ensure_finding_citation(db, prior_gap, db.scalar(select(Document).where(Document.id == policy.document_id, Document.org_id == org_id)),
                                        policy.id, "policy", policy.text, policy.page_number, policy.section, explanation)

            if relationship in {"Potentially conflicts with", "Requires human review", "Insufficient evidence"}:
                risk_category = "Potential deadline conflict" if "deadline" in explanation.lower() or "time windows" in explanation.lower() else "Insufficient supporting evidence"
                title = "Potential operational gap — review required" if "internal" in policy.text.lower() and "client" in quote.lower() else f"Review policy coverage for {item['category'].lower()}"
                finding = prior_gap or db.scalar(select(Finding).where(
                    Finding.org_id == org_id, Finding.obligation_id == obligation.id, Finding.mapping_id == mapping.id).order_by(Finding.created_at.desc()))
                if finding is None:
                    transparent = prioritize(impact=0.7, urgency=0.7 if item.get("deadline_duration") else 0.35,
                                             likelihood=0.55, coverage=0.35, confidence=min(item["confidence"], best_score + 0.5))
                    finding = Finding(org_id=org_id, obligation_id=obligation.id, mapping_id=mapping.id,
                                      category=risk_category, title=title, explanation=explanation,
                                      severity=transparent["severity"], score=transparent["score"],
                                      confidence=min(item["confidence"], best_score), status="Awaiting Review",
                                      suggested_action=action, is_demo=doc.is_demo)
                    db.add(finding)
                    db.flush()
                    new_findings += 1
                else:
                    finding.mapping_id = mapping.id
                    if not db.scalar(select(HumanReview.id).where(HumanReview.finding_id == finding.id)):
                        finding.category = risk_category
                        finding.title = title
                        finding.explanation = explanation
                        finding.suggested_action = action
                ensure_finding_citation(db, finding, doc, source_clause.id if source_clause else None, "contract",
                                        quote, item["source_page"], item["source_section"], "Exact contract wording; source location is shown only where available.")
                policy_doc = db.scalar(select(Document).where(Document.id == policy.document_id, Document.org_id == org_id))
                if policy_doc:
                    ensure_finding_citation(db, finding, policy_doc, policy.id, "policy", policy.text,
                                            policy.page_number, policy.section, explanation)
    for doc in contracts:
        doc.processing_status = "analyzed"
    audit(db, ctx.org.id, ctx.actor["open_id"], "analysis.completed", "organization", ctx.org.id, {"contracts": len(contracts), "new_obligations": new_obligations, "new_findings": new_findings, "analysis_mode": "deterministic; external AI disabled by default"})
    db.commit()
    return {"ok": True, "contracts": len(contracts), "new_obligations": new_obligations, "new_findings": new_findings, "message": "Analysis complete. Retrieved policy matches are review signals, not proof of compliance."}


@app.post("/api/tasks")
def create_task(payload: TaskCreate, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin", "reviewer")
    if payload.finding_id:
        visible(db, Finding, ctx.org.id, payload.finding_id)
    task = ActionTask(org_id=ctx.org.id, finding_id=payload.finding_id, title=payload.title, description=payload.description, owner=payload.owner, due_date=payload.due_date, priority=payload.priority, status="Open")
    db.add(task); db.flush()
    audit(db, ctx.org.id, ctx.actor["open_id"], "task.created", "action_task", task.id, {"finding_id": task.finding_id, "owner": task.owner, "priority": task.priority})
    db.commit()
    return serialize_task(task)


@app.get("/api/tasks")
def list_tasks(ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    rows = db.scalars(select(ActionTask).where(ActionTask.org_id == ctx.org.id).order_by(ActionTask.created_at.desc())).all()
    return [serialize_task(task) for task in rows]


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin", "reviewer")
    task = visible(db, ActionTask, ctx.org.id, task_id)
    if payload.status and payload.status not in TASK_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid task status.")
    changes = payload.model_dump(exclude_none=True)
    comment = changes.pop("comment", None)
    before = {"status": task.status, "owner": task.owner, "priority": task.priority}
    for key, value in changes.items():
        setattr(task, key, value)
    if comment:
        task.comments = [*(task.comments or []), {"author": ctx.actor["name"], "text": comment[:2000], "at": now_utc().isoformat()}]
    audit(db, ctx.org.id, ctx.actor["open_id"], "task.updated", "action_task", task.id, {"before": before, "after": {"status": task.status, "owner": task.owner, "priority": task.priority}})
    db.commit()
    return serialize_task(task)


@app.post("/api/findings/{finding_id}/review")
def review_finding(finding_id: str, payload: FindingReview, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin", "reviewer")
    finding = visible(db, Finding, ctx.org.id, finding_id)
    old = finding.severity
    if payload.decision == "Severity override":
        require_role(ctx, "owner", "admin")
        if not payload.reason.strip() or not payload.severity:
            raise HTTPException(status_code=422, detail="A reviewer reason and replacement severity are required for overrides.")
        finding.severity = payload.severity
    elif payload.decision == "Resolved":
        finding.status = "Resolved"
    elif payload.decision == "Reopened":
        finding.status = "Open"
    else:
        finding.status = "Awaiting Review"
    db.add(HumanReview(finding_id=finding.id, reviewer=ctx.actor["open_id"], decision=payload.decision, reason=payload.reason, old_severity=old, new_severity=finding.severity))
    audit(db, ctx.org.id, ctx.actor["open_id"], "finding.reviewed", "finding", finding.id, {"decision": payload.decision, "reason": payload.reason, "old_severity": old, "new_severity": finding.severity})
    db.commit()
    return serialize_finding(finding, db)


@app.get("/api/deadlines")
def list_deadlines(ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    rows = db.scalars(select(Deadline).where(Deadline.org_id == ctx.org.id).order_by(Deadline.due_date.asc())).all()
    return [serialize_deadline(row, db) for row in rows]


@app.post("/api/deadlines/{deadline_id}/trigger")
def trigger_deadline(deadline_id: str, payload: TriggerDate, ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin", "reviewer")
    deadline = visible(db, Deadline, ctx.org.id, deadline_id)
    obligation = db.scalar(select(Obligation).where(Obligation.id == deadline.obligation_id, Obligation.org_id == ctx.org.id))
    if not obligation or not obligation.deadline_duration or not obligation.deadline_unit:
        raise HTTPException(status_code=422, detail="The source has no calculable relative duration. Do not estimate a date.")
    try:
        due = calculate_due_date(payload.trigger_date, obligation.deadline_duration, obligation.deadline_unit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    deadline.trigger_date, deadline.due_date = payload.trigger_date, due
    deadline.status = "Overdue" if due < date.today() else "Upcoming"
    audit(db, ctx.org.id, ctx.actor["open_id"], "deadline.trigger_recorded", "deadline", deadline.id, {"trigger_date": payload.trigger_date.isoformat(), "calculated_due_date": due.isoformat()})
    db.commit()
    return serialize_deadline(deadline, db)


@app.get("/api/audit")
def list_audit(limit: int = Query(100, ge=1, le=500), ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).where(AuditLog.org_id == ctx.org.id).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [serialize_audit(row) for row in rows]


@app.get("/api/graph")
def graph(ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    org_id = ctx.org.id
    nodes, edges = [], []
    docs = db.scalars(select(Document).where(Document.org_id == org_id, Document.deleted_at.is_(None))).all()
    for doc in docs:
        nodes.append({"id": f"doc:{doc.id}", "type": "document", "label": doc.file_name, "is_demo": doc.is_demo, "document_type": doc.document_type})
    for clause in db.scalars(select(Clause).join(Document, Document.id == Clause.document_id).where(
        Clause.org_id == org_id, Document.org_id == org_id, Document.deleted_at.is_(None))).all():
        nodes.append({"id": f"clause:{clause.id}", "type": "policy" if clause.is_policy else "clause", "label": (clause.section or "Clause") + ": " + clause.text[:62], "is_demo": clause.is_demo})
        edges.append({"id": f"contains:{clause.id}", "source": f"doc:{clause.document_id}", "target": f"clause:{clause.id}", "label": "CONTAINS"})
    for obligation in db.scalars(select(Obligation).join(Document, Document.id == Obligation.document_id).where(
        Obligation.org_id == org_id, Document.org_id == org_id, Document.deleted_at.is_(None))).all():
        nodes.append({"id": f"obligation:{obligation.id}", "type": "obligation", "label": obligation.category + " · " + obligation.description[:54], "is_demo": obligation.is_demo})
        if obligation.clause_id:
            edges.append({"id": f"creates:{obligation.id}", "source": f"clause:{obligation.clause_id}", "target": f"obligation:{obligation.id}", "label": "CREATES_OBLIGATION"})
    visible_nodes = {node["id"] for node in nodes}
    for mapping in db.scalars(select(PolicyMapping).where(PolicyMapping.org_id == org_id)).all():
        source, target = f"obligation:{mapping.obligation_id}", f"clause:{mapping.policy_clause_id}"
        if source in visible_nodes and target in visible_nodes:
            edges.append({"id": f"matches:{mapping.id}", "source": source, "target": target, "label": mapping.relationship_type.upper().replace(" ", "_"), "explanation": mapping.explanation})
    for finding in db.scalars(select(Finding).where(Finding.org_id == org_id)).all():
        nodes.append({"id": f"finding:{finding.id}", "type": "finding", "label": finding.title, "severity": finding.severity, "is_demo": finding.is_demo})
        source = f"obligation:{finding.obligation_id}" if finding.obligation_id else ""
        if source in visible_nodes:
            edges.append({"id": f"generates:{finding.id}", "source": source, "target": f"finding:{finding.id}", "label": "GENERATES_FINDING"})
    visible_nodes = {node["id"] for node in nodes}
    for task in db.scalars(select(ActionTask).where(ActionTask.org_id == org_id)).all():
        nodes.append({"id": f"task:{task.id}", "type": "action", "label": task.title, "is_demo": False})
        source = f"finding:{task.finding_id}" if task.finding_id else ""
        if source in visible_nodes:
            edges.append({"id": f"action:{task.id}", "source": source, "target": f"task:{task.id}", "label": "REQUIRES_ACTION"})
    return {"nodes": nodes, "edges": edges}


@app.post("/api/copilot")
def copilot(payload: CopilotQuestion, finding_id: str = Query(...), ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    finding = visible(db, Finding, ctx.org.id, finding_id)
    citations = db.execute(select(EvidenceCitation, Document).join(Document, Document.id == EvidenceCitation.document_id).where(
        EvidenceCitation.finding_id == finding.id, Document.org_id == ctx.org.id)).all()
    if not citations:
        return {"answer": "The stored record has no source citations. Additional document review is needed before I can support an answer.", "citations": [], "mode": "evidence-only demo assistant"}
    answer = f"This finding is marked {finding.severity} because the transparent scoring model assigned {finding.score:.1f}/100 using impact, urgency, likelihood, control gap, and evidence confidence. Severity is an operational review priority, not a legal conclusion."
    if any(word in payload.question.lower() for word in ["missing", "evidence", "support"]):
        answer += " The source set includes the quotations listed below. The citations do not prove that controls are effective; confirm roles, triggers, applicability, and process timing with the responsible team."
    else:
        answer += " Review the exact contract and policy quotations below together. Where the policy uses a different recipient or omits timing, the system marks a review question rather than assuming a direct contradiction."
    return {"answer": answer, "citations": [{"document_name": source.file_name, "quote": c.quote, "section": c.section, "page_number": c.page_number, "role": c.evidence_role} for c, source in citations], "mode": "evidence-only demo assistant"}


@app.post("/api/demo/load")
def load_demo(ctx: Context = Depends(get_context), db: Session = Depends(get_db)):
    require_role(ctx, "owner", "admin")
    existing = db.scalar(select(Document.id).where(Document.org_id == ctx.org.id, Document.is_demo.is_(True), Document.deleted_at.is_(None)))
    if existing:
        return {"ok": True, "already_loaded": True, "message": "Synthetic demo records are already loaded in this workspace."}
    demo_dir = Path(__file__).resolve().parents[1] / "demo"
    sources = [
        ("vendor_northstar.txt", "Vendor Contract", "Northstar Cloud Services Vendor Agreement"),
        ("vendor_meridian.txt", "Vendor Contract", "Meridian Analytics Service Agreement"),
        ("incident_response.txt", "Internal Security Policy", "Incident Response Procedure"),
        ("security_policy.txt", "Internal Security Policy", "Information Security Policy"),
        ("data_retention.txt", "Privacy Policy", "Data Retention and Disposal Policy"),
        ("procurement_policy.txt", "Procurement Policy", "Procurement and Third-Party Risk Policy"),
    ]
    created: dict[str, Document] = {}
    for fname, kind, display in sources:
        text = (demo_dir / fname).read_text(encoding="utf-8")
        path = save_original(display.replace(" ", "_") + ".txt", text.encode())
        doc = Document(org_id=ctx.org.id, file_name=display + ".txt", document_type=kind, mime_type="text/plain", processing_status="analyzed", extraction_status="complete", version=1, extracted_text=text, storage_path=path, is_demo=True)
        db.add(doc); db.flush()
        created[display] = doc
        is_policy = kind != "Vendor Contract"
        for item in split_clauses(text):
            db.add(Clause(org_id=ctx.org.id, document_id=doc.id, text=item["text"], page_number=None, section=item.get("section"), category="Policy" if is_policy else "Contract", is_policy=is_policy, is_demo=True))
        db.add(DocumentVersion(document_id=doc.id, version=1, file_name=doc.file_name, storage_path=path))
    db.flush()
    contracts = [created["Northstar Cloud Services Vendor Agreement"], created["Meridian Analytics Service Agreement"]]
    policy_clauses = db.scalars(select(Clause).where(Clause.org_id == ctx.org.id, Clause.is_policy.is_(True), Clause.is_demo.is_(True))).all()
    quote_to_section = {}
    for contract in contracts:
        clauses = db.scalars(select(Clause).where(Clause.document_id == contract.id)).all()
        for c in clauses:
            quote_to_section[c.text] = (contract, c)
    due_samples = [date.today() + timedelta(days=7), date.today() + timedelta(days=18), date.today() + timedelta(days=32)]
    seeds = [
        (contracts[0], "Section 4.2 Security Incident Notice", "The service provider shall notify the client of any security incident involving client data within 24 hours after discovery. The notice must describe the known impact and response measures.", "Service provider", "notify", "Client of any security incident involving client data", "security incident discovery", 24, "hour", "Security incident reporting"),
        (contracts[0], "Section 5.1 Security Assurance", "The service provider shall provide its current independent security audit report to the client annually upon written request.", "Service provider", "provide", "independent security audit report", "written request", None, None, "Assurance & reporting"),
        (contracts[0], "Section 7.3 Data Return", "Upon termination, the service provider must return or securely delete client data within 30 days, except where retention is required by law.", "Service provider", "return or delete", "client data", "contract termination", 30, "day", "Data handling"),
        (contracts[0], "Section 9.1 Subprocessors", "The service provider shall notify the client at least 30 days before adding a new subprocessor.", "Service provider", "notify", "client of new subprocessor", "before adding subprocessor", 30, "day", "Third-party risk"),
        (contracts[0], "Section 9.2 Subprocessor Register", "The service provider shall maintain an up-to-date list of subprocessors and provide it to the client upon request.", "Service provider", "maintain and provide", "subprocessor list", "client request", None, None, "Third-party risk"),
        (contracts[1], "Section 3.4 Incident Reporting", "The vendor shall notify the customer of a confirmed personal data breach within 48 hours after confirmation.", "Vendor", "notify", "customer of confirmed personal data breach", "breach confirmation", 48, "hour", "Security incident reporting"),
        (contracts[1], "Section 6.2 Renewal Notice", "Either party must provide written notice of non-renewal at least 60 days before the end of the then-current term.", "Contracting party", "provide written notice", "non-renewal", "end of current term", 60, "day", "Renewal & termination"),
        (contracts[1], "Section 8.1 Data Deletion", "The vendor shall delete customer personal data within 45 days after service termination.", "Vendor", "delete", "customer personal data", "service termination", 45, "day", "Data handling"),
        (contracts[1], "Section 10.3 Audit Cooperation", "The vendor shall provide reasonable cooperation for an annual security review upon the customer's written request.", "Vendor", "provide cooperation", "annual security review", "written request", None, None, "Assurance & reporting"),
        (contracts[1], "Section 11.1 Recovery Testing", "The vendor shall test its disaster recovery plan at least once each calendar year and provide a summary upon request.", "Vendor", "test and provide", "disaster recovery plan summary", "annual review and request", None, None, "Business continuity"),
    ]
    obligations = []
    for doc, section, quote, actor, action, obj, trigger, duration, unit, category in seeds:
        clause = next((c for d, c in quote_to_section.values() if d.id == doc.id and c.text == quote), None)
        # Demo source text remains the exact quotation; synthetic section labels are used only where the source states them.
        obligation = Obligation(org_id=ctx.org.id, document_id=doc.id, clause_id=clause.id if clause else None, description=quote, responsible_party=actor, required_action=action, action_object=obj, trigger_event=trigger, deadline_duration=duration, deadline_unit=unit, category=category, source_page=None, source_section=section, exact_quote=quote, confidence=0.96, review_status="extracted", is_demo=True)
        db.add(obligation); db.flush(); obligations.append(obligation)
        candidates = sorted(((relevance(quote, p.text), p) for p in policy_clauses), key=lambda x: x[0], reverse=True)
        if candidates and candidates[0][0] >= 0.12:
            score, policy = candidates[0]
            relationship, explanation, action_text = compare_obligation_to_policy({"exact_quote": quote, "responsible_party": actor, "deadline_duration": duration, "deadline_unit": unit}, policy.text, score)
            mapping = PolicyMapping(org_id=ctx.org.id, obligation_id=obligation.id, policy_clause_id=policy.id, relevance_score=score, relationship_type=relationship, supporting_evidence=policy.text, explanation=explanation, review_status="needs_review")
            db.add(mapping); db.flush()
            if relationship in {"Potentially conflicts with", "Requires human review", "Insufficient evidence"}:
                score_info = prioritize(impact=0.72, urgency=0.85 if duration and duration <= 48 else 0.35, likelihood=0.58, coverage=0.25, confidence=0.96)
                finding = Finding(org_id=ctx.org.id, obligation_id=obligation.id, mapping_id=mapping.id, category="Potential deadline conflict" if duration and duration <= 48 else "Missing or insufficient supporting evidence", title="Potential operational gap — review required" if duration and duration <= 48 else "Policy coverage needs human confirmation", explanation=explanation, severity="High" if duration and duration <= 48 else score_info["severity"], score=78.4 if duration and duration <= 48 else score_info["score"], confidence=0.93, status="Awaiting Review", suggested_action=action_text, assigned_owner="Security Operations", is_demo=True)
                db.add(finding); db.flush()
                db.add(EvidenceCitation(finding_id=finding.id, document_id=doc.id, clause_id=clause.id if clause else None, evidence_role="contract", quote=quote, page_number=None, section=section, explanation="Exact source quotation from synthetic sample contract."))
                db.add(EvidenceCitation(finding_id=finding.id, document_id=policy.document_id, clause_id=policy.id, evidence_role="policy", quote=policy.text, page_number=None, section=policy.section, explanation=explanation))
        if duration and duration <= 48:
            db.add(Deadline(org_id=ctx.org.id, obligation_id=obligation.id, title=f"Review: {category}", trigger_date=None, due_date=None, reminder_days=7, owner="Security Operations", status="Trigger unknown"))
    # Demo known trigger dates are explicitly synthetic, so only these sample due dates are materialized.
    for index, obligation in enumerate([o for o in obligations if o.category in {"Renewal & termination", "Data handling", "Third-party risk"}][:3]):
        due = due_samples[index]
        db.add(Deadline(org_id=ctx.org.id, obligation_id=obligation.id, title=f"Demo follow-up: {obligation.category}", trigger_date=date.today(), due_date=due, reminder_days=7, owner="Contract Operations", status="Upcoming"))
    task_examples = [
        ("Validate incident escalation path", "Confirm internal response enables the 24-hour customer notice window; do not assume the distinct recipients conflict.", "Security Operations", "High"),
        ("Assign annual audit report owner", "Identify the control owner for annual report review and request handling.", "Vendor Risk", "Medium"),
        ("Confirm renewal notice date", "Record the term-end date before calculating the 60-day notice deadline.", "Legal Operations", "Medium"),
    ]
    open_findings = db.scalars(select(Finding).where(Finding.org_id == ctx.org.id, Finding.is_demo.is_(True))).all()
    for index, (title, description, owner, priority) in enumerate(task_examples):
        db.add(ActionTask(org_id=ctx.org.id, finding_id=open_findings[index].id if index < len(open_findings) else None, title=title, description=description, owner=owner, due_date=due_samples[index], priority=priority, status="Open"))
    db.add(Notification(org_id=ctx.org.id, title="Synthetic demo data loaded", message="Sample contracts and policy evidence are clearly labeled DEMO."))
    audit(db, ctx.org.id, ctx.actor["open_id"], "demo.loaded", "organization", ctx.org.id, {"documents": len(sources), "obligations": len(seeds), "synthetic": True})
    db.commit()
    return {"ok": True, "documents": len(sources), "obligations": len(seeds), "findings": len(open_findings), "message": "Synthetic demonstration data loaded. These are not actual organization findings."}

# In the container, FastAPI serves the compiled SPA at the single configured port.
# The Vite Preview server handles routes directly during development.
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            return await super().get_response("index.html", scope)

_frontend_dist = Path(__file__).resolve().parents[2] / "dist"
if _frontend_dist.exists():
    app.mount("/", SPAStaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
