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

describe('Error handling', () => {
  it('shows error when initial load fails', async () => {
    mockApi.fetchEmails.mockRejectedValue(new Error('Network error'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows error when classify all fails', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    mockApi.classifyEmails.mockRejectedValue(new Error('Classification timed out'));
    const classifyButton = screen.getByRole('button', { name: /classify all/i });
    await userEvent.setup().click(classifyButton);
    await waitFor(() => {
      expect(screen.getByText('Classification timed out')).toBeInTheDocument();
    });
  });

  it('shows error when re-classify single email fails', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    mockApi.classifyEmails.mockRejectedValue(new Error('Request timeout'));
    const row = screen.getByText(EMAILS[0].subject).closest('tr')!;
    const refreshIcon = within(row).getByTestId('RefreshIcon');
    await userEvent.setup().click(refreshIcon);
    await waitFor(() => {
      expect(screen.getByText('Request timeout')).toBeInTheDocument();
    });
  });

  it('shows error when clear all fails', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    mockApi.clearClassifications.mockRejectedValue(new Error('Server unavailable'));
    const resetButton = screen.getByRole('button', { name: /reset all/i });
    await userEvent.setup().click(resetButton);
    await waitFor(() => {
      expect(screen.getByText('Server unavailable')).toBeInTheDocument();
    });
  });

  it('shows error when switching classifier fails', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    mockApi.setClassifier.mockRejectedValue(new Error('Ollama not responding'));
    await userEvent.setup().click(screen.getByText('Ollama'));
    await waitFor(() => {
      expect(screen.getByText('Ollama not responding')).toBeInTheDocument();
    });
  });
});
