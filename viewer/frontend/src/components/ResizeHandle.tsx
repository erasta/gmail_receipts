import { Box } from "@mui/material";

// A draggable vertical strip that sits between the sidebar and the detail
// view. While the mouse is held down it follows the cursor and reports the
// new sidebar width, clamped between a minimum and half the window width.
const MIN_WIDTH = 240;

export const ResizeHandle = ({
  onResize,
}: {
  onResize: (width: number) => void,
}) => {
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (move: MouseEvent) => {
      const max = window.innerWidth / 2;
      onResize(Math.min(Math.max(move.clientX, MIN_WIDTH), max));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <Box
      onMouseDown={startResize}
      sx={{
        width: "5px",
        flexShrink: 0,
        cursor: "col-resize",
        bgcolor: "divider",
        "&:hover": { bgcolor: "primary.main" },
      }}
    />
  );
};
