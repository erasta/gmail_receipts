import { useRef, useState } from "react";
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
import AddCircleIcon from "@mui/icons-material/AddCircle";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { MarkKind, type Ledger, type Marks, type ReceiptRow } from "../api";
import { MarkToggle } from "./MarkToggle";
import { ViewModeButton, type ViewMode } from "./ViewModeButton";
import { MarkContextMenu } from "./MarkContextMenu";

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
  marks,
  onSetMark,
  onApplyMarks,
  markedView,
  hiddenView,
  onCycleMarkedView,
  onCycleHiddenView,
  selectedKey,
  onSelect,
}: {
  ledger: Ledger | null,
  receipts: ReceiptRow[],
  highlightedLabels: Set<string>,
  marks: Marks,
  onSetMark: (month: string, baseName: string, kind: MarkKind | null) => void,
  onApplyMarks: (
    targets: { month: string, base_name: string }[],
    kind: MarkKind | null,
  ) => void,
  markedView: ViewMode,
  hiddenView: ViewMode,
  onCycleMarkedView: () => void,
  onCycleHiddenView: () => void,
  selectedKey: string | undefined,
  onSelect: (month: string, baseName: string) => void,
}) => {
  const [compact, setCompact] = useState(true);

  // Multi-selection of rows for the right-click menu. Keys are "month:base".
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const anchorIndex = useRef(-1);
  const [menuPos, setMenuPos] = useState<{ left: number, top: number } | null>(
    null,
  );

  const keyOf = (r: ReceiptRow) => `${r.month}:${r.base_name}`;

  // A row's export and hide toggles, side by side. Each sets its kind or clears
  // it (the two kinds are mutually exclusive, so setting one replaces the other).
  const markBox = (r: ReceiptRow) => {
    const kind = marks[r.month]?.[r.base_name];
    return (
      <Box component="span" sx={{ display: "flex", flexShrink: 0 }}>
        <MarkToggle
          title={
            kind === MarkKind.Export ? "Marked for export" : "Mark for export"
          }
          onToggle={() =>
            onSetMark(
              r.month,
              r.base_name,
              kind === MarkKind.Export ? null : MarkKind.Export,
            )
          }
        >
          <AddCircleIcon
            fontSize="small"
            sx={{
              color: kind === MarkKind.Export ? "primary.main" : "text.disabled",
            }}
          />
        </MarkToggle>
        <MarkToggle
          title={kind === MarkKind.Hide ? "Hidden" : "Hide"}
          onToggle={() =>
            onSetMark(
              r.month,
              r.base_name,
              kind === MarkKind.Hide ? null : MarkKind.Hide,
            )
          }
        >
          <VisibilityOffIcon
            fontSize="small"
            sx={{
              color: kind === MarkKind.Hide ? "error.main" : "text.disabled",
            }}
          />
        </MarkToggle>
      </Box>
    );
  };

  // Counts for the status line: how many of the shown rows carry each kind, and
  // how many carry it across every month.
  const countShown = (kind: MarkKind) =>
    receipts.filter((r) => marks[r.month]?.[r.base_name] === kind).length;
  const countTotal = (kind: MarkKind) =>
    Object.values(marks).reduce(
      (sum, monthMarks) =>
        sum + Object.values(monthMarks).filter((k) => k === kind).length,
      0,
    );
  const markedShown = countShown(MarkKind.Export);
  const markedTotal = countTotal(MarkKind.Export);
  const hiddenShown = countShown(MarkKind.Hide);
  const hiddenTotal = countTotal(MarkKind.Hide);

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

  // Plain click selects just this row and opens it; Ctrl/Cmd-click toggles it in
  // the selection; Shift-click selects the range from the last anchor.
  const handleClick = (
    e: React.MouseEvent,
    index: number,
    r: ReceiptRow,
  ) => {
    const key = keyOf(r);
    if (e.shiftKey && anchorIndex.current >= 0) {
      const [a, b] = [anchorIndex.current, index].sort((x, y) => x - y);
      setChosen(new Set(receipts.slice(a, b + 1).map(keyOf)));
    } else if (e.ctrlKey || e.metaKey) {
      setChosen((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      anchorIndex.current = index;
    } else {
      setChosen(new Set([key]));
      anchorIndex.current = index;
      onSelect(r.month, r.base_name);
    }
  };

  // Right-clicking a row that isn't selected makes it the selection, then opens
  // the menu at the cursor.
  const handleContextMenu = (e: React.MouseEvent, r: ReceiptRow) => {
    e.preventDefault();
    const key = keyOf(r);
    setChosen((prev) => (prev.has(key) ? prev : new Set([key])));
    setMenuPos({ left: e.clientX, top: e.clientY });
  };

  // Ctrl/Cmd-A selects every row currently in the list.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      setChosen(new Set(receipts.map(keyOf)));
    }
  };

  const applyToSelection = (kind: MarkKind | null) => {
    const targets = receipts
      .filter((r) => chosen.has(keyOf(r)))
      .map((r) => ({ month: r.month, base_name: r.base_name }));
    onApplyMarks(targets, kind);
  };

  // Shared props for a row in either view: selection highlight, the open-receipt
  // accent on the left, and the click/right-click handlers.
  const rowProps = (r: ReceiptRow, index: number) => ({
    key: keyOf(r),
    selected: chosen.has(keyOf(r)),
    onClick: (e: React.MouseEvent) => handleClick(e, index, r),
    onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, r),
    sx: {
      borderLeft: "3px solid",
      borderLeftColor:
        keyOf(r) === selectedKey ? "primary.main" : "transparent",
    },
  });

  return (
    <>
      <Stack
        direction="row"
        sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="body2" color="text.secondary">
          {ledger && `${ledger.receipts}/${ledger.seen} receipts `}
          {ledger &&
            receipts.length < ledger.receipts &&
            `[${receipts.length} filtered] `}
          <Box component="span" sx={{ color: "primary.main" }}>
            {markedShown}/{markedTotal} marked
          </Box>{" "}
          <Box component="span" sx={{ color: "error.main" }}>
            {hiddenShown}/{hiddenTotal} hidden
          </Box>
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <ViewModeButton
            label="Marked"
            mode={markedView}
            onCycle={onCycleMarkedView}
          />
          <ViewModeButton
            label="Hidden"
            mode={hiddenView}
            onCycle={onCycleHiddenView}
          />
          <Button size="small" onClick={() => setCompact((c) => !c)}>
            {compact ? "Full view" : "Compact view"}
          </Button>
        </Stack>
      </Stack>

      <List
        dense
        tabIndex={0}
        onKeyDown={handleKeyDown}
        sx={{ overflowY: "auto", flex: 1, outline: "none" }}
      >
        {receipts.map((r, index) =>
          compact ? (
            <ListItemButton
              {...rowProps(r, index)}
              sx={{
                ...rowProps(r, index).sx,
                display: "flex",
                gap: 1,
                alignItems: "center",
                pl: 1,
              }}
            >
              {markBox(r)}
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
              {r.attachments.length > 0 && (
                <Box
                  component="span"
                  sx={{
                    flexShrink: 0,
                    color: "text.secondary",
                    fontSize: "0.8rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  📎{r.attachments.length}
                </Box>
              )}
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
              {...rowProps(r, index)}
              sx={{ ...rowProps(r, index).sx, pl: 1 }}
            >
              {markBox(r)}
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

      <MarkContextMenu
        position={menuPos}
        count={chosen.size}
        onClose={() => setMenuPos(null)}
        onApply={applyToSelection}
      />
    </>
  );
};
