"""Mock Gmail API service mimicking google-api-python-client interface.

Usage mirrors the real client:
    # Real:
    #   from googleapiclient.discovery import build
    #   service = build("gmail", "v1", credentials=creds)
    # Mock:
    from mock_gmail.client import MockGmailService
    service = MockGmailService()

    # Both use the same call pattern:
    results = service.users().messages().list(userId="me").execute()
    msg = service.users().messages().get(userId="me", id="...").execute()
"""

from mock_gmail.data import MESSAGES, MESSAGES_BY_ID


class GmailApiError(Exception):
    """Mirrors googleapiclient.errors.HttpError."""

    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(f"HttpError {status}: {message}")


class _ExecutableRequest:
    """Wraps a result so callers must call .execute() like the real client."""

    def __init__(self, result: dict):
        self._result = result

    def execute(self) -> dict:
        return self._result


class _Messages:
    def list(
        self,
        userId: str = "me",
        maxResults: int | None = None,
        pageToken: str | None = None,
        q: str | None = None,
        labelIds: list[str] | None = None,
    ) -> _ExecutableRequest:
        refs = [{"id": m["id"], "threadId": m["threadId"]} for m in MESSAGES]
        if labelIds:
            label_set = set(labelIds)
            refs = [
                r
                for r in refs
                if label_set.issubset(set(MESSAGES_BY_ID[r["id"]]["labelIds"]))
            ]
        if maxResults:
            refs = refs[:maxResults]
        return _ExecutableRequest({
            "messages": refs,
            "resultSizeEstimate": len(refs),
        })

    def get(
        self,
        userId: str = "me",
        id: str = "",
        format: str = "full",
    ) -> _ExecutableRequest:
        msg = MESSAGES_BY_ID.get(id)
        if msg is None:
            raise GmailApiError(404, f"Message {id} not found")
        if format == "minimal":
            return _ExecutableRequest({
                k: msg[k]
                for k in ("id", "threadId", "labelIds", "snippet", "internalDate", "sizeEstimate")
            })
        if format == "metadata":
            return _ExecutableRequest({
                "id": msg["id"],
                "threadId": msg["threadId"],
                "labelIds": msg["labelIds"],
                "snippet": msg["snippet"],
                "internalDate": msg["internalDate"],
                "sizeEstimate": msg["sizeEstimate"],
                "payload": {"headers": msg["payload"]["headers"]},
            })
        return _ExecutableRequest(msg)


class _Users:
    def messages(self) -> _Messages:
        return _Messages()


class MockGmailService:
    """Drop-in replacement for googleapiclient's Gmail service."""

    def users(self) -> _Users:
        return _Users()
