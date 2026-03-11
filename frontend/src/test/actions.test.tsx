import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { EMAILS, mockApi } from './helpers';

vi.mock('../api', () => ({
  fetchEmails: vi.fn(),
  fetchReceipts: vi.fn(),
  fetchClassifications: vi.fn(),
  fetchClassifier: vi.fn(),
  classifyEmails: vi.fn(),
  clearClassifications: vi.fn(),
  setClassifier: vi.fn(),
}));

describe('Clear all button', () => {
  it('calls clearClassifications when reset button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    const resetButton = screen.getByRole('button', { name: /reset all/i });
    await user.click(resetButton);
    expect(mockApi.clearClassifications).toHaveBeenCalled();
  });

  it('clears local state after reset', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    });
    const resetButton = screen.getByRole('button', { name: /reset all/i });
    await user.click(resetButton);
    await waitFor(() => {
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });
  });
});

describe('Classify all button', () => {
  it('calls classifyEmails with all email ids when clicked', async () => {
    const user = userEvent.setup();
    const allQueued = Object.fromEntries(EMAILS.map((e) => [e.id, 'queued']));
    mockApi.classifyEmails.mockResolvedValue(allQueued);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    mockApi.classifyEmails.mockClear();
    mockApi.classifyEmails.mockResolvedValue(allQueued);
    const classifyButton = screen.getByRole('button', { name: /classify all/i });
    await user.click(classifyButton);
    const allIds = EMAILS.map((e) => e.id);
    expect(mockApi.classifyEmails).toHaveBeenCalledWith(allIds, false);
  });
});

describe('Re-classify button', () => {
  it('calls classifyEmails with force for a single email', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    mockApi.classifyEmails.mockClear();
    mockApi.classifyEmails.mockResolvedValue({ [EMAILS[0].id]: 'queued' });
    const row = screen.getByText(EMAILS[0].subject).closest('tr')!;
    const refreshIcon = within(row).getByTestId('RefreshIcon');
    await user.click(refreshIcon);
    expect(mockApi.classifyEmails).toHaveBeenCalledWith([EMAILS[0].id], true);
  });
});
