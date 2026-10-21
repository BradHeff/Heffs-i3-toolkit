// Shared typed models. One contract for frontend adapters and the Rust backend.

export type ConfigFormat = "i3" | "ini" | "gtk-ini" | "shell" | "rasi" | "conf";

export interface FileMeta {
  path: string;
  format: ConfigFormat;
  exists: boolean;
  lastModified: string | null; // ISO 8601
  sizeBytes: number | null;
}

export interface ApplyResult {
  ok: boolean;
  message: string;
  commandRun: string | null;
  commandOutput: string | null;
}

export interface WriteResult {
  ok: boolean;
  backupPath: string | null;
  error: string | null;
  /** mtime of the file after the write, for watcher rebaselining. */
  writtenMtime: string | null;
}

// i3 config model -----------------------------------------------------------

export interface I3Keybind {
  id: string;
  mode: string; // "main" for top-level binds
  keys: string;
  command: string;
  enabled: boolean;
  raw: string; // original line, preserved when untouched
  lineIndex?: number; // set by the parser; absent for UI-added entries
}

export interface I3StartupApp {
  id: string;
  kind: "exec" | "exec_always";
  command: string;
  note: string;
  enabled: boolean;
  raw: string;
  lineIndex?: number; // set by the parser; absent for UI-added entries
  /** Line index of the "# note:" comment above the exec, when present. */
  noteLineIndex?: number;
  /** Whether the invocation carries --no-startup-id. */
  noStartupId: boolean;
}

export interface I3Appearance {
  gapsInner: number;
  gapsOuter: number;
  font: string;
  borderWidth: number;
}

export interface I3Model {
  keybinds: I3Keybind[];
  startup: I3StartupApp[];
  appearance: I3Appearance;
}

export const I3_DEFAULT_PATH = "~/.config/i3/config";

export const CONFIG_TARGETS: Record<
  string,
  { label: string; format: ConfigFormat; defaultPath: string }
> = {
  i3: { label: "i3", format: "i3", defaultPath: I3_DEFAULT_PATH },
  polybar: {
    label: "Polybar",
    format: "ini",
    defaultPath: "~/.config/polybar/config.ini",
  },
  rofi: {
    label: "rofi",
    format: "rasi",
    defaultPath: "~/.config/rofi/config.rasi",
  },
  lock: {
    label: "i3lock-color",
    format: "shell",
    defaultPath: "/usr/local/bin/lock",
  },
  greeter: {
    label: "LightDM greeter",
    format: "gtk-ini",
    defaultPath: "/etc/lightdm/lightdm-gtk-greeter.conf",
  },
  dunst: {
    label: "dunst",
    format: "ini",
    defaultPath: "~/.config/dunst/dunstrc",
  },
  picom: {
    label: "picom",
    format: "conf",
    defaultPath: "~/.config/picom/picom.conf",
  },
};
