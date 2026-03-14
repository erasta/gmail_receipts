import { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { EmailStatus } from './email-status';
import { formatDate, formatFrom } from './email-status';
import { StatusChip } from './StatusChip';
import type { Email, Receipt } from './types';

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

export function EmailTableRow({
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
