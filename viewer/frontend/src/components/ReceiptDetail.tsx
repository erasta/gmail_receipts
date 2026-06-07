import { Box, Chip, Divider, Link, Stack, Typography } from "@mui/material";
import { attachmentUrl, type Receipt } from "../api";
import { isImage, isPdf } from "../constants";

export const ReceiptDetail = ({
  month,
  receipt,
}: {
  month: string,
  receipt: Receipt,
}) => {
  const c = receipt.classification;
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {receipt.subject || "(no subject)"}
      </Typography>

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

      {receipt.attachments.length > 0 && (
        <Box sx={{ mb: 3 }}>
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

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" gutterBottom>
        Body
      </Typography>
      <Box
        component="iframe"
        srcDoc={receipt.body}
        title="email body"
        sandbox=""
        sx={{
          width: "100%",
          height: 600,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      />
    </Box>
  );
};
