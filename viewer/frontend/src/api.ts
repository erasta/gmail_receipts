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

export const attachmentUrl = (
  month: string,
  baseName: string,
  filename: string,
) =>
  `/api/months/${month}/attachments/${baseName}/${encodeURIComponent(filename)}`;
