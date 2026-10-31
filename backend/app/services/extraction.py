from __future__ import annotations
import re
from pathlib import Path
from typing import Any

ALLOWED_SUFFIXES = {".pdf", ".docx", ".txt"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def extract_text(filename: str, data: bytes) -> tuple[str, int | None, str]:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise ValueError("Unsupported file type. Upload PDF, DOCX, or TXT.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("File exceeds the 20 MB upload limit.")
    if suffix == ".txt":
        text = data.decode("utf-8", errors="replace")
        return text, None, "complete" if text.strip() else "empty"
    if suffix == ".pdf":
        try:
            import fitz
        except ImportError as exc:
            raise ValueError("PDF extraction requires PyMuPDF. Install backend requirements and retry.") from exc
        doc = fitz.open(stream=data, filetype="pdf")
        pages = [page.get_text("text") for page in doc]
        text = "\n".join(f"[Page {i + 1}]\n{body}" for i, body in enumerate(pages))
        return text, len(doc), "complete" if text.strip() else "needs_ocr"
    try:
        from docx import Document as DocxDocument
        import io
        docx = DocxDocument(io.BytesIO(data))
        paragraphs = [p.text for p in docx.paragraphs if p.text.strip()]
        for table in docx.tables:
            for row in table.rows:
                paragraphs.append(" | ".join(cell.text for cell in row.cells))
        text = "\n".join(paragraphs)
        return text, None, "complete" if text.strip() else "empty"
    except ImportError as exc:
        raise ValueError("DOCX extraction requires python-docx. Install backend requirements and retry.") from exc


def split_clauses(text: str) -> list[dict[str, Any]]:
    page: int | None = None
    clauses: list[dict[str, Any]] = []
    current: list[str] = []
    current_page: int | None = None

    def flush() -> None:
        value = " ".join(part.strip() for part in current if part.strip()).strip()
        if len(value) >= 20:
            section_match = re.search(r"\b(?:Section\s+)?(\d+(?:\.\d+){0,3})\b", value, re.I)
            clauses.append({"text": value, "page_number": current_page, "section": section_match.group(1) if section_match else None})
        current.clear()

    for line in text.splitlines():
        page_match = re.match(r"\[Page (\d+)\]", line.strip())
        if page_match:
            flush()
            page = int(page_match.group(1))
            continue
        if not line.strip():
            flush()
            continue
        if current and re.match(r"^\s*(?:\d+(?:\.\d+)*[.)]?|\([a-z0-9]+\))\s+", line, re.I):
            flush()
        if not current:
            current_page = page
        current.append(line)
    flush()
    return clauses


def _actor(text: str) -> str:
    patterns = [
        (r"\b(service provider|provider|vendor|processor|supplier|contractor)\b", "Service provider"),
        (r"\b(client|customer|controller|recipient|company|organization)\b", "Client / organization"),
        (r"\b(each party|either party|both parties|party)\b", "Contracting party"),
    ]
    for pattern, name in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1).title() if name in {"Service provider", "Client / organization", "Contracting party"} else name
    return "Unknown"


def extract_obligations(clauses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    for clause in clauses:
        quote = clause["text"].strip()
        if not re.search(r"\b(shall|must|required to|will)\b", quote, re.I):
            continue
        if len(quote) > 2400:
            continue
        deadline_match = re.search(r"\bwithin\s+(\d+)\s+(hours?|days?|business days?|weeks?|months?)\b", quote, re.I)
        duration = int(deadline_match.group(1)) if deadline_match else None
        unit = deadline_match.group(2).lower().rstrip("s") if deadline_match else None
        actor = _actor(quote)
        verb = re.search(r"\b(?:shall|must|required to|will)\s+(?:promptly\s+)?([a-z][a-z-]+)", quote, re.I)
        action = verb.group(1).lower() if verb else "Unknown"
        low = quote.lower()
        if any(word in low for word in ["incident", "breach", "security"]):
            category = "Security incident reporting"
        elif any(word in low for word in ["delete", "retain", "retention", "personal data"]):
            category = "Data handling"
        elif any(word in low for word in ["renew", "notice", "termination", "expire"]):
            category = "Renewal & termination"
        elif any(word in low for word in ["audit", "report", "soc 2", "soc2"]):
            category = "Assurance & reporting"
        else:
            category = "General"
        triggers = re.search(r"\b(?:after|upon|following|from)\s+([^.;,]{3,100})", quote, re.I)
        trigger = triggers.group(1).strip() if triggers else "Unknown"
        unknown = actor == "Unknown" or (duration is None and not re.search(r"\b(annually|monthly|on termination|before expiration)\b", low))
        results.append({
            "description": quote, "responsible_party": actor, "required_action": action,
            "action_object": "Unknown", "trigger_event": trigger if trigger else "Unknown",
            "deadline_duration": duration, "deadline_unit": unit, "absolute_deadline": None,
            "category": category, "consequence": None, "source_page": clause.get("page_number"),
            "source_section": clause.get("section"), "exact_quote": quote,
            "confidence": 0.78 if not unknown else 0.54,
            "review_status": "needs_review" if unknown else "extracted",
        })
    return results
