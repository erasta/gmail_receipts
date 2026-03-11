import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Alert,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  classifyEmails,
  clearClassifications,
  fetchClassifications,
  fetchClassifier,
  fetchEmails,
  fetchReceipts,
  setClassifier,
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

const STATUS_TOOLTIP: Record<EmailStatus, string> = {
  unclassified: 'Not yet classified',
  pending: 'Waiting in queue',
  classifying: 'Classification in progress',
  receipt: 'Classified as a receipt',
  not_receipt: 'Classified as not a receipt',
  error: 'Classification failed',
};

function StatusChip({
  status,
  reason,
}: {
  status: EmailStatus;
  reason?: string;
}) {
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
  const tooltip = reason
    ? `${STATUS_TOOLTIP[status]} — ${reason}`
    : STATUS_TOOLTIP[status];
  return (
    <Tooltip title={tooltip}>
      <Chip label={label} color={color} variant={variant} size="small" sx={{ maxWidth: 'none' }} />
    </Tooltip>
  );
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
    { label: 'Total Emails', value: totalEmails, color: '#1a237e', tooltip: 'Total number of emails loaded' },
    { label: 'Receipts', value: totalReceipts, color: '#2e7d32', tooltip: 'Emails classified as receipts' },
    { label: 'Non-Receipts', value: totalNonReceipts, color: '#757575', tooltip: 'Emails classified as non-receipts' },
  ];
  if (classifying > 0) {
    cards.push({ label: 'Classifying', value: classifying, color: '#1565c0', tooltip: 'Emails currently being classified' });
  }
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
      {cards.map((c) => (
        <Tooltip key={c.label} title={c.tooltip}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ py: 0.75, px: 1.5, '&:last-child': { pb: 0.75 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {c.label}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: c.color }}>
                {c.value}
              </Typography>
            </CardContent>
          </Card>
        </Tooltip>
      ))}
    </Box>
  );
}

function MetadataRow({
  email,
  receipt,
}: {
  email: Email;
  receipt: Receipt | undefined;
}) {
  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ py: 0, px: 0 }}>
        <Collapse in>
          <Box sx={{ px: 2, py: 1, bgcolor: '#f5f6fa', borderBottom: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', gap: 2.5, fontSize: '0.82rem', color: 'text.secondary', flexWrap: 'wrap' }}>
              <span><strong>From:</strong> {email.from_address}</span>
              <span><strong>To:</strong> {email.to_address}</span>
              <span><strong>Date:</strong> {email.date}</span>
              {receipt?.vendor && <span><strong>Vendor:</strong> {receipt.vendor}</span>}
              {receipt?.amount && <span><strong>Amount:</strong> {receipt.currency ?? ''}{receipt.amount}</span>}
            </Box>
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
}

function ContentRow({
  email,
  receipt,
  status,
  errorMsg,
}: {
  email: Email;
  receipt: Receipt | undefined;
  status: EmailStatus;
  errorMsg?: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ py: 0, px: 0 }}>
        <Collapse in>
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#fafbff', borderBottom: '2px solid #e8eaf6' }}>
            {receipt?.classification?.reason && (
              <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ mb: 0.75 }}>
                <strong>Reason:</strong> {receipt.classification.reason}
              </Typography>
            )}
            {receipt?.classification?.raw_response && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  mb: 0.75,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  bgcolor: '#f5f5f5',
                  color: '#555',
                }}
              >
                <strong>LLM output:</strong> {receipt.classification.raw_response}
              </Paper>
            )}
            {status === 'error' && errorMsg && (
              <Typography variant="body2" color="error" fontStyle="italic" sx={{ mb: 0.75 }}>
                {errorMsg}
              </Typography>
            )}

            {email.attachments.length > 0 && (
              <Box sx={{ mb: 0.75, fontSize: '0.8rem', color: 'text.secondary' }}>
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
                fontSize: '0.82rem',
                lineHeight: 1.5,
                color: '#444',
                maxHeight: 250,
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
  const [activeClassifier, setActiveClassifier] = useState<string>('mock');
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
    try {
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Classification request failed',
      );
    }
  }, [startPolling]);

  const handleClearAll = useCallback(async () => {
    try {
      stopPolling();
      await clearClassifications();
      setReceipts([]);
      setProcessing({});
      setSubmitted(new Set());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to clear classifications',
      );
    }
  }, [stopPolling]);

  const handleClassifyAll = useCallback(async () => {
    const ids = emails.map((e) => e.id);
    if (ids.length > 0) {
      await submitClassification(ids, false);
    }
  }, [emails, submitClassification]);

  const handleClassifierChange = useCallback(async (
    _: React.MouseEvent<HTMLElement>,
    value: string | null,
  ) => {
    if (!value || value === activeClassifier) return;
    try {
      stopPolling();
      const result = await setClassifier(value);
      setActiveClassifier(result.classifier);
      if (result.changed) {
        setReceipts([]);
        setProcessing({});
        setSubmitted(new Set());
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to switch classifier',
      );
    }
  }, [activeClassifier, stopPolling]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [emailsData, receiptsData, classifier] = await Promise.all([
          fetchEmails(),
          fetchReceipts(),
          fetchClassifier(),
        ]);
        setEmails(emailsData);
        setReceipts(receiptsData);
        setActiveClassifier(classifier);
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
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Gmail Receipt Manager
            </Typography>
          </Box>
          <Tooltip title="Choose classification engine">
            <ToggleButtonGroup
              value={activeClassifier}
              exclusive
              onChange={handleClassifierChange}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                '& .MuiToggleButton-root': {
                  color: 'rgba(255,255,255,0.7)',
                  borderColor: 'rgba(255,255,255,0.3)',
                  textTransform: 'none',
                  px: 1.5,
                  py: 0.25,
                  fontSize: '0.8rem',
                  '&.Mui-selected': {
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.25)',
                  },
                },
              }}
            >
              <ToggleButton value="mock">Mock</ToggleButton>
              <ToggleButton value="ollama">Ollama</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
          <Tooltip title="Reset all classifications">
            <IconButton
              onClick={handleClearAll}
              sx={{ ml: 1, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
              size="small"
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Classify all emails">
            <IconButton
              onClick={handleClassifyAll}
              sx={{ ml: 0.5, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
              size="small"
            >
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ pt: 1, pb: 0, flexShrink: 0 }}>
        <StatsBar
          totalEmails={emails.length}
          totalReceipts={activeReceiptCount}
          totalNonReceipts={classifiedNonReceipts}
          classifying={processingCount}
        />
        {error && (
          <Alert severity="error" sx={{ mb: 0.5, py: 0 }}>
            {error}
          </Alert>
        )}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40 } }}
        >
          <Tab label="All Emails" value="all" />
          <Tab label="Receipts Only" value="receipts" />
        </Tabs>
      </Container>

      <Container maxWidth="lg" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', pb: 0 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
              Loading emails...
            </Typography>
          </Box>
        ) : displayedEmails.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {activeTab === 'receipts' ? 'No receipts found.' : 'No emails found.'}
            </Typography>
          </Box>
        ) : (
          <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Table sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 110 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 190 }}>From</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                  <TableCell sx={{ width: 36 }} />
                  <Tooltip title="Is this email a receipt?">
                    <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>Receipt?</TableCell>
                  </Tooltip>
                  <Tooltip title="Classification confidence">
                    <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 55 }}>Conf.</TableCell>
                  </Tooltip>
                  <TableCell sx={{ width: 44 }} />
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
                        contentOpen={isExpanded}
                        status={status}
                        errorMsg={errorMsg}
                        receipt={receiptByEmailId.get(email.id)}
                        onToggleContent={() =>
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
  contentOpen,
  status,
  errorMsg,
  receipt,
  onToggleContent,
  onReclassify,
}: {
  email: Email;
  contentOpen: boolean;
  status: EmailStatus;
  errorMsg?: string;
  receipt: Receipt | undefined;
  onToggleContent: () => void;
  onReclassify: () => void;
}) {
  const [metaOpen, setMetaOpen] = useState(false);
  const confidence = receipt?.classification?.confidence;
  const reason = receipt?.classification?.reason;
  const highlighted = contentOpen || metaOpen;
  return (
    <>
      <TableRow
        hover
        onClick={onToggleContent}
        sx={{
          cursor: 'pointer',
          bgcolor: highlighted ? '#f0f2ff' : undefined,
        }}
      >
        <TableCell sx={{ whiteSpace: 'nowrap', width: 110, color: 'text.secondary' }}>
          {formatDate(email.date)}
        </TableCell>
        <Tooltip title={email.from_address}>
          <TableCell
            sx={{ width: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {formatFrom(email.from_address)}
          </TableCell>
        </Tooltip>
        <Tooltip title={email.subject}>
          <TableCell
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {email.subject}
          </TableCell>
        </Tooltip>
        <TableCell sx={{ width: 36, px: 0.5 }}>
          <Tooltip title={metaOpen ? 'Hide metadata' : 'Show metadata (from, to, date)'}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMetaOpen((prev) => !prev);
              }}
              sx={{ p: 0.25 }}
            >
              <ExpandMoreIcon
                sx={{
                  fontSize: '1.2rem',
                  color: 'text.secondary',
                  transition: 'transform 0.2s',
                  transform: metaOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </IconButton>
          </Tooltip>
        </TableCell>
        <TableCell sx={{ width: 100, textAlign: 'center', overflow: 'visible' }}>
          <StatusChip status={status} reason={reason} />
        </TableCell>
        <TableCell sx={{ width: 55, textAlign: 'center' }}>
          {confidence != null && (
            <Tooltip title={reason
              ? `${(confidence * 100).toFixed(0)}% confidence — ${reason}`
              : `Classification confidence: ${(confidence * 100).toFixed(0)}%`
            }>
              <Typography variant="body2" component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                {(confidence * 100).toFixed(0)}%
              </Typography>
            </Tooltip>
          )}
        </TableCell>
        <TableCell sx={{ width: 44, px: 0.5 }}>
          <Tooltip title="Re-classify this email">
            <span>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onReclassify();
                }}
                disabled={status === 'pending' || status === 'classifying'}
                sx={{ p: 0.5 }}
              >
                <RefreshIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </span>
          </Tooltip>
        </TableCell>
      </TableRow>
      {metaOpen && (
        <MetadataRow email={email} receipt={receipt} />
      )}
      {contentOpen && (
        <ContentRow
          email={email}
          receipt={receipt}
          status={status}
          errorMsg={errorMsg}
        />
      )}
    </>
  );
}

export default App;
