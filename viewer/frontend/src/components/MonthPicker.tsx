import { useState } from "react";
import {
  Button,
  IconButton,
  MenuItem,
  MenuList,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { alpha } from "@mui/material/styles";
import { MarkKind, type Marks } from "../api";
import { MONTHS, MONTH_NAMES, YEARS, pad } from "../constants";

const listSx = {
  flex: 1,
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  py: 0,
};

export const MonthPicker = ({
  months,
  year,
  selectedMonths,
  marks,
  onYearChange,
  onMonthToggle,
  onRunFetch,
}: {
  months: string[],
  year: number,
  selectedMonths: Set<number>,
  marks: Marks,
  onYearChange: (year: number) => void,
  onMonthToggle: (monthNum: number) => void,
  onRunFetch: () => void,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  // How many receipts are marked for export in one "YYYY-MM" month, and across
  // a whole year (every month that starts with "YYYY-").
  const exportCount = (monthMarks: Record<string, MarkKind>) =>
    Object.values(monthMarks).filter((k) => k === MarkKind.Export).length;
  const monthMarkCount = (monthKey: string) =>
    exportCount(marks[monthKey] ?? {});
  const yearMarkCount = (y: number) =>
    Object.entries(marks)
      .filter(([monthKey]) => monthKey.startsWith(`${y}-`))
      .reduce((sum, [, monthMarks]) => sum + exportCount(monthMarks), 0);

  // A one-line, read-only recap of the chosen months, e.g. "2026: Jan, Mar".
  const summary = (() => {
    const chosen = [...selectedMonths]
      .sort((a, b) => a - b)
      .map((m) => MONTH_NAMES[m - 1]);
    return chosen.length
      ? `${year}: ${chosen.join(", ")}`
      : `${year}: no months selected`;
  })();

  if (collapsed) {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 1.5, alignItems: "center" }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, color: "text.secondary" }}
        >
          {summary}
        </Typography>
        <IconButton size="small" onClick={() => setCollapsed(false)}>
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Stack>
    );
  }

  return (
    <Stack spacing={1} sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={1}>
        <MenuList sx={listSx}>
          {YEARS.map((y) => {
            const hasData = months.some((m) => m.startsWith(`${y}-`));
            const marked = yearMarkCount(y);
            return (
              <MenuItem
                key={y}
                dense
                selected={y === year}
                onClick={() => onYearChange(y)}
                sx={{
                  fontWeight: hasData ? 700 : 400,
                  justifyContent: "space-between",
                }}
              >
                {y}
                {marked > 0 && (
                  <Typography component="span" variant="caption" color="primary">
                    {marked}
                  </Typography>
                )}
              </MenuItem>
            );
          })}
        </MenuList>
        <MenuList sx={listSx}>
          {MONTHS.map((m) => {
            const hasData = months.includes(`${year}-${pad(m)}`);
            const marked = monthMarkCount(`${year}-${pad(m)}`);
            return (
              <MenuItem
                key={m}
                dense
                selected={selectedMonths.has(m)}
                onClick={() => onMonthToggle(m)}
                sx={{
                  fontWeight: hasData ? 700 : 400,
                  justifyContent: "space-between",
                  "&.Mui-selected": {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18),
                    "&:hover": {
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.26),
                    },
                  },
                }}
              >
                {MONTH_NAMES[m - 1]}
                {marked > 0 && (
                  <Typography component="span" variant="caption" color="primary">
                    {marked}
                  </Typography>
                )}
              </MenuItem>
            );
          })}
        </MenuList>
        <IconButton
          size="small"
          onClick={() => setCollapsed(true)}
          sx={{ alignSelf: "flex-start" }}
        >
          <ExpandLessIcon fontSize="small" />
        </IconButton>
      </Stack>
      {/* Fetch isn't wired up for daily use yet, so keep the button hidden. */}
      {false && (
        <Button variant="outlined" onClick={onRunFetch}>
          Run fetch
        </Button>
      )}
    </Stack>
  );
};
