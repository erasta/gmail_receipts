import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { EMAILS, RECEIPTS } from './helpers';

vi.mock('../api', () => ({
  fetchEmails: vi.fn(),
  fetchReceipts: vi.fn(),
  fetchClassifications: vi.fn(),
  fetchClassifier: vi.fn(),
  classifyEmails: vi.fn(),
  clearClassifications: vi.fn(),
  setClassifier: vi.fn(),
}));

describe('Expand rows', () => {
  it('shows email body when row is clicked (content expand)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    await user.click(screen.getByText(EMAILS[0].subject));
    expect(screen.getByText((_, el) =>
      el?.textContent === EMAILS[0].body_text || false,
    )).toBeInTheDocument();
  });

  it('shows reason in content expand for receipts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(RECEIPTS[0].subject)).toBeInTheDocument();
    });
    await user.click(screen.getByText(RECEIPTS[0].subject));
    expect(screen.getByText(/Mock classifier/)).toBeInTheDocument();
  });

  it('shows metadata when chevron is clicked (independent of content)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    const row = screen.getByText(EMAILS[0].subject).closest('tr')!;
    const chevronButton = within(row).getAllByRole('button')[0];
    await user.click(chevronButton);
    expect(screen.getByText((_, el) =>
      el?.tagName === 'SPAN' && el?.textContent?.includes('user@gmail.com') || false,
    )).toBeInTheDocument();
  });

  it('chevron and content expand are independent', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    const row = screen.getByText(EMAILS[0].subject).closest('tr')!;
    const chevronButton = within(row).getAllByRole('button')[0];

    // Open metadata via chevron
    await user.click(chevronButton);
    expect(screen.getByText((_, el) =>
      el?.tagName === 'SPAN' && el?.textContent?.includes('user@gmail.com') || false,
    )).toBeInTheDocument();
    // Body should NOT be visible yet
    expect(screen.queryByText((_, el) =>
      el?.textContent === EMAILS[0].body_text || false,
    )).not.toBeInTheDocument();

    // Now click the subject to open content
    await user.click(screen.getByText(EMAILS[0].subject));
    // Both should be visible
    expect(screen.getByText((_, el) =>
      el?.tagName === 'SPAN' && el?.textContent?.includes('user@gmail.com') || false,
    )).toBeInTheDocument();
    expect(screen.getByText((_, el) =>
      el?.textContent === EMAILS[0].body_text || false,
    )).toBeInTheDocument();
  });
});
