import { useState } from "react";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { type Ledger, type ReceiptSummary } from "../api";

// "Airwallet ApS <receipts@airwallet.net>" -> "Airwallet ApS". Falls back to
// the whole string when there's no display name before the angle brackets.
const shortFrom = (from: string) => {
  const name = from.split("<")[0].trim();
  return name || from;
};

// "Mon, 1 Sep 2025 09:02:45 +0000" -> "1 Sep 2025": drop the weekday and the
// time. If the string isn't in that shape, show it unchanged.
const shortDate = (date: string) => {
  const parts = date.replace(/^[A-Za-z]+,\s*/, "").split(" ");
  return parts.length >= 3 ? parts.slice(0, 3).join(" ") : date;
};

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
  const [compact, setCompact] = useState(false);

  return (
    <>
      <Stack
        direction="row"
        sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}
      >
        {ledger && (
          <Typography variant="body2" color="text.secondary">
            {ledger.receipts} receipts / {ledger.seen} emails seen
          </Typography>
        )}
        <Button size="small" onClick={() => setCompact((c) => !c)}>
          {compact ? "Full view" : "Compact view"}
        </Button>
      </Stack>

      <List dense sx={{ overflowY: "auto", flex: 1 }}>
        {receipts.map((r) =>
          compact ? (
            <ListItemButton
              key={r.base_name}
              selected={selectedBaseName === r.base_name}
              onClick={() => onSelect(r.base_name)}
              sx={{ display: "flex", gap: 1, alignItems: "baseline" }}
            >
              <Box
                component="span"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                }}
              >
                {r.subject || "(no subject)"}
              </Box>
              <Box
                component="span"
                sx={{
                  flexShrink: 0,
                  maxWidth: "35%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "text.secondary",
                  fontSize: "0.8rem",
                }}
              >
                {shortFrom(r.from)}
              </Box>
              <Box
                component="span"
                sx={{
                  flexShrink: 0,
                  color: "text.secondary",
                  fontSize: "0.8rem",
                  whiteSpace: "nowrap",
                }}
              >
                {shortDate(r.date)}
              </Box>
            </ListItemButton>
          ) : (
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
          ),
        )}
        {receipts.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ p: 1 }}>
            No receipts
          </Typography>
        )}
      </List>
    </>
  );
};
