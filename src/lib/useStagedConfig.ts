// useStagedConfig: the shared staged-edit engine behind every tab.
// Loads the file through the IPC layer, parses it with the target's
// adapter, and runs the safety-rail write pipeline (diff preview ->
// backup -> atomic write -> apply). Nothing touches disk until the
// user confirms the diff.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyTool, readConfig, writeConfig } from "../ipc";
import type { ConfigFormat } from "../types";

export interface Snack {
  message: string;
  ok: boolean;
}

export interface StagedConfigOptions<TFile> {
  targetKey: string;
  format: ConfigFormat;
  defaultPath: string;
  parse: (text: string) => TFile;
  serialize: (file: TFile) => string;
  validate?: (file: TFile) => string[];
}

export function useStagedConfig<TFile>(opts: StagedConfigOptions<TFile>) {
  // Adapters are pure; keep them in a ref so inline lambdas in tabs do
  // not restart the load effect on every render.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [path, setPath] = useState(opts.defaultPath);
  const [refreshKey, setRefreshKey] = useState(0);
  const [file, setFile] = useState<TFile | null>(null);
  const [original, setOriginal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  // Keep a stable identity so inline lambdas in the shell do not churn.
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await readConfig(path);
        if (cancelled) return;
        try {
          const parsed = optsRef.current.parse(text);
          if (cancelled) return;
          setFile(parsed);
          setOriginal(text);
          setError(null);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, refreshKey]);

  const serialized = useMemo(
    () => (file ? optsRef.current.serialize(file) : ""),
    [file]
  );
  const dirty = original !== serialized;

  const validationErrors = useMemo(
    () => (file && optsRef.current.validate ? optsRef.current.validate(file) : []),
    [file]
  );

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
      const result = await writeConfig({
        path,
        content: serialized,
        format: optsRef.current.format,
      });
      if (!result.ok) {
        setSnack({ message: `Write failed: ${result.error}`, ok: false });
        return;
      }
      const apply = await applyTool(optsRef.current.targetKey, path);
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

  return {
    path,
    setPath,
    refreshKey,
    file,
    setFile,
    original,
    serialized,
    dirty,
    error,
    validationErrors,
    diffOpen,
    setDiffOpen,
    beginApply,
    confirmApply,
    busy,
    snack,
    setSnack,
  };
}
