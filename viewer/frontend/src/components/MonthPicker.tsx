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
  onYearChange,
  onMonthToggle,
  onRunFetch,
}: {
  months: string[],
  year: number,
  selectedMonths: Set<number>,
  onYearChange: (year: number) => void,
  onMonthToggle: (monthNum: number) => void,
  onRunFetch: () => void,
}) => {
  const [collapsed, setCollapsed] = useState(true);

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
            return (
              <MenuItem
                key={y}
                dense
                selected={y === year}
                onClick={() => onYearChange(y)}
                sx={{ fontWeight: hasData ? 700 : 400 }}
              >
                {y}
              </MenuItem>
            );
          })}
        </MenuList>
        <MenuList sx={listSx}>
          {MONTHS.map((m) => {
            const hasData = months.includes(`${year}-${pad(m)}`);
            return (
              <MenuItem
                key={m}
                dense
                selected={selectedMonths.has(m)}
                onClick={() => onMonthToggle(m)}
                sx={{
                  fontWeight: hasData ? 700 : 400,
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
