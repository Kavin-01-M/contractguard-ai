from datetime import date
from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=240)
    description: str = ""
    finding_id: str | None = None
    owner: str = "Unassigned"
    due_date: date | None = None
    priority: str = "Medium"


class TaskUpdate(BaseModel):
    status: str | None = None
    owner: str | None = None
    due_date: date | None = None
    priority: str | None = None
    comment: str | None = None
    resolution_notes: str | None = None


class FindingReview(BaseModel):
    decision: str = Field(pattern="^(Reviewed|Resolved|Reopened|Severity override)$")
    reason: str = ""
    severity: str | None = Field(default=None, pattern="^(Critical|High|Medium|Low)$")


class TriggerDate(BaseModel):
    trigger_date: date


class CopilotQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=1200)


class LoginPayload(BaseModel):
    email: str | None = None
    password: str | None = None
    name: str | None = None
    role: str = "reviewer"


class AuthUser(BaseModel):
    open_id: str
    name: str
    email: str | None = None
    role: str = "reviewer"
    demo: bool = False
