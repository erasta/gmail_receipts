import { useState } from "react";
import { Box, Button, Dialog, Typography } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { MarkKind, type Marks } from "../api";
import { buildMarkedPdf } from "../pdfExport";

// Once the merged PDF passes this, it's too heavy to preview in an iframe, so
// the build stops there and we show a message instead.
const PREVIEW_LIMIT = 50 * 1024 * 1024; // 50 MB

export const ExportMarked = ({ marks }: { marks: Marks }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { kind: "ready", url: string } | { kind: "tooBig", mb: number } | null
  >(null);

  const targets = Object.entries(marks).flatMap(([month, items]) =>
    Object.entries(items)
      .filter(([, kind]) => kind === MarkKind.Export)
      .map(([baseName]) => ({ month, baseName })),
  );

  const close = () => {
    if (result?.kind === "ready") URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const exportMarked = async () => {
    setBusy(true);
    const out = await buildMarkedPdf(targets, PREVIEW_LIMIT);
    setBusy(false);
    setResult(
      out.tooBig
        ? { kind: "tooBig", mb: out.mb }
        : { kind: "ready", url: URL.createObjectURL(out.blob) },
    );
  };

  return (
    <>
      <Button
        color="inherit"
        size="small"
        startIcon={<PictureAsPdfIcon />}
        disabled={busy || targets.length === 0}
        onClick={exportMarked}
      >
        {busy ? "Exporting…" : `Export marked (${targets.length})`}
      </Button>

      <Dialog open={result !== null} onClose={close} fullWidth maxWidth="lg">
        {result?.kind === "tooBig" && (
          <Box sx={{ p: 3 }}>
            <Typography>
              The marked receipts are over {result.mb} MB — too large to preview.
              Mark fewer, or narrow the set, and try again.
            </Typography>
          </Box>
        )}
        {result?.kind === "ready" && (
          <Box
            component="iframe"
            src={result.url}
            title="marked receipts pdf"
            sx={{ width: "100%", height: "85vh", border: 0 }}
          />
        )}
      </Dialog>
    </>
  );
};
