import { IconButton, Tooltip } from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";

// A small export toggle: marking a receipt stages it for export. Coloured when
// in the export set, a faint grey otherwise. Its click is kept from reaching
// the surrounding row so marking doesn't also open it.
export const MarkToggle = ({
  marked,
  onToggle,
}: {
  marked: boolean,
  onToggle: (marked: boolean) => void,
}) => {
  return (
    <Tooltip
      followCursor
      title={marked ? "Marked for export" : "Mark for export"}
    >
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!marked);
        }}
        sx={{ p: 0.25, mr: 0.5, flexShrink: 0 }}
      >
        <AddCircleIcon
          fontSize="small"
          sx={{ color: marked ? "primary.main" : "text.disabled" }}
        />
      </IconButton>
    </Tooltip>
  );
};
