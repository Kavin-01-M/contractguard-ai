from calendar import monthrange
from datetime import date, timedelta


def calculate_due_date(trigger_date: date, duration: int, unit: str) -> date:
    if duration <= 0:
        raise ValueError("A positive, source-supported duration is required.")
    normalized = unit.strip().lower()
    if normalized in {"business day", "business days"}:
        due = trigger_date
        remaining = duration
        while remaining:
            due += timedelta(days=1)
            if due.weekday() < 5:
                remaining -= 1
        return due
    if normalized in {"day", "days"}:
        return trigger_date + timedelta(days=duration)
    if normalized in {"week", "weeks"}:
        return trigger_date + timedelta(days=duration * 7)
    if normalized in {"month", "months"}:
        month_index = trigger_date.month - 1 + duration
        year = trigger_date.year + month_index // 12
        month = month_index % 12 + 1
        day = min(trigger_date.day, monthrange(year, month)[1])
        return date(year, month, day)
    if normalized in {"year", "years"}:
        target_year = trigger_date.year + duration
        try:
            return trigger_date.replace(year=target_year)
        except ValueError:  # February 29 in a non-leap year.
            return date(target_year, 2, 28)
    raise ValueError(f"Cannot calculate a calendar due date from the source unit '{unit}'.")
