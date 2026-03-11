from pydantic import BaseModel
from datetime import datetime


class Email(BaseModel):
    id: str
    from_address: str
    to_address: str
    subject: str
    date: datetime
    body_text: str
    body_html: str | None = None
    attachments: list[str] = []


class ClassificationResult(BaseModel):
    email_id: str
    is_receipt: bool
    confidence: float
    reason: str


class Receipt(BaseModel):
    email_id: str
    from_address: str
    subject: str
    date: datetime
    amount: str | None = None
    currency: str | None = None
    vendor: str | None = None
    classification: ClassificationResult
