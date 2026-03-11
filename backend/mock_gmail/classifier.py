"""Mock email classifier.

Mimics the interface of a real classifier (e.g. Ollama) but just looks up
the is_receipt flag from the mock data instead of analyzing content.

The real classifier will have the same interface:
    classifier.classify(email) -> ClassificationResult
"""

from app.models import ClassificationResult, Email
from mock_gmail.data import RECEIPT_IDS


class MockClassifier:
    def classify(self, email: Email) -> ClassificationResult:
        is_receipt = email.id in RECEIPT_IDS
        return ClassificationResult(
            email_id=email.id,
            is_receipt=is_receipt,
            confidence=1.0,
            reason="Mock classifier: looked up from test data",
        )
