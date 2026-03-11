import type { Email, ProcessingEntry, Receipt } from './types';

export async function fetchEmails(): Promise<Email[]> {
  const res = await fetch('/api/emails');
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
