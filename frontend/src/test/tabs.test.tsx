import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { EMAILS, RECEIPTS, NON_RECEIPT_EMAILS } from './helpers';

vi.mock('../api', () => ({
  fetchEmails: vi.fn(),
  fetchReceipts: vi.fn(),
  fetchClassifications: vi.fn(),
  fetchClassifier: vi.fn(),
  classifyEmails: vi.fn(),
  clearClassifications: vi.fn(),
  setClassifier: vi.fn(),
}));

describe('Tabs', () => {
  it('filters to receipts only when Receipts tab is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    await user.click(screen.getByText('Receipts Only'));
    for (const r of RECEIPTS) {
      expect(screen.getByText(r.subject)).toBeInTheDocument();
    }
    for (const e of NON_RECEIPT_EMAILS) {
      expect(screen.queryByText(e.subject)).not.toBeInTheDocument();
    }
  });

  it('shows all emails again when All Emails tab is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    await user.click(screen.getByText('Receipts Only'));
    await user.click(screen.getByText('All Emails'));
    for (const e of EMAILS) {
      expect(screen.getByText(e.subject)).toBeInTheDocument();
    }
  });
});
