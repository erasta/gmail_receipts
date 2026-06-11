import { Divider, Menu, MenuItem } from "@mui/material";
import { MarkKind } from "../api";

// The right-click menu over the receipt list. The mark items apply one change
// to every selected receipt; "Copy path" copies their file paths.
export const MarkContextMenu = ({
  position,
  count,
  onClose,
  onApply,
  onCopyPath,
}: {
  position: { left: number, top: number } | null,
  count: number,
  onClose: () => void,
  onApply: (kind: MarkKind | null) => void,
  onCopyPath: () => void,
}) => {
  const run = (action: () => void) => () => {
    action();
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
      <MenuItem onClick={run(() => onApply(MarkKind.Export))}>
        Mark for export
      </MenuItem>
      <MenuItem onClick={run(() => onApply(MarkKind.Hide))}>Hide</MenuItem>
      <MenuItem onClick={run(() => onApply(null))}>Clear mark</MenuItem>
      <Divider />
      <MenuItem onClick={run(onCopyPath)}>
        Copy path{count > 1 ? "s" : ""}
      </MenuItem>
    </Menu>
  );
};
