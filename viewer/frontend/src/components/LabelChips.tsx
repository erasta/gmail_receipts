import { Box, Chip, Tooltip } from "@mui/material";
import { type LabelCount } from "../api";

// Each label chip cycles through three states on click:
//   shown       - blue: receipts with this label appear normally (the default)
//   hidden      - grey: receipts whose only labels are hidden drop off the list
//   highlighted - green: matching receipts get a green marker in the list
export type LabelState = "shown" | "hidden" | "highlighted";

const chipColor = {
  shown: "primary",
  hidden: "default",
  highlighted: "success",
} as const;

export const LabelChips = ({
  labels,
  states,
  onCycle,
  onShowOnly,
}: {
  labels: LabelCount[],
  states: Record<string, LabelState>,
  onCycle: (label: string) => void,
  onShowOnly: (label: string) => void,
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
        const state = states[label] ?? "shown";
        return (
          <Chip
            key={label}
            label={`${label} (${count})`}
            color={chipColor[state]}
            variant={state === "hidden" ? "outlined" : "filled"}
            onClick={() => onCycle(label)}
            // The delete slot gives us a pressable dot on the right of the chip
            // that doesn't trigger the chip's own cycle click.
            onDelete={() => onShowOnly(label)}
            deleteIcon={
              <Tooltip title="Show only this label">
                <Box
                  component="span"
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: "warning.main",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "warning.dark" },
                  }}
                />
              </Tooltip>
            }
          />
        );
      })}
    </Box>
  );
};
