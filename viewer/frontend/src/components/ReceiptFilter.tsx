import { IconButton, Stack, TextField, Tooltip } from "@mui/material";
import SubjectIcon from "@mui/icons-material/Subject";
import NotesIcon from "@mui/icons-material/Notes";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";

// Which parts of an email the text filter looks in. "addresses" covers the
// to, from and cc fields together.
export type FilterField = "subject" | "body" | "addresses";

const FIELDS: { field: FilterField, label: string, icon: React.ReactNode }[] = [
  { field: "subject", label: "Subject", icon: <SubjectIcon fontSize="small" /> },
  { field: "body", label: "Body", icon: <NotesIcon fontSize="small" /> },
  {
    field: "addresses",
    label: "Addresses (to/from/cc)",
    icon: <AlternateEmailIcon fontSize="small" />,
  },
];

export const ReceiptFilter = ({
  text,
  fields,
  onTextChange,
  onToggleField,
}: {
  text: string,
  fields: Set<FilterField>,
  onTextChange: (text: string) => void,
  onToggleField: (field: FilterField) => void,
}) => {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}>
      <TextField
        size="small"
        placeholder="Filter…"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        sx={{ flex: 1 }}
      />
      {FIELDS.map(({ field, label, icon }) => {
        const on = fields.has(field);
        return (
          <Tooltip key={field} title={label}>
            <IconButton
              size="small"
              color={on ? "primary" : "default"}
              onClick={() => onToggleField(field)}
              sx={{ opacity: on ? 1 : 0.4 }}
            >
              {icon}
            </IconButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
