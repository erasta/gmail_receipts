import { useState } from "react";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { type Ledger, type ReceiptRow } from "../api";

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
  highlightedLabels,
  selectedKey,
  onSelect,
}: {
  ledger: Ledger | null,
  receipts: ReceiptRow[],
  highlightedLabels: Set<string>,
  selectedKey: string | undefined,
  onSelect: (month: string, baseName: string) => void,
}) => {
  const [compact, setCompact] = useState(false);

  // A small green dot for receipts carrying a highlighted label; hovering it
  // shows the receipt's full label list.
  const marker = (r: ReceiptRow) => {
    if (!r.labels.some((l) => highlightedLabels.has(l))) return null;
    return (
      <Tooltip title={r.labels.join(", ")}>
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            width: 9,
            height: 9,
            mr: 1,
            borderRadius: "50%",
            bgcolor: "success.main",
          }}
        />
      </Tooltip>
    );
  };

  return (
    <>
      <Stack
        direction="row"
        sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}
      >
        {ledger && (
          <Typography variant="body2" color="text.secondary">
            {receipts.length} / {ledger.receipts} receipts · {ledger.seen} seen
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
              key={`${r.month}:${r.base_name}`}
              selected={selectedKey === `${r.month}:${r.base_name}`}
              onClick={() => onSelect(r.month, r.base_name)}
              sx={{ display: "flex", gap: 1, alignItems: "center" }}
            >
              {marker(r)}
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
              key={`${r.month}:${r.base_name}`}
              selected={selectedKey === `${r.month}:${r.base_name}`}
              onClick={() => onSelect(r.month, r.base_name)}
            >
              {marker(r)}
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
