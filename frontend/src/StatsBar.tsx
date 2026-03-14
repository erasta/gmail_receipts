import {
  Box,
  Card,
  CardContent,
  Tooltip,
  Typography,
} from '@mui/material';

export function StatsBar({
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
