import { vi, beforeEach } from 'vitest';
import type { Email, Receipt } from '../types';
import emailsJson from '../../../backend/mock_gmail/emails.json';

// ---- Derive test data from the shared emails.json ----

interface RawEntry {
  id: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  is_receipt: boolean;
}

const RAW: RawEntry[] = emailsJson as RawEntry[];

export const EMAILS: Email[] = RAW.map((e) => ({
  id: e.id,
  from_address: e.from,
  to_address: 'user@gmail.com',
  subject: e.subject,
  date: e.date,
  body_text: e.body,
  body_html: null,
  attachments: [],
}));

export const RECEIPTS: Receipt[] = RAW
  .filter((e) => e.is_receipt)
  .map((e) => ({
    email_id: e.id,
    from_address: e.from,
    subject: e.subject,
    date: e.date,
    amount: null,
    currency: null,
    vendor: null,
    classification: {
      email_id: e.id,
      is_receipt: true,
      confidence: 1.0,
      reason: 'Mock classifier: looked up from test data',
    },
  }));

export const RECEIPT_IDS = new Set(RECEIPTS.map((r) => r.email_id));
export const NON_RECEIPT_EMAILS = EMAILS.filter((e) => !RECEIPT_IDS.has(e.id));

// ---- Mock setup (call from each test file after vi.mock) ----

import * as api from '../api';

export const mockApi = vi.mocked(api);

export function setupDefaultMocks() {
  mockApi.fetchEmails.mockResolvedValue(EMAILS);
  mockApi.fetchReceipts.mockResolvedValue(RECEIPTS);
  mockApi.fetchClassifications.mockResolvedValue({});
  mockApi.fetchClassifier.mockResolvedValue('mock');
  mockApi.classifyEmails.mockResolvedValue(
    Object.fromEntries(EMAILS.map((e) => [e.id, 'cached'])),
  );
  mockApi.clearClassifications.mockResolvedValue(undefined);
  mockApi.setClassifier.mockResolvedValue({ classifier: 'ollama', changed: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});
