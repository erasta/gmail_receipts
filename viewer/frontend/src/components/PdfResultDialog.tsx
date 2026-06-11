import { Box, Button, Dialog, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

// The finished PDF (preview + download + summary), or a "too large" message.
export type PdfResult =
  | { kind: "ready", url: string, summary: string, downloadName: string }
  | { kind: "tooBig", mb: number };

export const PdfResultDialog = ({
  result,
  onClose,
}: {
  result: PdfResult | null,
  onClose: () => void,
}) => {
  return (
    <Dialog open={result !== null} onClose={onClose} fullWidth maxWidth="lg">
      {result?.kind === "tooBig" && (
        <Box sx={{ p: 3 }}>
          <Typography>
            The PDF is over {result.mb} MB — too large to preview. Narrow the set
            and try again.
          </Typography>
        </Box>
      )}
      {result?.kind === "ready" && (
        <>
          <Stack direction="row" spacing={2} sx={{ p: 1, alignItems: "center" }}>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              component="a"
              href={result.url}
              download={result.downloadName}
            >
              Download
            </Button>
            <Typography variant="body2" color="text.secondary">
              {result.summary}
            </Typography>
          </Stack>
          <Box
            component="iframe"
            src={result.url}
            title="receipts pdf"
            sx={{ width: "100%", height: "80vh", border: 0 }}
          />
        </>
      )}
    </Dialog>
  );
};
