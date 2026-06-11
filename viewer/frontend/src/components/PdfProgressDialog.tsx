import {
  Box,
  Dialog,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { formatMb, type ExportProgress } from "../pdfExport";

// Live progress while a PDF is being built: which email, its attachment count,
// and the bytes collected so far.
export const PdfProgressDialog = ({
  open,
  progress,
}: {
  open: boolean,
  progress: ExportProgress | null,
}) => {
  return (
    <Dialog open={open}>
      <Box sx={{ p: 3, minWidth: 380 }}>
        <Typography variant="h6" gutterBottom>
          Building PDF…
        </Typography>
        <LinearProgress
          variant={progress ? "determinate" : "indeterminate"}
          value={progress ? (progress.index / progress.total) * 100 : undefined}
          sx={{ mb: 2 }}
        />
        {progress && (
          <Stack spacing={0.5}>
            <Typography variant="body2">
              Email {progress.index} of {progress.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progress.month} / {progress.baseName}
            </Typography>
            <Typography variant="body2">
              {progress.attachments} attachment
              {progress.attachments === 1 ? "" : "s"}
            </Typography>
            <Typography variant="body2">
              {formatMb(progress.bytes)} MB collected
            </Typography>
          </Stack>
        )}
      </Box>
    </Dialog>
  );
};
