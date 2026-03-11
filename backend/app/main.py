from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.classification_store import ClassificationStore
from app.gmail_parser import parse_message
from app.models import ClassificationResult, Email, Receipt
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


def _get_all_emails():
    refs = gmail.users().messages().list(userId="me").execute().get("messages", [])
    emails = []
    for ref in refs:
        msg = gmail.users().messages().get(userId="me", id=ref["id"]).execute()
        emails.append(parse_message(msg))
    return emails


def _get_email(email_id: str):
    try:
        msg = gmail.users().messages().get(userId="me", id=email_id).execute()
        return parse_message(msg)
    except GmailApiError:
        return None


def _classify(email: Email) -> ClassificationResult:
    cached = store.get(email.id)
    if cached is not None:
        return cached
    result = classifier.classify(email)
    store.put(result)
    return result


def _to_receipt(email: Email) -> Receipt | None:
    classification = _classify(email)
    if not classification.is_receipt:
        return None
    return Receipt(
        email_id=email.id,
        from_address=email.from_address,
        subject=email.subject,
        date=email.date,
        classification=classification,
    )


@app.get("/api/emails")
def list_emails():
    return _get_all_emails()


@app.get("/api/emails/{email_id}")
def read_email(email_id: str):
    email = _get_email(email_id)
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


@app.get("/api/receipts")
def list_receipts():
    receipts: list[Receipt] = []
    for email in _get_all_emails():
        receipt = _to_receipt(email)
        if receipt is not None:
            receipts.append(receipt)
    return receipts
