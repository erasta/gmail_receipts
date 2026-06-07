import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { type Ledger, type ReceiptSummary } from "../api";

export const ReceiptList = ({
  ledger,
  receipts,
  selectedBaseName,
  onSelect,
}: {
  ledger: Ledger | null,
  receipts: ReceiptSummary[],
  selectedBaseName: string | undefined,
  onSelect: (baseName: string) => void,
}) => {
  return (
    <>
      {ledger && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {ledger.receipts} receipts / {ledger.seen} emails seen
        </Typography>
      )}

      <List dense sx={{ overflowY: "auto", flex: 1 }}>
        {receipts.map((r) => (
          <ListItemButton
            key={r.base_name}
            selected={selectedBaseName === r.base_name}
            onClick={() => onSelect(r.base_name)}
          >
            <ListItemText
              primary={r.subject || "(no subject)"}
              secondary={
                <>
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.from}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <span>{r.date}</span>
                    {r.attachments.length > 0 && (
                      <span>📎 {r.attachments.length}</span>
                    )}
                  </Box>
                </>
              }
              slotProps={{ primary: { noWrap: true, sx: { fontWeight: 600 } } }}
            />
          </ListItemButton>
        ))}
        {receipts.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ p: 1 }}>
            No receipts
          </Typography>
        )}
      </List>
    </>
  );
};
