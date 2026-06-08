import { Box, Chip } from "@mui/material";
import { type LabelCount } from "../api";

// A row of pressable label chips. A chip is "on" when its label is in the
// selected set; pressing it toggles that label on or off. The count comes
// from the all-months tally the backend computes on startup.
export const LabelChips = ({
  labels,
  selected,
  onToggle,
}: {
  labels: LabelCount[],
  selected: Set<string>,
  onToggle: (label: string) => void,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        p: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {labels.map(({ label, count }) => {
        const on = selected.has(label);
        return (
          <Chip
            key={label}
            label={`${label} (${count})`}
            color={on ? "primary" : "default"}
            variant={on ? "filled" : "outlined"}
            onClick={() => onToggle(label)}
          />
        );
      })}
    </Box>
  );
};
