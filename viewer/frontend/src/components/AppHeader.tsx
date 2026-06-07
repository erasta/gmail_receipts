import { AppBar, Toolbar, Typography } from "@mui/material";
import AttachEmailIcon from "@mui/icons-material/AttachEmail";

export const AppHeader = () => {
  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <AttachEmailIcon sx={{ mr: 1.5 }} />
        <Typography variant="h6">Receipts</Typography>
      </Toolbar>
    </AppBar>
  );
};
