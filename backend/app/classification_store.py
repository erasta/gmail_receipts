"""JSON file store for classification results.

Persists classifier output so emails are only classified once.
"""

import json
from pathlib import Path

from app.models import ClassificationResult

_DEFAULT_PATH = Path(__file__).parent.parent / "data" / "classifications.json"


class ClassificationStore:
    def __init__(self, path: Path = _DEFAULT_PATH):
        self._path = path
        self._data: dict[str, dict] = {}
        if self._path.exists():
            with open(self._path, encoding="utf-8") as f:
                self._data = json.load(f)

    def get(self, email_id: str) -> ClassificationResult | None:
        entry = self._data.get(email_id)
        if entry is None:
            return None
        return ClassificationResult(
            email_id=email_id,
            is_receipt=entry["is_receipt"],
            confidence=entry["confidence"],
            reason=entry["reason"],
        )

    def put(self, result: ClassificationResult) -> None:
        self._data[result.email_id] = {
            "is_receipt": result.is_receipt,
            "confidence": result.confidence,
            "reason": result.reason,
        }
        self._save()

    def get_all(self) -> list[ClassificationResult]:
        return [
            ClassificationResult(
                email_id=eid,
                is_receipt=entry["is_receipt"],
                confidence=entry["confidence"],
                reason=entry["reason"],
            )
            for eid, entry in self._data.items()
        ]

    def _save(self) -> None:
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)
