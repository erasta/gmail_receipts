import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  classifyEmails,
  fetchClassifications,
  fetchEmails,
  fetchReceipts,
} from './api';
import type { Email, ProcessingEntry, Receipt } from './types';

type TabValue = 'all' | 'receipts';

type EmailStatus =
  | 'unclassified'
  | 'pending'
  | 'classifying'
  | 'receipt'
  | 'not_receipt'
  | 'error';

function formatDate(dateStr: string): string {
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

function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from;
}

function StatusChip({ status }: { status: EmailStatus }) {
  const config: Record<EmailStatus, {
    label: string;
    color: 'success' | 'default' | 'warning' | 'info' | 'error';
    variant: 'filled' | 'outlined';
  }> = {
    unclassified: { label: '\u2014', color: 'default', variant: 'outlined' },
    pending: { label: 'Pending', color: 'warning', variant: 'outlined' },
    classifying: { label: 'Classifying', color: 'info', variant: 'filled' },
    receipt: { label: 'Yes', color: 'success', variant: 'filled' },
    not_receipt: { label: 'No', color: 'default', variant: 'filled' },
    error: { label: 'Error', color: 'error', variant: 'filled' },
  };
  const { label, color, variant } = config[status];
  return <Chip label={label} color={color} variant={variant} size="small" />;
}

function StatsBar({
  totalEmails,
  totalReceipts,
  totalNonReceipts,
  classifying,
}: {
  totalEmails: number;
  totalReceipts: number;
  totalNonReceipts: number;
  classifying: number;
}) {
  const cards = [
    { label: 'Total Emails', value: totalEmails, color: '#1a237e' },
    { label: 'Receipts', value: totalReceipts, color: '#2e7d32' },
    { label: 'Non-Receipts', value: totalNonReceipts, color: '#757575' },
  ];
  if (classifying > 0) {
    cards.push({ label: 'Classifying', value: classifying, color: '#1565c0' });
  }
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
      {cards.map((c) => (
        <Card key={c.label} sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {c.label}
            </Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: c.color }}>
              {c.value}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function EmailExpandedRow({
  email,
  receipt,
  status,
  errorMsg,
  onReclassify,
}: {
  email: Email;
  receipt: Receipt | undefined;
  status: EmailStatus;
  errorMsg?: string;
  onReclassify: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={4} sx={{ py: 0 }}>
        <Collapse in>
          <Box sx={{ p: 2, bgcolor: '#fafbff', borderBottom: '2px solid #e8eaf6' }}>
            <Box sx={{ display: 'flex', gap: 3, mb: 1.5, fontSize: '0.82rem', color: 'text.secondary' }}>
              <span><strong>From:</strong> {email.from_address}</span>
              <span><strong>To:</strong> {email.to_address}</span>
              <span><strong>Date:</strong> {email.date}</span>
            </Box>

            <Paper variant="outlined" sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1, mb: 1.5 }}>
              <StatusChip status={status} />
              {receipt?.classification && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Confidence: {(receipt.classification.confidence * 100).toFixed(0)}%
                  </Typography>
                  {receipt.vendor && (
                    <Typography variant="body2">
                      <strong>Vendor:</strong> {receipt.vendor}
                    </Typography>
                  )}
                  {receipt.amount && (
                    <Typography variant="body2">
                      <strong>Amount:</strong> {receipt.currency ?? ''}{receipt.amount}
                    </Typography>
                  )}
                  {receipt.classification.reason && (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                      {receipt.classification.reason}
                    </Typography>
                  )}
                </>
              )}
              {status === 'error' && errorMsg && (
                <Typography variant="body2" color="error" fontStyle="italic">
                  {errorMsg}
                </Typography>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onReclassify();
                }}
                disabled={status === 'pending' || status === 'classifying'}
                sx={{ ml: 'auto' }}
              >
                Re-classify
              </Button>
            </Paper>

            {email.attachments.length > 0 && (
              <Box sx={{ mb: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
                <strong>Attachments: </strong>
                {email.attachments.map((a, i) => (
                  <Chip key={i} label={a} size="small" sx={{ mr: 0.5 }} />
                ))}
              </Box>
            )}

            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                color: '#444',
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {email.body_text || '(no text content)'}
            </Paper>
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
}

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [processing, setProcessing] = useState<Record<string, ProcessingEntry>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const receiptIds = new Set(
    receipts
      .filter((r) => r.classification?.is_receipt)
      .map((r) => r.email_id),
  );

  const receiptByEmailId = new Map(
    receipts.map((r) => [r.email_id, r]),
  );

  function getEmailStatus(emailId: string): { status: EmailStatus; error?: string } {
    const proc = processing[emailId];
    if (proc) {
      if (proc.status === 'error') return { status: 'error', error: proc.error };
      return { status: proc.status };
    }
    if (receiptIds.has(emailId)) return { status: 'receipt' };
    if (submitted.has(emailId)) return { status: 'not_receipt' };
    return { status: 'unclassified' };
  }

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const [proc, rcpts] = await Promise.all([
          fetchClassifications(),
          fetchReceipts(),
        ]);
        setProcessing(proc);
        setReceipts(rcpts);
        setSubmitted((prev) => {
          const next = new Set(prev);
          for (const id of Object.keys(prev)) {
            if (!(id in proc)) next.add(id);
          }
          return next;
        });
        if (Object.keys(proc).length === 0) {
          stopPolling();
        }
      } catch {
        // Don't crash the poll loop
      }
    }, 1500);
  }, [stopPolling]);

  const submitClassification = useCallback(async (
    ids: string[],
    force: boolean = false,
  ) => {
    const report = await classifyEmails(ids, force);
    setSubmitted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    const newProcessing: Record<string, ProcessingEntry> = {};
    for (const [id, status] of Object.entries(report)) {
      if (status === 'queued' || status === 'already_processing') {
        newProcessing[id] = { status: 'pending' };
      }
    }
    if (Object.keys(newProcessing).length > 0) {
      setProcessing((prev) => ({ ...prev, ...newProcessing }));
      startPolling();
    }
  }, [startPolling]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const emailsData = await fetchEmails();
        setEmails(emailsData);
        const receiptsData = await fetchReceipts();
        setReceipts(receiptsData);
        const ids = emailsData.map((e) => e.id);
        await submitClassification(ids, false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load data. Is the backend running?',
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
    return () => stopPolling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const processingCount = Object.keys(processing).length;
  const activeReceiptCount = [...receiptIds].filter((id) => !(id in processing)).length;
  const classifiedNonReceipts = [...submitted].filter(
    (id) => !(id in processing) && !receiptIds.has(id),
  ).length;

  const displayedEmails =
    activeTab === 'receipts'
      ? emails.filter((e) => receiptIds.has(e.id))
      : emails;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      <AppBar position="static">
        <Toolbar>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Gmail Receipt Manager
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              View and classify email receipts
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ pt: 1.5, pb: 0, flexShrink: 0 }}>
        <StatsBar
          totalEmails={emails.length}
          totalReceipts={activeReceiptCount}
          totalNonReceipts={classifiedNonReceipts}
          classifying={processingCount}
        />
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
        >
          <Tab label="All Emails" value="all" />
          <Tab label="Receipts Only" value="receipts" />
        </Tabs>
      </Container>

      <Container maxWidth="lg" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', pb: 0 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              Loading emails...
            </Typography>
          </Box>
        ) : displayedEmails.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              {activeTab === 'receipts' ? 'No receipts found.' : 'No emails found.'}
            </Typography>
          </Box>
        ) : (
          <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Table sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 140 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 220 }}>From</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 110 }}>Receipt?</TableCell>
                </TableRow>
              </TableHead>
            </Table>
            <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
              <Table sx={{ tableLayout: 'fixed' }}>
                <TableBody>
                  {displayedEmails.map((email) => {
                    const isExpanded = expandedId === email.id;
                    const { status, error: errorMsg } = getEmailStatus(email.id);
                    return (
                      <EmailTableRow
                        key={email.id}
                        email={email}
                        isExpanded={isExpanded}
                        status={status}
                        errorMsg={errorMsg}
                        receipt={receiptByEmailId.get(email.id)}
                        onToggle={() =>
                          setExpandedId((prev) => (prev === email.id ? null : email.id))
                        }
                        onReclassify={() => submitClassification([email.id], true)}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Container>
    </Box>
  );
}

function EmailTableRow({
  email,
  isExpanded,
  status,
  errorMsg,
  receipt,
  onToggle,
  onReclassify,
}: {
  email: Email;
  isExpanded: boolean;
  status: EmailStatus;
  errorMsg?: string;
  receipt: Receipt | undefined;
  onToggle: () => void;
  onReclassify: () => void;
}) {
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{
          cursor: 'pointer',
          bgcolor: isExpanded ? '#f0f2ff' : undefined,
        }}
      >
        <TableCell sx={{ whiteSpace: 'nowrap', width: 140, color: 'text.secondary' }}>
          {formatDate(email.date)}
        </TableCell>
        <TableCell
          sx={{ width: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={email.from_address}
        >
          {formatFrom(email.from_address)}
        </TableCell>
        <TableCell
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={email.subject}
        >
          {email.subject}
        </TableCell>
        <TableCell sx={{ width: 110, textAlign: 'center' }}>
          <StatusChip status={status} />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <EmailExpandedRow
          email={email}
          receipt={receipt}
          status={status}
          errorMsg={errorMsg}
          onReclassify={onReclassify}
        />
      )}
    </>
  );
}

export default App;
