import { type ReactNode } from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";
import AttachEmailIcon from "@mui/icons-material/AttachEmail";

export const AppHeader = ({ children }: { children?: ReactNode }) => {
  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <AttachEmailIcon sx={{ mr: 1.5 }} />
        <Typography variant="h6" sx={{ flex: 1 }}>
          Receipts
        </Typography>
        {children}
      </Toolbar>
    </AppBar>
  );
};
