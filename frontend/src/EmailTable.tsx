import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import type { EmailStatus } from './email-status';
import type { Email, Receipt } from './types';
import { EmailTableRow } from './EmailTableRow';

export function EmailTable({
  emails,
  hasMore,
  loadingMore,
  receiptByEmailId,
  getEmailStatus,
  onLoadMore,
  onReclassify,
}: {
  emails: Email[];
  hasMore: boolean;
  loadingMore: boolean;
  receiptByEmailId: Map<string, Receipt>;
  getEmailStatus: (id: string) => { status: EmailStatus; error?: string };
  onLoadMore: () => void;
  onReclassify: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;

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
  }, [hasMore, emails.length]);

  if (emails.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">No emails found.</Typography>
      </Box>
    );
  }

  return (
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
            {emails.map((email) => {
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
                  onReclassify={() => onReclassify(email.id)}
                />
              );
            })}
          </TableBody>
        </Table>
        {hasMore && (
          <Box ref={sentinelCallbackRef} sx={{ textAlign: 'center', py: 2 }}>
            {loadingMore && <CircularProgress size={24} />}
          </Box>
        )}
      </TableContainer>
    </Paper>
  );
}
