// Shapes returned by the FastAPI backend.

export type Classification = {
  is_receipt: boolean;
  confidence: number;
  reason: string;
};

// Summary rows for the list view (no email body).
export type ReceiptSummary = {
  base_name: string;
  uid: string;
  date: string;
  from: string;
  subject: string;
  attachments: string[];
  classification: Classification | null;
  labels: string[];
  to: string | null;
  cc: string | null;
  body: string | null;
};

// A summary row tagged with the month it came from, so a merged list spanning
// several months can still open each receipt and its attachments.
export type ReceiptRow = ReceiptSummary & {
  month: string;
};

// One label and how many emails carry it, across all months.
export type LabelCount = {
  label: string;
  count: number;
};

// Full metadata for one receipt.
export type Receipt = ReceiptSummary & {
  message_id: string;
  body: string;
  labels?: string[];
  to?: string;
  cc?: string;
  reply_to?: string;
  sender?: string;
  bcc?: string;
  return_path?: string;
  delivered_to?: string;
  in_reply_to?: string;
  references?: string;
  list_unsubscribe?: string;
  list_id?: string;
};

export type Ledger = {
  seen: number;
  receipts: number;
};

// A receipt can be marked one of two ways (mutually exclusive): Export to keep
// it for the export set, or Hide to drop it from the list. A const object plus
// a union type, since the project forbids real enums (erasableSyntaxOnly).
export const MarkKind = {
  Export: "export",
  Hide: "hide",
} as const;
export type MarkKind = (typeof MarkKind)[keyof typeof MarkKind];

// Hand-picked marks, grouped by month:
// { "2025-01": { "<base_name>": "export" } }.
export type Marks = Record<string, Record<string, MarkKind>>;

// An update batch may set a kind, or null to clear a receipt's mark.
export type MarkUpdates = Record<string, Record<string, MarkKind | null>>;

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
};

export const fetchMonths = () => getJson<string[]>("/api/months");

export const fetchLabels = () => getJson<LabelCount[]>("/api/labels");

export const fetchReceipts = (month: string) =>
  getJson<ReceiptSummary[]>(`/api/months/${month}/receipts`);

export const fetchReceipt = (month: string, baseName: string) =>
  getJson<Receipt>(`/api/months/${month}/receipts/${baseName}`);

export const fetchLedger = (month: string) =>
  getJson<Ledger>(`/api/months/${month}/ledger`);

export const fetchMarks = () => getJson<Marks>("/api/marks");

// Set a batch of receipt marks in one request; the body is
// month -> { base_name: "export" | "hide" | null }, where null clears the mark.
// The backend returns the full updated marks.
export const saveMarks = async (updates: MarkUpdates): Promise<Marks> => {
  const res = await fetch("/api/marks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for /api/marks`);
  }
  return res.json();
};

// Set or clear one receipt's mark, expressed as a one-entry batch.
export const setMark = (
  month: string,
  baseName: string,
  kind: MarkKind | null,
): Promise<Marks> => saveMarks({ [month]: { [baseName]: kind } });

// The backend renders this email to a vector PDF (body only, no attachments).
export const receiptPdfUrl = (month: string, baseName: string) =>
  `/api/months/${month}/receipts/${encodeURIComponent(baseName)}/pdf`;

export const attachmentUrl = (
  month: string,
  baseName: string,
  filename: string,
) =>
  `/api/months/${month}/attachments/${baseName}/${encodeURIComponent(filename)}`;
