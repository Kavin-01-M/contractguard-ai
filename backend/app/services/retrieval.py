from __future__ import annotations
import math
import re
from collections import Counter
from typing import Any

STOP = {"shall", "must", "will", "the", "and", "for", "with", "from", "that", "this", "within", "after", "before", "their", "into", "upon", "each"}


def tokens(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in STOP]


def relevance(query: str, candidate: str) -> float:
    a, b = Counter(tokens(query)), Counter(tokens(candidate))
    if not a or not b:
        return 0.0
    intersection = set(a) & set(b)
    overlap = sum(min(a[t], b[t]) for t in intersection)
    cosine = overlap / (math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values())) or 1)
    coverage = overlap / (sum(a.values()) or 1)
    return round(min(1.0, 0.72 * cosine + 0.28 * coverage), 4)


def compare_obligation_to_policy(obligation: dict[str, Any], policy_text: str, score: float) -> tuple[str, str, str]:
    obligation_text = obligation.get("exact_quote", "")
    actor = obligation.get("responsible_party", "Unknown")
    deadline = obligation.get("deadline_duration")
    policy_lower, contract_lower = policy_text.lower(), obligation_text.lower()
    same_topic = score >= 0.16
    if not same_topic:
        return "Insufficient evidence", "Retrieved content has limited lexical overlap; human review is required.", "Confirm whether a policy clause applies; no compliance conclusion is supported by this match."
    if deadline and re.search(r"\bwithin\s+(\d+)\s+hours?\b", policy_lower, re.I):
        p = int(re.search(r"\bwithin\s+(\d+)\s+hours?\b", policy_lower, re.I).group(1))
        if p > deadline:
            recipients_differ = ("internal" in policy_lower and "client" in contract_lower) or ("client" in policy_lower and "internal" in contract_lower)
            if recipients_differ:
                return "Requires human review", "The time windows differ and the recipients may differ; these clauses are not necessarily contradictory.", "Review whether the internal escalation procedure enables the organization to meet the contract's notification window."
            return "Potentially conflicts with", f"Contract says within {deadline} {obligation.get('deadline_unit') or 'units'}; policy clause states a longer window.", "Confirm the actors, trigger, scope, and operational control before determining whether the requirements conflict."
    if any(term in contract_lower and term in policy_lower for term in ["notify", "report", "delete", "retain", "encrypt", "audit"]):
        return "Partially supports", "The policy discusses a related topic, but coverage of scope, actor, trigger, and timing still needs review.", "Verify applicability, owner, and timing against the exact contract clause."
    return "Requires human review", "Topic overlap is a retrieval signal only; it does not establish that the policy satisfies the contract.", f"Review the policy text alongside the contract obligation attributed to {actor}."


def prioritize(impact: float, urgency: float, likelihood: float, coverage: float, confidence: float) -> dict[str, Any]:
    # Transparent default weights: impact .30, urgency .25, likelihood .20, gap .15, evidence .10.
    score = round(100 * (0.30 * impact + 0.25 * urgency + 0.20 * likelihood + 0.15 * (1 - coverage) + 0.10 * confidence), 1)
    severity = "Critical" if score >= 86 else "High" if score >= 70 else "Medium" if score >= 45 else "Low"
    return {"score": score, "severity": severity, "formula": "Impact 30% + urgency 25% + likelihood 20% + control gap 15% + evidence confidence 10%"}
