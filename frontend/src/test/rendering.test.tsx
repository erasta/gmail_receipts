import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { EMAILS } from './helpers';

vi.mock('../api', () => ({
  fetchEmails: vi.fn(),
  fetchReceipts: vi.fn(),
  fetchClassifications: vi.fn(),
  fetchClassifier: vi.fn(),
  classifyEmails: vi.fn(),
  clearClassifications: vi.fn(),
  setClassifier: vi.fn(),
}));

describe('App renders', () => {
  it('shows the app title', async () => {
    render(<App />);
    expect(screen.getByText('Gmail Receipt Manager')).toBeInTheDocument();
  });

  it('shows all emails after loading', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    for (const email of EMAILS) {
      expect(screen.getByText(email.subject)).toBeInTheDocument();
    }
  });

  it('shows stats bar with correct total', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(String(EMAILS.length))).toBeInTheDocument();
    });
  });
});
