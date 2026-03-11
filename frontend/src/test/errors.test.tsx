import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { mockApi } from './helpers';

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
  it('shows error message when fetchEmails fails', async () => {
    mockApi.fetchEmails.mockRejectedValue(new Error('Network error'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
