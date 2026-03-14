import os
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.classification_store import ClassificationStore
from app.classification_worker import ClassificationWorker
from app.gmail_parser import parse_message
from app.models import Email, Receipt
from app.ollama_classifier import OllamaClassifier
from mock_gmail.classifier import MockClassifier
from mock_gmail.client import GmailApiError, MockGmailService

app = FastAPI(title="Gmail Receipts API")

_FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gmail = MockGmailService()
store = ClassificationStore()

_classifiers = {
    "mock": MockClassifier(),
    "ollama": OllamaClassifier(),
}
_active_classifier = os.environ.get("CLASSIFIER", "mock")
worker = ClassificationWorker(_classifiers[_active_classifier], store)


class ClassifyRequest(BaseModel):
    email_ids: list[str]
    force: bool = False


class SetClassifierRequest(BaseModel):
    classifier: str


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


@app.get("/api/health")
def health():
    return {"status": "ok"}


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


@app.get("/api/classifier")
def get_classifier():
    return {"classifier": _active_classifier}


@app.put("/api/classifier")
def set_classifier(req: SetClassifierRequest):
    """Switch classifier and clear all cached classifications."""
    global _active_classifier, worker
    if req.classifier not in _classifiers:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown classifier: {req.classifier}. Valid: {list(_classifiers.keys())}",
        )
    if req.classifier == _active_classifier:
        return {"classifier": _active_classifier, "changed": False}
    _active_classifier = req.classifier
    store.clear()
    worker = ClassificationWorker(_classifiers[_active_classifier], store)
    return {"classifier": _active_classifier, "changed": True}


@app.delete("/api/classifications")
def clear_classifications():
    """Clear all cached classification results."""
    global worker
    store.clear()
    worker = ClassificationWorker(_classifiers[_active_classifier], store)
    return {"cleared": True}


# --- Serve frontend static files (must be after all /api routes) ---
if _FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="static")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(_FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    os.chdir(_BACKEND_DIR)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
