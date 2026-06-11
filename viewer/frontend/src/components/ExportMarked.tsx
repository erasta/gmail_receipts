import { Button } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { MarkKind, type Marks } from "../api";
import { usePdfExport } from "../usePdfExport";

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
        onClick={() => start(targets, "marked-receipts.pdf")}
      >
        {busy ? "Exporting…" : `Export marked (${targets.length})`}
      </Button>
      {dialogs}
    </>
  );
};
