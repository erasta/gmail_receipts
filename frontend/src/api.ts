import type { PaginatedEmails, ProcessingEntry, Receipt } from './types';

export async function fetchEmails({
  offset = 0,
  limit = 20,
  dateFrom,
  dateTo,
}: {
  offset?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<PaginatedEmails> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const res = await fetch(`/api/emails?${params}`);
  return res.json();
}

export async function fetchEmail(id: string): Promise<Email> {
  const res = await fetch(`/api/emails/${id}`);
  return res.json();
}

export async function fetchReceipts(): Promise<Receipt[]> {
  const res = await fetch('/api/receipts');
  return res.json();
}

export async function classifyEmails(
  emailIds: string[],
  force: boolean = false,
): Promise<Record<string, string>> {
  const res = await fetch('/api/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_ids: emailIds, force }),
  });
  return res.json();
}

export async function fetchClassifications(): Promise<Record<string, ProcessingEntry>> {
  const res = await fetch('/api/classifications');
  return res.json();
}

export async function fetchClassifier(): Promise<string> {
  const res = await fetch('/api/classifier');
  const data = await res.json();
  return data.classifier;
}

export async function clearClassifications(): Promise<void> {
  await fetch('/api/classifications', { method: 'DELETE' });
}

export async function setClassifier(
  classifier: string,
): Promise<{ classifier: string; changed: boolean }> {
  const res = await fetch('/api/classifier', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classifier }),
  });
  return res.json();
}
