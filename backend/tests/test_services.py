from backend.app.services.extraction import extract_obligations, extract_text, split_clauses
from backend.app.services.deadlines import calculate_due_date
from backend.app.services.retrieval import compare_obligation_to_policy, prioritize, relevance


def test_txt_extraction_preserves_text_and_unknown_page():
    text = "Section 4.2\nThe service provider shall notify the client within 24 hours after discovery."
    extracted, pages, status = extract_text("sample.txt", text.encode())
    assert extracted == text
    assert pages is None
    assert status == "complete"


def test_contract_clause_quote_is_exact_and_unknown_deadline_stays_unknown():
    quote = "The service provider shall notify the client of a security incident after discovery."
    records = extract_obligations([{"text": quote, "page_number": None, "section": "4.2"}])
    assert len(records) == 1
    assert records[0]["exact_quote"] == quote
    assert records[0]["deadline_duration"] is None
    assert records[0]["deadline_unit"] is None
    assert records[0]["review_status"] == "needs_review"


def test_split_clauses_preserves_page_and_section_when_present():
    text = "[Page 3]\nSection 4.2\nThe service provider shall notify the client within 24 hours after discovery."
    items = split_clauses(text)
    assert items
    assert all(item["page_number"] == 3 for item in items)
    assert any(item["section"] == "4.2" for item in items)


def test_relevance_prefers_related_policy_language():
    query = "notify client about security incident within hours"
    assert relevance(query, "Security incident reporting and notification to client") > relevance(query, "Office access badge replacement")


def test_distinct_reporting_recipients_are_not_called_direct_conflict():
    relation, explanation, action = compare_obligation_to_policy(
        {"exact_quote": "Notify the client within 24 hours after discovery of a security incident.", "responsible_party": "Provider", "deadline_duration": 24, "deadline_unit": "hour"},
        "Report incidents internally within 72 hours after discovery.", 0.8,
    )
    assert relation == "Requires human review"
    assert "not necessarily contradictory" in explanation
    assert "escalation" in action.lower()


def test_risk_score_is_explainable_and_confidence_is_separate():
    result = prioritize(impact=0.7, urgency=0.5, likelihood=0.6, coverage=0.3, confidence=0.4)
    assert 0 <= result["score"] <= 100
    assert result["severity"] in {"Critical", "High", "Medium", "Low"}
    assert "30%" in result["formula"]


def test_deadline_month_and_year_arithmetic_uses_calendar_dates():
    from datetime import date
    assert calculate_due_date(date(2026, 1, 31), 1, "month") == date(2026, 2, 28)
    assert calculate_due_date(date(2024, 2, 29), 1, "year") == date(2025, 2, 28)


def test_deadline_business_days_skip_weekends_and_hours_are_not_guessed():
    from datetime import date
    assert calculate_due_date(date(2026, 10, 30), 1, "business day") == date(2026, 11, 2)
    try:
        calculate_due_date(date(2026, 10, 30), 24, "hours")
        assert False, "unsupported hour-based calendar date should be rejected"
    except ValueError as exc:
        assert "source unit" in str(exc)
