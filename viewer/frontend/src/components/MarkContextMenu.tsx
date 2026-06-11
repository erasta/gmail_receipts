import { Menu, MenuItem } from "@mui/material";
import { MarkKind } from "../api";

// The right-click menu over the receipt list. Each item applies one change to
// every currently selected receipt: set a kind, or clear it (null).
export const MarkContextMenu = ({
  position,
  count,
  onClose,
  onApply,
}: {
  position: { left: number, top: number } | null,
  count: number,
  onClose: () => void,
  onApply: (kind: MarkKind | null) => void,
}) => {
  const apply = (kind: MarkKind | null) => () => {
    onApply(kind);
    onClose();
  };
  return (
    <Menu
      open={position !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position ?? undefined}
    >
      <MenuItem disabled>
        {count} selected
      </MenuItem>
      <MenuItem onClick={apply(MarkKind.Export)}>Mark for export</MenuItem>
      <MenuItem onClick={apply(MarkKind.Hide)}>Hide</MenuItem>
      <MenuItem onClick={apply(null)}>Clear mark</MenuItem>
    </Menu>
  );
};
