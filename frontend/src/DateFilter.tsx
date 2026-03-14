import { Box, Chip, TextField } from '@mui/material';

export function DateFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'center' }}>
      <TextField
        label="From"
        type="date"
        size="small"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ width: 170 }}
      />
      <TextField
        label="To"
        type="date"
        size="small"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ width: 170 }}
      />
      {(dateFrom || dateTo) && (
        <Chip
          label="Clear dates"
          size="small"
          onDelete={onClear}
          sx={{ ml: 0.5 }}
        />
      )}
    </Box>
  );
}
