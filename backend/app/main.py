from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.classification_store import ClassificationStore
from app.classification_worker import ClassificationWorker
from app.gmail_parser import parse_message
from app.models import Email, Receipt
from mock_gmail.classifier import MockClassifier
from mock_gmail.client import GmailApiError, MockGmailService

app = FastAPI(title="Gmail Receipts API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gmail = MockGmailService()
classifier = MockClassifier()
store = ClassificationStore()
worker = ClassificationWorker(classifier, store)


class ClassifyRequest(BaseModel):
    email_ids: list[str]
    force: bool = False


def _get_all_emails():
    refs = gmail.users().messages().list(userId="me").execute().get("messages", [])
    emails = []
    for ref in refs:
        msg = gmail.users().messages().get(userId="me", id=ref["id"]).execute()
        emails.append(parse_message(msg))
    return emails


def _get_email(email_id: str) -> Email | None:
    try:
        msg = gmail.users().messages().get(userId="me", id=email_id).execute()
        return parse_message(msg)
    except GmailApiError:
        return None


@app.get("/api/emails")
def list_emails():
    return _get_all_emails()


@app.get("/api/emails/{email_id}")
def read_email(email_id: str):
    email = _get_email(email_id)
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


@app.post("/api/classify")
def classify_emails(req: ClassifyRequest):
    """Queue emails for classification. Non-blocking."""
    emails = []
    not_found = []
    for eid in req.email_ids:
        email = _get_email(eid)
        if email is None:
            not_found.append(eid)
        else:
            emails.append(email)
    report = worker.submit(emails, force=req.force)
    if not_found:
        for eid in not_found:
            report[eid] = "not_found"
    return report


@app.get("/api/classifications")
def get_classifications():
    """Return emails currently being processed.

    Empty dict means nothing in flight. If an email_id is absent,
    check the store — it's either finished or was never requested.
    """
    return worker.get_processing()


@app.get("/api/receipts")
def list_receipts():
    """Return all emails that have been classified as receipts."""
    results = store.get_all()
    receipt_ids = {r.email_id for r in results if r.is_receipt}
    receipts: list[Receipt] = []
    for email in _get_all_emails():
        if email.id not in receipt_ids:
            continue
        classification = store.get(email.id)
        if classification is None:
            continue
        receipts.append(Receipt(
            email_id=email.id,
            from_address=email.from_address,
            subject=email.subject,
            date=email.date,
            classification=classification,
        ))
    return receipts
