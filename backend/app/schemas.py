from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ContainerEntryCreate(BaseModel):
    container_key: str
    title: str
    note: Optional[str] = None


class ContainerEntryOut(BaseModel):
    id: str
    container_key: str
    title: str
    note: Optional[str] = None
    date: datetime


class ContainerCreate(BaseModel):
    title: str
    icon: Optional[str] = None
    source: Optional[str] = "user"  # 'user' | 'socrates'


class ContainerSummary(BaseModel):
    containers: dict
    proof_score: Optional[int] = None


class LifeGoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    container_key: Optional[str] = None
    target_date: Optional[str] = None


class LifeGoalUpdate(BaseModel):
    progress_percent: Optional[int] = None
    status: Optional[str] = None  # 'active' | 'completed' | 'abandoned'


class MentorshipMatchOut(BaseModel):
    lane: str
    lane_type: str
    mentor_name: str


class MentorshipRequestIn(BaseModel):
    role: str = "mentee"  # 'mentee' | 'mentor'
    container_key: Optional[str] = None  # set this OR profession, not both
    profession: Optional[str] = None


class SocratesMessageIn(BaseModel):
    message: str


class SocratesMessageOut(BaseModel):
    reply: str
    suggested_container: Optional[str] = None
    safety_mode: bool = False


class FinanceTransactionCreate(BaseModel):
    amount: float
    type: str  # 'income' | 'expense' | 'savings'
    category: Optional[str] = None
    note: Optional[str] = None
    occurred_at: Optional[datetime] = None


class FinanceGoalCreate(BaseModel):
    title: str
    target_amount: float
    deadline: Optional[str] = None


class STKPushIn(BaseModel):
    phone_number: str  # format 2547XXXXXXXX
    amount: float
    goal_id: Optional[str] = None


class SMSImportLine(BaseModel):
    raw_text: str


class SMSImportBatch(BaseModel):
    messages: list[SMSImportLine]
