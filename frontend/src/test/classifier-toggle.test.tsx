import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('Classifier toggle', () => {
  it('shows mock as default classifier', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Mock')).toBeInTheDocument();
    });
  });

  it('calls setClassifier when switching to ollama', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    await user.click(screen.getByText('Ollama'));
    expect(mockApi.setClassifier).toHaveBeenCalledWith('ollama');
  });

  it('clears receipts after switching classifier', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    });
    await user.click(screen.getByText('Ollama'));
    await waitFor(() => {
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });
  });
});
