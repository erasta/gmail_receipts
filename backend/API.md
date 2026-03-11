# Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/emails` | List all emails |
| GET | `/api/emails/{id}` | Get single email (404 if not found) |
| POST | `/api/classify` | Queue emails for classification, non-blocking |
| GET | `/api/classifications` | Poll in-flight classification status |
| GET | `/api/receipts` | List emails classified as receipts |

### POST /api/classify

Body: `{"email_ids": ["id1", "id2"], "force": false}`. Set `force: true` to re-classify.

Returns per-ID status: `"queued"`, `"cached"`, `"already_processing"`, or `"not_found"`.

### GET /api/classifications

Returns only in-flight items: `{"id1": {"status": "pending"}, "id2": {"status": "classifying"}}`.

Empty `{}` = nothing processing. Absent ID = finished or never requested. Status `"error"` includes an `"error"` message field.
