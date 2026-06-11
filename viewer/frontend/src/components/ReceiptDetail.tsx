import { Box, Button, Chip, Divider, Link, Stack, Typography } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import html2pdf from "html2pdf.js";
import { attachmentUrl, type Receipt } from "../api";
import { isImage, isPdf } from "../constants";

// A small header block (from / date / subject) above the email's own HTML,
// built as one string so html2pdf renders it in its own off-screen container —
// no need to reach into the body iframe to capture it.
const pdfDocument = (receipt: Receipt) => {
  const row = (label: string, value: string | null | undefined) =>
    value
      ? `<tr><td style="color:#666;padding:2px 8px;white-space:nowrap">${label}</td>` +
        `<td dir="auto" style="padding:2px 8px">${value}</td></tr>`
      : "";
  return `<div style="font-family:Arial,sans-serif;color:#111" dir="auto">
    <table style="border-collapse:collapse;margin-bottom:12px;font-size:13px">
      ${row("From", receipt.from)}${row("To", receipt.to)}
      ${row("Date", receipt.date)}${row("Subject", receipt.subject)}
    </table>
    <hr style="border:none;border-top:1px solid #ccc;margin:12px 0">
    ${receipt.body}
  </div>`;
};

export const ReceiptDetail = ({
  month,
  receipt,
}: {
  month: string,
  receipt: Receipt,
}) => {
  const c = receipt.classification;

  const downloadPdf = () => {
    html2pdf()
      .set({
        filename: `${receipt.base_name}.pdf`,
        margin: 10,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4" },
      })
      .from(pdfDocument(receipt))
      .save();
  };
  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 1, alignItems: "flex-start", justifyContent: "space-between" }}
      >
        <Typography variant="h5">
          {receipt.subject || "(no subject)"}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          onClick={downloadPdf}
          sx={{ flexShrink: 0 }}
        >
          PDF
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: 2,
          rowGap: 0.5,
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">From</Typography>
        <Typography variant="body2">{receipt.from}</Typography>
        {(
          [
            ["To", receipt.to],
            ["Cc", receipt.cc],
            ["Reply-To", receipt.reply_to],
            ["Sender", receipt.sender],
            ["Bcc", receipt.bcc],
            ["Return-Path", receipt.return_path],
            ["Delivered-To", receipt.delivered_to],
            ["In-Reply-To", receipt.in_reply_to],
            ["References", receipt.references],
            ["List-Unsubscribe", receipt.list_unsubscribe],
            ["List-Id", receipt.list_id],
          ] as const
        )
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <Box key={label} sx={{ display: "contents" }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                {value}
              </Typography>
            </Box>
          ))}
        <Typography variant="body2" color="text.secondary">Date</Typography>
        <Typography variant="body2">{receipt.date}</Typography>
        <Typography variant="body2" color="text.secondary">UID</Typography>
        <Typography variant="body2">{receipt.uid}</Typography>
      </Box>

      {c && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "center" }}>
          <Chip
            size="small"
            label={`confidence ${(c.confidence * 100).toFixed(0)}%`}
          />
          <Typography variant="body2" color="text.secondary">
            {c.reason}
          </Typography>
        </Stack>
      )}

      {receipt.labels && receipt.labels.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: "wrap", gap: 1 }}>
          {receipt.labels.map((label) => (
            <Chip key={label} size="small" variant="outlined" label={label} />
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" gutterBottom>
        Body
      </Typography>
      <Box
        component="iframe"
        srcDoc={receipt.body}
        title="email body"
        sandbox="allow-same-origin"
        onLoad={(e) => {
          const f = e.currentTarget as HTMLIFrameElement;
          const doc = f.contentWindow?.document;
          if (doc) {
            f.style.height = `${doc.documentElement.scrollHeight}px`;
          }
        }}
        sx={{
          width: "100%",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      />

      {receipt.attachments.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Attachments
          </Typography>
          {receipt.attachments.map((filename) => {
            const url = attachmentUrl(month, receipt.base_name, filename);
            return (
              <Box key={filename} sx={{ my: 1.5 }}>
                <Link href={url} target="_blank" rel="noreferrer">
                  {filename}
                </Link>
                {isImage(filename) && (
                  <Box
                    component="img"
                    src={url}
                    alt={filename}
                    sx={{ display: "block", mt: 1, maxWidth: "100%" }}
                  />
                )}
                {isPdf(filename) && (
                  <Box
                    component="iframe"
                    src={url}
                    title={filename}
                    sx={{
                      display: "block",
                      mt: 1,
                      width: "100%",
                      height: 600,
                      border: 1,
                      borderColor: "divider",
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
