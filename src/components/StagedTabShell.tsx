// StagedTabShell: the common tab frame. File locator header, diff
// dialog, snackbar, validation and apply rail. Each tab supplies the
// editor panels between the header and the rail.

import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  SnackbarContent,
  Typography,
} from "@mui/material";
import FileLocatorHeader from "./FileLocatorHeader";
import DiffDialog from "./DiffDialog";
import { diffLines } from "../lib/diff";
import type { useStagedConfig } from "../lib/useStagedConfig";
import { CONFIG_TARGETS } from "../types";

type StagedApi = ReturnType<typeof useStagedConfig<any>>;

export interface StagedTabShellProps {
  targetKey: string;
  api: StagedApi;
  /** Hide the custom-path control (lock script has a fixed path). */
  lockedPath?: boolean;
  /** Main editor panels; laid out in the wide column like the i3 tab. */
  children: ReactNode;
}

export function SectionTitle(props: { title: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
      <Typography
        variant="caption"
        sx={{
          fontFamily: '"JetBrains Mono", monospace',
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "text.secondary",
        }}
      >
        {props.title}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      {props.action}
    </Box>
  );
}

export default function StagedTabShell(props: StagedTabShellProps) {
  const { targetKey, api, lockedPath = false, children } = props;
  const target = CONFIG_TARGETS[targetKey];

  if (api.error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {api.error}
      </Alert>
    );
  }
  if (!api.file) {
    return (
      <Box sx={{ p: 2, color: "text.secondary", fontFamily: '"JetBrains Mono", monospace' }}>
        Loading…
      </Box>
    );
  }

  return (
    <Box>
      <FileLocatorHeader
        targetKey={targetKey}
        label={target.label}
        format={target.format}
        defaultPath={target.defaultPath}
        lockedPath={lockedPath}
        path={api.path}
        onPathChange={api.setPath}
        refreshKey={api.refreshKey}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 2,
          p: 2,
          alignItems: "start",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          {children}
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper sx={{ p: 2 }}>
            <SectionTitle title="Validation" />
            {api.validationErrors.length === 0 ? (
              <Typography variant="body2" sx={{ color: "success.main" }}>
                No issues found.
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {api.validationErrors.map((err, i) => (
                  <Box component="li" key={i}>
                    <Typography variant="body2" sx={{ color: "error.main" }}>
                      {err}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <SectionTitle title="Apply" />
            {api.dirty && (
              <Typography
                variant="caption"
                sx={{ color: "warning.main", display: "block", mb: 1 }}
              >
                Unsaved changes
              </Typography>
            )}
            <Button
              variant="contained"
              disabled={!api.dirty || api.busy}
              onClick={api.beginApply}
              fullWidth
            >
              Apply
            </Button>
          </Paper>
        </Box>
      </Box>

      <DiffDialog
        open={api.diffOpen}
        path={api.path}
        diff={diffLines(api.original, api.serialized)}
        onCancel={() => api.setDiffOpen(false)}
        onConfirm={api.confirmApply}
        busy={api.busy}
      />

      <Snackbar
        open={api.snack !== null}
        autoHideDuration={6000}
        onClose={() => api.setSnack(null)}
      >
        <SnackbarContent message={api.snack?.message ?? ""} aria-live="polite" />
      </Snackbar>
    </Box>
  );
}
