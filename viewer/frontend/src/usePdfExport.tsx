import { useState, type ReactNode } from "react";
import { buildMarkedPdf, formatMb, type ExportProgress } from "./pdfExport";
import { PdfProgressDialog } from "./components/PdfProgressDialog";
import { PdfResultDialog, type PdfResult } from "./components/PdfResultDialog";

// Once the merged PDF passes this, it's too heavy to preview in an iframe, so
// the build stops there and we show a message instead.
const PREVIEW_LIMIT = 50 * 1024 * 1024; // 50 MB

type Target = { month: string, baseName: string };

// Drives building one or many receipts into a single PDF: a live progress
// modal, then a preview with a Download button and a summary (or a "too large"
// message). The caller renders its own trigger and calls start().
export const usePdfExport = () => {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<PdfResult | null>(null);

  const start = async (targets: Target[], downloadName: string) => {
    setProgress(null);
    setBusy(true);
    const started = performance.now();
    const out = await buildMarkedPdf(targets, PREVIEW_LIMIT, setProgress);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    setBusy(false);
    if (out.tooBig) {
      setResult({ kind: "tooBig", mb: out.mb });
      return;
    }
    const summary =
      `${out.emails} emails · ${out.attachments} attachments · ` +
      `${formatMb(out.blob.size)} MB · ${seconds}s`;
    setResult({
      kind: "ready",
      url: URL.createObjectURL(out.blob),
      summary,
      downloadName,
    });
  };

  const close = () => {
    if (result?.kind === "ready") URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const dialogs: ReactNode = (
    <>
      <PdfProgressDialog open={busy} progress={progress} />
      <PdfResultDialog result={result} onClose={close} />
    </>
  );

  return { busy, start, dialogs };
};
