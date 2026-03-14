import { Chip, Tooltip } from '@mui/material';
import type { EmailStatus } from './email-status';
import { STATUS_TOOLTIP } from './email-status';

export function StatusChip({
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
