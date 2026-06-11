import { type ReactNode } from "react";
import { IconButton, Tooltip } from "@mui/material";

// A small icon toggle used for a row's marks. The caller supplies the icon
// (already coloured for its on/off state) and what to do on click. The click is
// kept from reaching the surrounding row so marking doesn't also open it.
export const MarkToggle = ({
  title,
  onToggle,
  children,
}: {
  title: string,
  onToggle: () => void,
  children: ReactNode,
}) => {
  return (
    <Tooltip followCursor title={title}>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        sx={{ p: 0.25, flexShrink: 0 }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
};
