export type TabValue = 'all' | 'receipts';

export type EmailStatus =
  | 'unclassified'
  | 'pending'
  | 'classifying'
  | 'receipt'
  | 'not_receipt'
  | 'error';

export const STATUS_TOOLTIP: Record<EmailStatus, string> = {
  unclassified: 'Not yet classified',
  pending: 'Waiting in queue',
  classifying: 'Classification in progress',
  receipt: 'Classified as a receipt',
  not_receipt: 'Classified as not a receipt',
  error: 'Classification failed',
};

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from;
}
