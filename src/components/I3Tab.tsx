// I3Tab — keybind editor, startup apps, appearance. Everything is staged
// in the app model; nothing touches disk until Apply runs the full
// pipeline (diff preview -> backup -> atomic write -> i3-msg reload).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  SnackbarContent,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import FileLocatorHeader from "./FileLocatorHeader";
import DiffDialog from "./DiffDialog";
import NumberField from "./NumberField";
import { findKeyConflicts, parseI3, serializeI3, validateI3 } from "../adapters/i3";
import type { I3File } from "../adapters/i3";
import { diffLines } from "../lib/diff";
import { applyTool, readConfig, writeConfig } from "../ipc";
import { CONFIG_TARGETS, I3_DEFAULT_PATH } from "../types";
import type { I3Keybind, I3StartupApp } from "../types";

const target = CONFIG_TARGETS.i3;

interface Snack {
  message: string;
  ok: boolean;
}

export default function I3Tab() {
  const [path, setPath] = useState(I3_DEFAULT_PATH);
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);
  const [file, setFile] = useState<I3File | null>(null);
  const [original, setOriginal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);

  // Load the config into the staged model.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await readConfig(path);
        if (!cancelled) {
          setFile(parseI3(text));
          setOriginal(text);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, refreshKey]);

  const serialized = useMemo(() => (file ? serializeI3(file) : ""), [file]);
  const dirty = original !== serialized;

  const conflicts = useMemo(
    () => (file ? findKeyConflicts(file.model.keybinds) : new Map<string, I3Keybind[]>()),
    [file]
  );
  const conflictIds = useMemo(
    () => new Set([...conflicts.values()].flatMap((list) => list.map((b) => b.id))),
    [conflicts]
  );

  const validationErrors = useMemo(() => (file ? validateI3(file.model) : []), [file]);

  // --- model mutation helpers --------------------------------------------

  const updateBind = useCallback((id: string, patch: Partial<I3Keybind>) => {
    setFile((f) =>
      f && {
        ...f,
        model: {
          ...f.model,
          keybinds: f.model.keybinds.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        },
      }
    );
  }, []);

  const removeBind = useCallback((id: string) => {
    setFile((f) =>
      f && {
        ...f,
        model: { ...f.model, keybinds: f.model.keybinds.filter((b) => b.id !== id) },
      }
    );
  }, []);

  const addBind = useCallback(() => {
    setFile((f) => {
      if (!f) return f;
      const nb: I3Keybind = {
        id: `ui-${Date.now()}`,
        mode: "main",
        keys: "$mod+",
        command: "",
        enabled: true,
        raw: "",
      };
      return { ...f, model: { ...f.model, keybinds: [...f.model.keybinds, nb] } };
    });
  }, []);

  const updateStartup = useCallback((id: string, patch: Partial<I3StartupApp>) => {
    setFile((f) =>
      f && {
        ...f,
        model: {
          ...f.model,
          startup: f.model.startup.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        },
      }
    );
  }, []);

  const removeStartup = useCallback((id: string) => {
    setFile((f) =>
      f && {
        ...f,
        model: { ...f.model, startup: f.model.startup.filter((e) => e.id !== id) },
      }
    );
  }, []);

  const addStartup = useCallback(() => {
    setFile((f) => {
      if (!f) return f;
      const e: I3StartupApp = {
        id: `ui-${Date.now()}`,
        kind: "exec",
        command: "",
        note: "",
        enabled: true,
        raw: "",
        noStartupId: false,
      };
      return { ...f, model: { ...f.model, startup: [...f.model.startup, e] } };
    });
  }, []);

  const updateAppearance = useCallback(
    (patch: Partial<I3File["model"]["appearance"]>) => {
      setFile((f) =>
        f && {
          ...f,
          model: {
            ...f.model,
            appearance: { ...f.model.appearance, ...patch },
          },
        }
      );
    },
    []
  );

  // --- write pipeline ------------------------------------------------------

  const beginApply = useCallback(() => {
    if (validationErrors.length > 0) {
      setSnack({ message: "Fix validation errors first.", ok: false });
      return;
    }
    setDiffOpen(true);
  }, [validationErrors]);

  const confirmApply = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await writeConfig({ path, content: serialized, format: "i3" });
      if (!result.ok) {
        setSnack({ message: `Write failed: ${result.error}`, ok: false });
        return;
      }
      const apply = await applyTool("i3", path);
      setSnack({
        message: apply.ok
          ? `Written. ${apply.message} Backup: ${result.backupPath ?? "(none)"}`
          : `Written, but apply failed: ${apply.message}`,
        ok: apply.ok,
      });
      setOriginal(serialized);
      setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
      setDiffOpen(false);
    }
  }, [file, path, serialized]);

  // --- render ----------------------------------------------------------------

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }
  if (!file) {
    return (
      <Box sx={{ p: 2, color: "text.secondary", fontFamily: '"JetBrains Mono", monospace' }}>
        Loading…
      </Box>
    );
  }

  const modes = [...new Set(file.model.keybinds.map((b) => b.mode))];

  return (
    <Box>
      <FileLocatorHeader
        targetKey="i3"
        label={target.label}
        format={target.format}
        defaultPath={target.defaultPath}
        path={path}
        onPathChange={setPath}
        refreshKey={refreshKey}
        onExternalChange={dirty ? undefined : reload}
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
          <Paper sx={{ p: 0, overflow: "hidden" }}>
            <Box sx={{ px: 2, pt: 1.5 }}>
              <SectionTitle
                title="Keybinds"
                action={
                  <Button startIcon={<AddIcon />} onClick={addBind} size="small">
                    Add
                  </Button>
                }
              />
            </Box>
            {conflictIds.size > 0 && (
              <Alert severity="warning" sx={{ mx: 2, mb: 1 }}>
                {conflictIds.size} keybind{conflictIds.size === 1 ? "" : "s"} share a key
                combo with another bind in the same mode.
              </Alert>
            )}
            <TableContainer sx={{ maxHeight: 380 }}>
              <Table stickyHeader size="small" aria-label="Keybind editor">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">On</TableCell>
                    <TableCell>Keys</TableCell>
                    <TableCell>Command</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {file.model.keybinds.map((b) => (
                    <KeybindRow
                      key={b.id}
                      bind={b}
                      conflicted={conflictIds.has(b.id)}
                      modes={modes}
                      onChange={updateBind}
                      onRemove={removeBind}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 0, overflow: "hidden" }}>
            <Box sx={{ px: 2, pt: 1.5 }}>
              <SectionTitle
                title="Startup apps"
                action={
                  <Button startIcon={<AddIcon />} onClick={addStartup} size="small">
                    Add
                  </Button>
                }
              />
            </Box>
            <TableContainer sx={{ maxHeight: 260 }}>
              <Table stickyHeader size="small" aria-label="Startup apps">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">On</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell>Command</TableCell>
                    <TableCell>Note</TableCell>
                    <TableCell padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {file.model.startup.map((e) => (
                    <StartupRow
                      key={e.id}
                      entry={e}
                      onChange={updateStartup}
                      onRemove={removeStartup}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper sx={{ p: 2 }}>
            <SectionTitle title="Appearance" />
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <NumberField
                label="Gaps inner (px)"
                min={0}
                value={file.model.appearance.gapsInner}
                onChange={(v) => updateAppearance({ gapsInner: v })}
              />
              <NumberField
                label="Gaps outer (px)"
                min={0}
                value={file.model.appearance.gapsOuter}
                onChange={(v) => updateAppearance({ gapsOuter: v })}
              />
              <TextField
                label="Font"
                value={file.model.appearance.font}
                onChange={(e) => updateAppearance({ font: e.target.value })}
              />
              <NumberField
                label="Border width (px)"
                min={0}
                value={file.model.appearance.borderWidth}
                onChange={(v) => updateAppearance({ borderWidth: v })}
              />
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <SectionTitle title="Validation" />
            {validationErrors.length === 0 ? (
              <Typography variant="body2" sx={{ color: "success.main" }}>
                No issues found.
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {validationErrors.map((err, i) => (
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
            {dirty && (
              <Typography variant="caption" sx={{ color: "warning.main", display: "block", mb: 1 }}>
                Unsaved changes
              </Typography>
            )}
            <Button
              variant="contained"
              disabled={!dirty || busy}
              onClick={beginApply}
              fullWidth
            >
              Apply
            </Button>
          </Paper>
        </Box>
      </Box>

      <DiffDialog
        open={diffOpen}
        path={path}
        diff={diffOpen ? diffLines(original, serialized) : null}
        onCancel={() => setDiffOpen(false)}
        onConfirm={confirmApply}
        busy={busy}
      />

      <Snackbar open={snack !== null} autoHideDuration={6000} onClose={() => setSnack(null)}>
        <SnackbarContent message={snack?.message ?? ""} aria-live="polite" />
      </Snackbar>
    </Box>
  );
}

function SectionTitle(props: { title: string; action?: React.ReactNode }) {
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
      {props.action && <Box sx={{ ml: "auto" }}>{props.action}</Box>}
    </Box>
  );
}

function KeybindRow(props: {
  bind: I3Keybind;
  conflicted: boolean;
  modes: string[];
  onChange: (id: string, patch: Partial<I3Keybind>) => void;
  onRemove: (id: string) => void;
}) {
  const { bind, conflicted, modes, onChange, onRemove } = props;
  return (
    <TableRow hover>
      <TableCell padding="checkbox">
        <Switch
          size="small"
          checked={bind.enabled}
          onChange={(e) => onChange(bind.id, { enabled: e.target.checked })}
          slotProps={{ input: { "aria-label": `Enable bind ${bind.keys}` } }}
        />
      </TableCell>
      <TableCell>
        <TextField
          value={bind.keys}
          onChange={(e) => onChange(bind.id, { keys: e.target.value })}
          error={conflicted}
          helperText={conflicted ? "conflict" : undefined}
          sx={{ minWidth: 150 }}
          slotProps={{
            htmlInput: {
              style: { fontFamily: '"JetBrains Mono", monospace' },
              "aria-label": `Keys for command ${bind.command}`,
            },
          }}
        />
      </TableCell>
      <TableCell sx={{ width: "45%" }}>
        <TextField
          value={bind.command}
          onChange={(e) => onChange(bind.id, { command: e.target.value })}
          fullWidth
          sx={{ minWidth: 240 }}
          slotProps={{
            htmlInput: {
              style: { fontFamily: '"JetBrains Mono", monospace' },
              "aria-label": `Command for keys ${bind.keys}`,
            },
          }}
        />
      </TableCell>
      <TableCell>
        <TextField
          select
          value={bind.mode}
          onChange={(e) => onChange(bind.id, { mode: e.target.value })}
          sx={{ minWidth: 110 }}
        >
          {modes.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>
      </TableCell>
      <TableCell padding="checkbox">
        <Tooltip title="Remove bind">
          <span>
            <IconButton size="small" onClick={() => onRemove(bind.id)} aria-label="Remove bind">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

function StartupRow(props: {
  entry: I3StartupApp;
  onChange: (id: string, patch: Partial<I3StartupApp>) => void;
  onRemove: (id: string) => void;
}) {
  const { entry, onChange, onRemove } = props;
  return (
    <TableRow hover>
      <TableCell padding="checkbox">
        <Switch
          size="small"
          checked={entry.enabled}
          onChange={(e) => onChange(entry.id, { enabled: e.target.checked })}
          slotProps={{ input: { "aria-label": `Enable startup app ${entry.command}` } }}
        />
      </TableCell>
      <TableCell>
        <TextField
          select
          value={entry.kind}
          onChange={(e) =>
            onChange(entry.id, { kind: e.target.value as I3StartupApp["kind"] })
          }
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="exec">exec</MenuItem>
          <MenuItem value="exec_always">exec_always</MenuItem>
        </TextField>
      </TableCell>
      <TableCell sx={{ width: "45%" }}>
        <TextField
          value={entry.command}
          onChange={(e) => onChange(entry.id, { command: e.target.value })}
          fullWidth
          sx={{ minWidth: 220 }}
          slotProps={{
            htmlInput: {
              style: { fontFamily: '"JetBrains Mono", monospace' },
              "aria-label": "Startup command",
            },
          }}
        />
      </TableCell>
      <TableCell>
        <TextField
          value={entry.note}
          onChange={(e) => onChange(entry.id, { note: e.target.value })}
          sx={{ minWidth: 140 }}
          aria-label="Note"
        />
      </TableCell>
      <TableCell padding="checkbox">
        <Tooltip title="Remove startup entry">
          <span>
            <IconButton
              size="small"
              onClick={() => onRemove(entry.id)}
              aria-label="Remove startup entry"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
