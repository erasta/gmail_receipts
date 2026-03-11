# Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/emails` | List all emails |
| GET | `/api/emails/{id}` | Get single email |
| POST | `/api/classify` | Queue emails for classification |
| GET | `/api/classifications` | Poll in-flight classification status |
| GET | `/api/receipts` | List emails classified as receipts |

### GET /api/health

Returns `{"status": "ok"}`. Use to check if the backend is running.

### GET /api/emails

Returns all emails fetched from Gmail. No classification info — just raw email data (id, from, to, subject, date, body).

### GET /api/emails/{id}

Returns a single email by ID. Returns 404 if the ID doesn't exist.

### POST /api/classify

Body: `{"email_ids": ["id1", "id2"], "force": false}`. Set `force: true` to re-classify.

Returns per-ID status: `"queued"`, `"cached"`, `"already_processing"`, or `"not_found"`. Resubmitting an errored email clears the error and re-queues it.

### GET /api/classifications

Returns only in-flight items: `{"id1": {"status": "pending"}, "id2": {"status": "classifying"}}`.

Empty `{}` = nothing processing. Absent ID = finished or never requested. Status `"error"` includes an `"error"` message field.

### GET /api/receipts

Returns emails that have been classified as receipts, with their classification data. Only includes already-classified emails — call `/api/classify` first.
