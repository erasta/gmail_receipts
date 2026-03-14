import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { EmailStatus } from './email-status';

const PAGE_SIZE = 20;

export function useEmailStore({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailsTotal, setEmailsTotal] = useState(0);
  const [emailsHasMore, setEmailsHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [processing, setProcessing] = useState<Record<string, ProcessingEntry>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [activeClassifier, setActiveClassifier] = useState<string>('mock');
  const [autoClassify, setAutoClassify] = useState(true);
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

  const dateParams = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };

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

  // Initial load
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

  // Reload when date filters change
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

  // Auto-classify toggle
  useEffect(() => {
    if (!autoClassify || emails.length === 0) return;
    const unclassifiedIds = emails
      .filter(e => !submitted.has(e.id) && !(e.id in processing))
      .map(e => e.id);
    if (unclassifiedIds.length > 0) {
      submitClassification(unclassifiedIds, false);
    }
  }, [autoClassify]); // eslint-disable-line react-hooks/exhaustive-deps

  const processingCount = Object.keys(processing).length;
  const activeReceiptCount = [...receiptIds].filter((id) => !(id in processing)).length;
  const classifiedNonReceipts = [...submitted].filter(
    (id) => !(id in processing) && !receiptIds.has(id),
  ).length;

  return {
    emails,
    emailsTotal,
    emailsHasMore,
    loadingMore,
    loading,
    error,
    activeClassifier,
    autoClassify,
    setAutoClassify,
    receiptIds,
    receiptByEmailId,
    processingCount,
    activeReceiptCount,
    classifiedNonReceipts,
    getEmailStatus,
    loadMoreEmails,
    handleClearAll,
    handleClassifyAll,
    handleClassifierChange,
    submitClassification,
  };
}
