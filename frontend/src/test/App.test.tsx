import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Email, Receipt } from '../types';
import emailsJson from '../../../backend/mock_gmail/emails.json';

// ---- Derive test data from the shared emails.json ----

interface RawEntry {
  id: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  is_receipt: boolean;
}

const RAW: RawEntry[] = emailsJson as RawEntry[];

const EMAILS: Email[] = RAW.map((e) => ({
  id: e.id,
  from_address: e.from,
  to_address: 'user@gmail.com',
  subject: e.subject,
  date: e.date,
  body_text: e.body,
  body_html: null,
  attachments: [],
}));

const RECEIPTS: Receipt[] = RAW
  .filter((e) => e.is_receipt)
  .map((e) => ({
    email_id: e.id,
    from_address: e.from,
    subject: e.subject,
    date: e.date,
    amount: null,
    currency: null,
    vendor: null,
    classification: {
      email_id: e.id,
      is_receipt: true,
      confidence: 1.0,
      reason: 'Mock classifier: looked up from test data',
    },
  }));

const RECEIPT_IDS = new Set(RECEIPTS.map((r) => r.email_id));
const NON_RECEIPT_EMAILS = EMAILS.filter((e) => !RECEIPT_IDS.has(e.id));

// ---- Mocks ----

vi.mock('../api', () => ({
  fetchEmails: vi.fn(),
  fetchReceipts: vi.fn(),
  fetchClassifications: vi.fn(),
  fetchClassifier: vi.fn(),
  classifyEmails: vi.fn(),
  clearClassifications: vi.fn(),
  setClassifier: vi.fn(),
}));

import * as api from '../api';

const mockApi = api as {
  fetchEmails: ReturnType<typeof vi.fn>;
  fetchReceipts: ReturnType<typeof vi.fn>;
  fetchClassifications: ReturnType<typeof vi.fn>;
  fetchClassifier: ReturnType<typeof vi.fn>;
  classifyEmails: ReturnType<typeof vi.fn>;
  clearClassifications: ReturnType<typeof vi.fn>;
  setClassifier: ReturnType<typeof vi.fn>;
};

function setupDefaultMocks() {
  mockApi.fetchEmails.mockResolvedValue(EMAILS);
  mockApi.fetchReceipts.mockResolvedValue(RECEIPTS);
  mockApi.fetchClassifications.mockResolvedValue({});
  mockApi.fetchClassifier.mockResolvedValue('mock');
  mockApi.classifyEmails.mockResolvedValue(
    Object.fromEntries(EMAILS.map((e) => [e.id, 'cached'])),
  );
  mockApi.clearClassifications.mockResolvedValue(undefined);
  mockApi.setClassifier.mockResolvedValue({ classifier: 'ollama', changed: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ---- Tests ----

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

describe('Expand rows', () => {
  it('shows email body when row is clicked (content expand)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(EMAILS[0].subject)).toBeInTheDocument();
    });
    await user.click(screen.getByText(EMAILS[0].subject));
    // The body is rendered in a Paper element; match the full body text
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
    // Metadata row shows To: field which only appears in expanded metadata
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

describe('Error handling', () => {
  it('shows error message when fetchEmails fails', async () => {
    mockApi.fetchEmails.mockRejectedValue(new Error('Network error'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
