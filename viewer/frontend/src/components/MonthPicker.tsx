import { Button, MenuItem, MenuList, Stack } from "@mui/material";
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
  monthNum,
  month,
  onYearChange,
  onMonthChange,
  onRunFetch,
}: {
  months: string[],
  year: number,
  monthNum: number,
  month: string,
  onYearChange: (year: number) => void,
  onMonthChange: (monthNum: number) => void,
  onRunFetch: () => void,
}) => {
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
                selected={m === monthNum}
                onClick={() => onMonthChange(m)}
                sx={{ fontWeight: hasData ? 700 : 400 }}
              >
                {MONTH_NAMES[m - 1]}
              </MenuItem>
            );
          })}
        </MenuList>
      </Stack>
      <Button variant="outlined" onClick={onRunFetch}>
        Run fetch for {month}
      </Button>
    </Stack>
  );
};
