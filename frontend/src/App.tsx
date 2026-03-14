import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Chip,
  CircularProgress,
  Container,
  Alert,
  IconButton,
  Paper,
  Table,
  TextField,
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
import type { EmailStatus, TabValue } from './email-status';
import { StatsBar } from './StatsBar';
import { EmailTableRow } from './EmailTableRow';

const PAGE_SIZE = 20;

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailsTotal, setEmailsTotal] = useState(0);
  const [emailsHasMore, setEmailsHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [processing, setProcessing] = useState<Record<string, ProcessingEntry>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeClassifier, setActiveClassifier] = useState<string>('mock');
  const [autoClassify, setAutoClassify] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => new URLSearchParams(window.location.search).get('from') ?? '');
  const [dateTo, setDateTo] = useState(() => new URLSearchParams(window.location.search).get('to') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const dateParams = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

  const loadMoreEmails = useCallback(async () => {
    if (loadingMore || !emailsHasMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchEmails({ offset: emails.length, limit: PAGE_SIZE, ...dateParams });
      setEmails(prev => [...prev, ...result.items]);
      setEmailsTotal(result.total);
      setEmailsHasMore(result.has_more);
      if (autoClassify) {
        const newIds = result.items.map(e => e.id);
        if (newIds.length > 0) {
          await submitClassification(newIds, false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more emails');
    } finally {
      setLoadingMore(false);
    }
  }, [emails.length, loadingMore, emailsHasMore, autoClassify, submitClassification, dateParams.dateFrom, dateParams.dateTo]);

  const handleClearAll = useCallback(async () => {
    try {
      stopPolling();
      setAutoClassify(false);
      await clearClassifications();
      setEmails([]);
      setEmailsTotal(0);
      setEmailsHasMore(true);
      setReceipts([]);
      setProcessing({});
      setSubmitted(new Set());
      const result = await fetchEmails({ offset: 0, limit: PAGE_SIZE, ...dateParams });
      setEmails(result.items);
      setEmailsTotal(result.total);
      setEmailsHasMore(result.has_more);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to clear classifications',
      );
    }
  }, [stopPolling, dateParams.dateFrom, dateParams.dateTo]);

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
        setAutoClassify(false);
        setEmails([]);
        setEmailsTotal(0);
        setEmailsHasMore(true);
        setReceipts([]);
        setProcessing({});
        setSubmitted(new Set());
        const res = await fetchEmails({ offset: 0, limit: PAGE_SIZE, ...dateParams });
        setEmails(res.items);
        setEmailsTotal(res.total);
        setEmailsHasMore(res.has_more);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to switch classifier',
      );
    }
  }, [activeClassifier, stopPolling, dateParams.dateFrom, dateParams.dateTo]);

  // Sync date filters to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (dateFrom) params.set('from', dateFrom); else params.delete('from');
    if (dateTo) params.set('to', dateTo); else params.delete('to');
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [emailsResult, receiptsData, classifier] = await Promise.all([
          fetchEmails({ offset: 0, limit: PAGE_SIZE, ...dateParams }),
          fetchReceipts(),
          fetchClassifier(),
        ]);
        setEmails(emailsResult.items);
        setEmailsTotal(emailsResult.total);
        setEmailsHasMore(emailsResult.has_more);
        setReceipts(receiptsData);
        setActiveClassifier(classifier);
        const ids = emailsResult.items.map((e) => e.id);
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

  // Reload emails when date filters change
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    async function reload() {
      setLoading(true);
      setError(null);
      try {
        setEmails([]);
        setEmailsTotal(0);
        setEmailsHasMore(true);
        const result = await fetchEmails({ offset: 0, limit: PAGE_SIZE, ...dateParams });
        setEmails(result.items);
        setEmailsTotal(result.total);
        setEmailsHasMore(result.has_more);
        if (autoClassify && result.items.length > 0) {
          await submitClassification(result.items.map(e => e.id), false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load emails');
      } finally {
        setLoading(false);
      }
    }
    reload();
  }, [dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoClassify || emails.length === 0) return;
    const unclassifiedIds = emails
      .filter(e => !submitted.has(e.id) && !(e.id in processing))
      .map(e => e.id);
    if (unclassifiedIds.length > 0) {
      submitClassification(unclassifiedIds, false);
    }
  }, [autoClassify]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreRef = useRef(loadMoreEmails);
  loadMoreRef.current = loadMoreEmails;

  const sentinelCallbackRef = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreRef.current();
        }
      },
      { root: container, rootMargin: '200px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [emailsHasMore, loading, emails.length]);

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
          <Tooltip title="Auto-classify emails as they load">
            <Chip
              label={autoClassify ? 'Auto: ON' : 'Auto: OFF'}
              onClick={() => setAutoClassify(prev => !prev)}
              size="small"
              sx={{
                ml: 1.5,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem',
                color: '#fff',
                bgcolor: autoClassify ? 'rgba(100,200,100,0.5)' : 'rgba(255,255,255,0.15)',
                border: '1px solid',
                borderColor: autoClassify ? 'rgba(100,255,100,0.5)' : 'rgba(255,255,255,0.3)',
                '&:hover': { bgcolor: autoClassify ? 'rgba(100,200,100,0.7)' : 'rgba(255,255,255,0.25)' },
              }}
            />
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
          totalEmails={emailsTotal}
          totalReceipts={activeReceiptCount}
          totalNonReceipts={classifiedNonReceipts}
          classifying={processingCount}
        />
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'center' }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 170 }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 170 }}
          />
          {(dateFrom || dateTo) && (
            <Chip
              label="Clear dates"
              size="small"
              onDelete={() => { setDateFrom(''); setDateTo(''); }}
              sx={{ ml: 0.5 }}
            />
          )}
        </Box>
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
            <TableContainer ref={scrollContainerRef} sx={{ flex: 1, overflowY: 'auto' }}>
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
              {emailsHasMore && (
                <Box ref={sentinelCallbackRef} sx={{ textAlign: 'center', py: 2 }}>
                  {loadingMore && <CircularProgress size={24} />}
                </Box>
              )}
            </TableContainer>
          </Paper>
        )}
      </Container>
    </Box>
  );
}

export default App;
