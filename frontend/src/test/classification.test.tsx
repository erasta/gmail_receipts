import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('Classification status', () => {
  it('shows Yes chips for receipts and No for non-receipts', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    const yesChips = screen.getAllByText('Yes');
    const noChips = screen.getAllByText('No');
    expect(yesChips.length).toBe(RECEIPTS.length);
    expect(noChips.length).toBe(NON_RECEIPT_EMAILS.length);
  });

  it('shows confidence percentage for receipts', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    const pcts = screen.getAllByText('100%');
    expect(pcts.length).toBe(RECEIPTS.length);
  });
});
