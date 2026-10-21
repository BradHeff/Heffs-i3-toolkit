// useStagedConfig: the shared staged-edit engine behind every tab.
// Loads the file through the IPC layer, parses it with the target's
// adapter, and runs the safety-rail write pipeline (diff preview ->
// backup -> atomic write -> apply). Nothing touches disk until the
// user confirms the diff.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyTool, readFileMeta, readConfig, writeConfig } from "../ipc";
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
  // mtime reported by our own last successful write. The header treats
  // this as known so the poller never flags our write as external.
  const [writtenMtime, setWrittenMtime] = useState<string | null>(null);
  // mtime observed when the file was loaded; handed to writeConfig so
  // the backend can refuse the write if the file changed in between.
  const [loadedMtime, setLoadedMtime] = useState<string | null>(null);
  // Keep a stable identity so inline lambdas in the shell do not churn.
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [text, meta] = await Promise.all([
          readConfig(path),
          readFileMeta(path),
        ]);
        if (cancelled) return;
        try {
          const parsed = optsRef.current.parse(text);
          if (cancelled) return;
          setFile(parsed);
          setOriginal(text);
          setLoadedMtime(meta.lastModified);
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
    if (!file || busy) return; // re-entrancy guard: one pipeline run at a time
    // eslint-disable-next-line react-hooks/exhaustive-deps -- busy is the guard itself
    setBusy(true);
    try {
      const result = await writeConfig({
        path,
        content: serialized,
        format: optsRef.current.format,
        expectedMtime: loadedMtime,
      }).catch((e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      }));
      if (!result.ok) {
        setSnack({ message: `Write failed: ${result.error}`, ok: false });
        return;
      }
      // Rebaseline IMMEDIATELY after the write, before applyTool runs:
      // apply can take seconds, and the 5s watcher poll would otherwise
      // flag our own write as an external change during that window.
      setOriginal(serialized);
      setWrittenMtime(result.writtenMtime);
      setRefreshKey((k) => k + 1);
      const apply = await applyTool(
        optsRef.current.targetKey,
        path
      ).catch((e: unknown) => ({
        ok: false as const,
        message: e instanceof Error ? e.message : String(e),
        commandRun: null,
        commandOutput: null,
      }));
      setSnack({
        message: apply.ok
          ? `Written. ${apply.message} Backup: ${result.backupPath ?? "(none)"}`
          : `Written, but apply failed: ${apply.message}`,
        ok: apply.ok,
      });
    } finally {
      setBusy(false);
      setDiffOpen(false);
    }
  }, [file, path, serialized, loadedMtime, busy]);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  return {
    path,
    setPath,
    refreshKey,
    reload,
    writtenMtime,
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
