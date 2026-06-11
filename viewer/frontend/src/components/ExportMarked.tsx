import { Button } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { MarkKind, type Marks } from "../api";
import { usePdfExport } from "../usePdfExport";

// Name the file after the marked receipts' date span, read from their
// base_names (which start with "YYYY-MM-DD"). Collapses to one day when every
// receipt is from the same day.
const markedPdfName = (targets: { baseName: string }[]) => {
  if (targets.length === 0) return "receipts.pdf";
  const days = targets.map((t) => t.baseName.slice(0, 10)).sort();
  const min = days[0];
  const max = days[days.length - 1];
  return min === max ? `receipts-${min}.pdf` : `receipts-${min}_${max}.pdf`;
};

export const ExportMarked = ({ marks }: { marks: Marks }) => {
  const { busy, start, dialogs } = usePdfExport();

  const targets = Object.entries(marks).flatMap(([month, items]) =>
    Object.entries(items)
      .filter(([, kind]) => kind === MarkKind.Export)
      .map(([baseName]) => ({ month, baseName })),
  );

  return (
    <>
      <Button
        color="inherit"
        size="small"
        startIcon={<PictureAsPdfIcon />}
        disabled={busy || targets.length === 0}
        onClick={() => start(targets, markedPdfName(targets))}
      >
        {busy ? "Exporting…" : `Export marked (${targets.length})`}
      </Button>
      {dialogs}
    </>
  );
};
