// FileLocatorHeader — the killer-feature strip at the top of every tab.
// Detected default path, format chip, last-modified, custom-path toggle,
// and an external-change watcher that warns when the file changed on disk
// while the tab was open.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { readFileMeta } from "../ipc";
import type { ConfigFormat, FileMeta } from "../types";

const FORMAT_LABEL: Record<ConfigFormat, string> = {
  i3: "i3 dialect",
  ini: "INI",
  "gtk-ini": "GTK INI",
  shell: "shell",
  rasi: "rasi",
  conf: "conf",
};

function formatMtime(iso: string | null): string {
  if (!iso) return "never";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export interface FileLocatorHeaderProps {
  targetKey: string;
  label: string;
  format: ConfigFormat;
  defaultPath: string;
  /** Fixed path (no custom-path control) for targets like the lock script. */
  lockedPath?: boolean;
  path: string;
  onPathChange: (path: string) => void;
  /** Bump to force a refresh (after a write, for instance). */
  refreshKey: number;
  /** mtime of the last write made by this app; never treated as external. */
  writtenMtime?: string | null;
  /** Fired when the watcher detects an external change. */
  onExternalChange?: () => void;
}

export default function FileLocatorHeader(props: FileLocatorHeaderProps) {
  const {
    targetKey,
    label,
    format,
    defaultPath,
    lockedPath = false,
    path,
    onPathChange,
    refreshKey,
    writtenMtime,
    onExternalChange,
  } = props;

  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [customPath, setCustomPath] = useState(defaultPath);
  const [extWarning, setExtWarning] = useState(false);
  // mtime seen at the last poll: while mounted the watcher rebaselines
  // on every meta change so the app's own writes (apply -> refreshKey ->
  // setMeta) never look like external edits.
  const lastSeenMtime = useRef<string | null>(null);

  // Load metadata for the active path.
  const loadMeta = useCallback(async () => {
    try {
      const m = await readFileMeta(path);
      setMeta(m);
      return m;
    } catch {
      setMeta(null);
      return null;
    }
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await readFileMeta(path);
      if (!cancelled) setMeta(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [path, refreshKey]);

  // External-change watcher: poll the mtime every 5 s while mounted.
  // Tracks the last mtime it saw (not just the one at effect setup), so
  // legitimate successive external edits and our own refreshes both
  // re-baseline instead of firing the warning repeatedly.
  useEffect(() => {
    if (!meta?.exists) return;
    if (meta.lastModified !== lastSeenMtime.current) {
      lastSeenMtime.current = meta.lastModified;
      // meta changed via loadMeta (refresh or apply): this is a known
      // write, not an external one, so clear any stale warning.
      setExtWarning(false);
    }
    // Our own write (apply) reports its mtime directly; adopt it before
    // the 5 s poll can observe it, so the pipeline's own write is never
    // mistaken for an external change.
    if (writtenMtime && writtenMtime !== lastSeenMtime.current) {
      lastSeenMtime.current = writtenMtime;
      setExtWarning(false);
    }
    const knownMtimes = new Set(
      [lastSeenMtime.current, writtenMtime].filter(Boolean) as string[]
    );
    const t = setInterval(async () => {
      try {
        const m = await readFileMeta(path);
        if (
          m.exists &&
          m.lastModified &&
          !knownMtimes.has(m.lastModified)
        ) {
          knownMtimes.add(m.lastModified);
          lastSeenMtime.current = m.lastModified;
          setExtWarning(true);
          onExternalChange?.();
        }
      } catch {
        /* watcher poll failed; stay quiet */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [path, meta?.exists, meta?.lastModified, writtenMtime, onExternalChange]);

  const handleRefresh = useCallback(() => {
    void loadMeta();
  }, [loadMeta]);

  return (
    <Box
      component="section"
      aria-label={`${label} file locator`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
        px: 2,
        py: 1.25,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontFamily: '"JetBrains Mono", monospace',
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "text.secondary",
          minWidth: 64,
        }}
      >
        {targetKey}
      </Typography>

      {meta ? (
        <Tooltip title={meta.exists ? "File detected" : "File not found at this path"}>
          <Chip
            size="small"
            label={meta.exists ? "detected" : "missing"}
            color={meta.exists ? "default" : "warning"}
            variant={meta.exists ? "outlined" : "filled"}
            icon={meta.exists ? undefined : <WarningAmberIcon />}
          />
        </Tooltip>
      ) : (
        <Chip size="small" label="…" variant="outlined" />
      )}

      <Chip
        size="small"
        label={FORMAT_LABEL[format]}
        variant="outlined"
        sx={{ fontFamily: '"JetBrains Mono", monospace' }}
      />

      {useCustom || lockedPath ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}>
          <Typography
            variant="caption"
            noWrap
            sx={{ fontFamily: '"JetBrains Mono", monospace', color: "text.secondary" }}
          >
            path:
          </Typography>
          <PathField
            value={customPath}
            onChange={setCustomPath}
            onCommit={onPathChange}
            defaultPath={defaultPath}
          />
        </Box>
      ) : (
        <Typography
          variant="caption"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            color: "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 420,
          }}
        >
          {path}
        </Typography>
      )}

      {!lockedPath && (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={useCustom}
              onChange={(e) => {
                const next = e.target.checked;
                setUseCustom(next);
                if (next) setCustomPath(path);
                else onPathChange(defaultPath);
              }}
              sx={{ py: 0.5, my: 0 }}
            />
          }
          label="Use custom path"
          slotProps={{
            typography: { variant: "caption", sx: { fontFamily: '"JetBrains Mono", monospace' } },
          }}
        />
      )}

      <Typography
        variant="caption"
        sx={{ fontFamily: '"JetBrains Mono", monospace', color: "text.secondary", ml: "auto" }}
      >
        modified {formatMtime(meta?.lastModified ?? null)}
      </Typography>

      <Tooltip title="Re-check file">
        <span>
          <IconButton size="small" onClick={handleRefresh} aria-label="Re-check file">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {extWarning && (
        <Chip
          size="small"
          color="warning"
          icon={<WarningAmberIcon />}
          label="changed on disk while this tab was open"
          onDelete={() => setExtWarning(false)}
        />
      )}
    </Box>
  );
}

// PathField: a monospace inline path input with 0 radius and a 1px border,
// commit on Enter or blur.
function PathField(props: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  defaultPath: string;
}) {
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  const commit = () => {
    const v = draft.trim();
    if (v) props.onCommit(v);
    else setDraft(props.defaultPath);
  };
  return (
    <Box
      component="input"
      value={draft}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      onBlur={commit}
      spellCheck={false}
      aria-label="Config file path"
      sx={{
        flex: 1,
        minWidth: 120,
        maxWidth: 420,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: "0.75rem",
        color: "text.primary",
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0,
        px: 1,
        py: 0.75,
        outline: "none",
        "&:focus": { borderColor: "primary.main" },
      }}
    />
  );
}
