import { Button } from "@mui/material";

// How a mark kind is filtered in the list:
//   All     - show every receipt regardless of this mark
//   Only    - show only receipts carrying this mark
//   Without - hide receipts carrying this mark
// A const object plus a union type, since the project forbids real enums
// (erasableSyntaxOnly).
export const ViewMode = {
  All: "all",
  Only: "only",
  Without: "without",
} as const;
export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

// Clicking the button steps Without -> Only -> All -> Without.
export const nextViewMode = (mode: ViewMode): ViewMode =>
  mode === ViewMode.Without
    ? ViewMode.Only
    : mode === ViewMode.Only
      ? ViewMode.All
      : ViewMode.Without;

const MODE_TEXT: Record<ViewMode, string> = {
  [ViewMode.All]: "all",
  [ViewMode.Only]: "only",
  [ViewMode.Without]: "off",
};

// A small cycling button for one mark kind, e.g. "Marked: all" or "Hidden: off".
// Filled (not plain text) whenever it is actually filtering the list.
export const ViewModeButton = ({
  label,
  mode,
  onCycle,
}: {
  label: string,
  mode: ViewMode,
  onCycle: () => void,
}) => {
  return (
    <Button
      size="small"
      variant={mode === ViewMode.All ? "text" : "contained"}
      onClick={onCycle}
    >
      {label}: {MODE_TEXT[mode]}
    </Button>
  );
};
