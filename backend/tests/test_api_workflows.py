import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import func, select

_TEST_DB = Path("/tmp") / f"contractguard-api-workflows-{os.getpid()}.sqlite"
_TEST_DB.unlink(missing_ok=True)
for _name in ("MANUS_PROJECT_ID", "MANUS_JWT_SECRET", "MANUS_OAUTH_PORTAL_URL", "MANUS_OAUTH_API_URL", "CONTRACTGUARD_ALLOWED_ORIGINS"):
    os.environ.pop(_name, None)
os.environ["AUTH_MODE"] = "demo"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

from backend.app.database import SessionLocal, engine  # noqa: E402
from backend.app.main import DEFAULT_PREVIEW_ORIGIN, app  # noqa: E402
from backend.app.models import (  # noqa: E402
    Document,
    EvidenceCitation,
    Finding,
    Membership,
    PolicyMapping,
    User,
)


def _signed_session(open_id: str, secret: str) -> str:
    return jwt.encode(
        {"openId": open_id, "appId": "contractguard-test", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        secret,
        algorithm="HS256",
    )


def test_later_policy_analysis_is_idempotent_and_security_boundaries_hold(monkeypatch):
    try:
        with TestClient(app) as client:
            monkeypatch.setattr(main_module, "save_original", lambda filename, content: f"uploads/isolated-{Path(filename).name}")
            demo = client.get("/api/bootstrap").json()
            assert demo["demo_mode"] is True
            assert demo["user"]["role"] == "admin"
            demo_org_id = demo["organization"]["id"]

            contract_text = Path("backend/demo/vendor_northstar.txt").read_text(encoding="utf-8")
            invalid_upload = client.post("/api/documents", params={"document_type": "Unknown type"}, files={"file": ("contract.txt", contract_text.encode(), "text/plain")})
            assert invalid_upload.status_code == 422
            uploaded_contract = client.post("/api/documents", params={"document_type": "Vendor Contract"}, files={"file": ("Synthetic Northstar.txt", contract_text.encode(), "text/plain")})
            assert uploaded_contract.status_code == 200, uploaded_contract.text
            contract_id = uploaded_contract.json()["id"]

            first = client.post("/api/analyze")
            assert first.status_code == 200
            assert first.json()["new_obligations"] >= 1
            assert any(f["category"] == "Missing policy coverage" for f in client.get("/api/findings").json())

            policy_text = Path("backend/demo/incident_response.txt").read_text(encoding="utf-8")
            uploaded_policy = client.post("/api/documents", params={"document_type": "Internal Security Policy"}, files={"file": ("Synthetic Incident Response.txt", policy_text.encode(), "text/plain")})
            assert uploaded_policy.status_code == 200, uploaded_policy.text

            second = client.post("/api/analyze")
            assert second.status_code == 200
            assert second.json()["new_obligations"] == 0
            findings = client.get("/api/findings").json()
            assert any(c["role"] == "policy" for f in findings for c in f["citations"])
            with SessionLocal() as db:
                mapping_count = db.scalar(select(func.count()).select_from(PolicyMapping))
                policy_citation_count = db.scalar(select(func.count()).select_from(EvidenceCitation).where(EvidenceCitation.evidence_role == "policy"))
            assert mapping_count > 0 and policy_citation_count > 0

            third = client.post("/api/analyze").json()
            assert third["new_obligations"] == 0 and third["new_findings"] == 0
            with SessionLocal() as db:
                assert db.scalar(select(func.count()).select_from(PolicyMapping)) == mapping_count

            # Create an authenticated organization member, then check reviewer restrictions.
            secret = "isolated-test-key-not-for-production"
            os.environ.update({
                "MANUS_PROJECT_ID": "contractguard-test",
                "MANUS_JWT_SECRET": secret,
                "MANUS_OAUTH_PORTAL_URL": "https://login.invalid",
                "MANUS_OAUTH_API_URL": "https://auth.invalid",
                "CONTRACTGUARD_ALLOWED_ORIGINS": DEFAULT_PREVIEW_ORIGIN,
            })
            client.cookies.set("webdev_app_session", _signed_session("test-reviewer", secret), path="/")
            hosted = client.get("/api/bootstrap").json()
            with SessionLocal() as db:
                user = db.scalar(select(User).where(User.open_id == "test-reviewer"))
                membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
                membership.role = "reviewer"
                document = Document(org_id=membership.org_id, file_name="private.txt", document_type="Vendor Contract", extracted_text="Synthetic test")
                db.add(document)
                db.flush()
                restricted_doc_id = document.id
                finding = Finding(
                    org_id=membership.org_id,
                    category="Review",
                    title="Synthetic test finding",
                    explanation="Test-only record",
                    severity="Medium",
                    score=50,
                    confidence=0.5,
                    status="Open",
                    suggested_action="Review",
                )
                db.add(finding)
                db.commit()
                restricted_finding_id = finding.id
            assert client.get("/api/bootstrap").json()["user"]["role"] == "reviewer"
            assert client.delete(f"/api/documents/{restricted_doc_id}").status_code == 403
            assert client.post(
                f"/api/findings/{restricted_finding_id}/review",
                json={"decision": "Severity override", "reason": "test reason", "severity": "High"},
            ).status_code == 403
            assert client.post(
                f"/api/findings/{restricted_finding_id}/review",
                json={"decision": "Reviewed", "reason": "reviewed"},
            ).status_code == 200

            # Inject a cross-organization citation in the isolated DB; the API must not serialize it.
            with SessionLocal() as db:
                demo_finding = db.scalar(select(Finding).where(Finding.org_id == demo_org_id))
                foreign_doc = db.scalar(select(Document).where(Document.org_id == hosted["organization"]["id"]))
                db.add(EvidenceCitation(
                    finding_id=demo_finding.id,
                    document_id=foreign_doc.id,
                    evidence_role="policy",
                    quote="must never be exposed across organizations",
                    explanation="cross-organization regression fixture",
                ))
                db.commit()
                demo_finding_id = demo_finding.id
            client.cookies.set("webdev_app_session", _signed_session("local-demo-reviewer", secret), path="/")
            visible_finding = client.get(f"/api/findings/{demo_finding_id}").json()
            assert all("must never be exposed" not in c["quote"] for c in visible_finding["citations"])

            assert client.get("/api/auth/login", params={"origin": "https://attacker.invalid"}, follow_redirects=False).status_code == 403
            login = client.get("/api/auth/login", params={"origin": DEFAULT_PREVIEW_ORIGIN}, follow_redirects=False)
            assert login.status_code == 302
            state = parse_qs(urlsplit(login.headers["location"]).query)["state"][0]
            state_parts = state.split(".")
            state_parts[2] = ("a" if state_parts[2][0] != "a" else "b") + state_parts[2][1:]
            changed_state = ".".join(state_parts)
            assert client.get("/api/auth/callback", params={"code": "test", "state": changed_state}, follow_redirects=False).status_code == 400
            nonce = client.cookies.get("cg_oauth_nonce")
            forged_state = jwt.encode(
                {"nonce": nonce, "redirectUri": "https://attacker.invalid/api/auth/callback", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                secret,
                algorithm="HS256",
            )
            assert client.get("/api/auth/callback", params={"code": "test", "state": forged_state}, follow_redirects=False).status_code == 400

            graph = client.get("/api/graph").json()
            visible_node_ids = {node["id"] for node in graph["nodes"]}
            assert all(edge["source"] in visible_node_ids and edge["target"] in visible_node_ids for edge in graph["edges"])
            assert contract_id
    finally:
        engine.dispose()
        _TEST_DB.unlink(missing_ok=True)
from backend.app import main as main_module  # noqa: E402
