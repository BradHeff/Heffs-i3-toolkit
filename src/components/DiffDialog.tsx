// DiffDialog — the diff preview step of the write pipeline. The user sees
// exactly what will change before anything touches disk.

import { Dialog, DialogContent, DialogTitle, Box, Typography, Button } from "@mui/material";
import type { DiffLine } from "../lib/diff";

const KIND_COLOR: Record<DiffLine["kind"], string> = {
  same: "inherit",
  add: "success.main",
  del: "error.main",
};

const KIND_PREFIX: Record<DiffLine["kind"], string> = {
  same: "  ",
  add: "+ ",
  del: "- ",
};

export interface DiffDialogProps {
  open: boolean;
  path: string;
  diff: DiffLine[] | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

export default function DiffDialog(props: DiffDialogProps) {
  const { open, path, diff, onCancel, onConfirm, busy = false } = props;
  const changes = diff?.filter((d) => d.kind !== "same") ?? [];
  const adds = changes.filter((c) => c.kind === "add").length;
  const dels = changes.filter((c) => c.kind === "del").length;

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "0.875rem", py: 1.5 }}
      >
        Apply changes to {path}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box
          component="pre"
          aria-label="Unified diff preview"
          sx={{
            m: 0,
            p: 2,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.75rem",
            lineHeight: 1.6,
            overflow: "auto",
            maxHeight: 480,
            color: "text.primary",
          }}
        >
          {diff === null
            ? "Computing diff…"
            : diff.map((d, idx) => (
                <Box
                  key={idx}
                  component="span"
                  sx={{
                    display: "block",
                    color: KIND_COLOR[d.kind],
                    bgcolor:
                      d.kind === "add"
                        ? "rgba(53, 203, 180, 0.08)"
                        : d.kind === "del"
                          ? "rgba(229, 83, 75, 0.08)"
                        : "transparent",
                  }}
                >
                  {KIND_PREFIX[d.kind]}
                  {d.text || " "}
                </Box>
              ))}
        </Box>
      </DialogContent>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 1.5 }}>
        <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
          {adds} added, {dels} removed
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onCancel} disabled={busy} color="inherit">
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={busy || changes.length === 0} variant="contained">
          {busy ? "Applying…" : "Backup and write"}
        </Button>
        <Typography
          variant="caption"
          sx={{ fontFamily: '"JetBrains Mono", monospace', color: "text.secondary" }}
        >
          A timestamped backup is written to ~/.config/heffs-i3-toolkit/backups/ first.
        </Typography>
      </Box>
    </Dialog>
  );
}
