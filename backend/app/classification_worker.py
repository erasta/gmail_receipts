"""Background worker for async email classification.

Processes a queue of email IDs one at a time (serial, since Ollama uses a
single GPU). Successfully classified emails are stored and removed from the
processing dict. Failed ones stay with "error" status.
"""

import logging
import threading
from queue import Queue

from app.classification_store import ClassificationStore
from app.models import Email

logger = logging.getLogger(__name__)


class ClassificationWorker:
    def __init__(self, classifier, store: ClassificationStore):
        self._classifier = classifier
        self._store = store
        self._queue: Queue[tuple[str, Email]] = Queue()
        self._lock = threading.Lock()
        # email_id -> {"status": "pending"|"classifying"|"error", "error"?: str}
        self._processing: dict[str, dict] = {}
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def submit(self, emails: list[Email], force: bool = False) -> dict[str, str]:
        """Queue emails for classification. Returns what happened to each ID.

        Possible per-ID results: "queued", "already_processing", "cached".
        """
        report: dict[str, str] = {}
        with self._lock:
            for email in emails:
                eid = email.id
                existing = self._processing.get(eid)
                if existing and existing["status"] != "error":
                    report[eid] = "already_processing"
                    continue
                if not force and self._store.get(eid) is not None:
                    report[eid] = "cached"
                    continue
                if force:
                    self._store.delete(eid)
                self._processing[eid] = {"status": "pending"}
                self._queue.put((eid, email))
                report[eid] = "queued"
        return report

    def get_processing(self) -> dict[str, dict]:
        """Return current processing state. Empty means nothing in flight."""
        with self._lock:
            return dict(self._processing)

    def _run(self) -> None:
        while True:
            eid, email = self._queue.get()
            with self._lock:
                self._processing[eid] = {"status": "classifying"}
            try:
                result = self._classifier.classify(email)
                self._store.put(result)
                with self._lock:
                    del self._processing[eid]
            except Exception as e:
                logger.error("Classification failed for %s: %s", eid, e)
                with self._lock:
                    self._processing[eid] = {"status": "error", "error": str(e)}
