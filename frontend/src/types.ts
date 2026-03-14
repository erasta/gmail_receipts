export interface Email {
  id: string;
  from_address: string;
  to_address: string;
  subject: string;
  date: string;
  body_text: string;
  body_html: string | null;
  attachments: string[];
}

export interface ClassificationResult {
  email_id: string;
  is_receipt: boolean;
  confidence: number;
  reason: string;
  raw_response: string | null;
}

export interface Receipt {
  email_id: string;
  from_address: string;
  subject: string;
  date: string;
  amount: string | null;
  currency: string | null;
  vendor: string | null;
  classification: ClassificationResult;
}

export interface PaginatedEmails {
  items: Email[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

export interface ProcessingEntry {
  status: 'pending' | 'classifying' | 'error';
  error?: string;
}
