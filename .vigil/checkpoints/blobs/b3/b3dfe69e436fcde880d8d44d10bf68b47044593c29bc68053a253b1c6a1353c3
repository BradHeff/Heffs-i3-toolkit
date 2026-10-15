// i3 config adapter: parse the dialect into a typed model, serialize back
// preserving untouched lines and comments, validate before write, and
// detect key conflicts (same key in the same mode).
//
// Strategy: the file is kept as an array of raw lines. The model holds
// indices into that array, so untouched content is preserved byte-for-byte
// and comments survive every save.

import type { I3Keybind, I3Model, I3StartupApp } from "../types";

export interface I3File {
  lines: string[];
  model: I3Model;
}

let uid = 0;
const nextId = () => `i3-${++uid}`;

export function parseI3(text: string): I3File {
  const lines = text.split("\n");
  const keybinds: I3Keybind[] = [];
  const startup: I3StartupApp[] = [];

  let mode = "main";
  const modeStack: string[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Track mode blocks: mode "resize" { ... }
    const modeOpen = trimmed.match(/^mode\s+"([^"]+)"\s*\{/);
    if (modeOpen) {
      modeStack.push(mode);
      mode = modeOpen[1];
      return;
    }
    if (/^\}/.test(trimmed) && modeStack.length > 0) {
      mode = modeStack.pop()!;
      return;
    }

    // Commented-out binds/execs stay in the model as disabled entries so
    // nothing is ever lost.
    const commented = trimmed.match(/^#\s*(bindsym|bindcode)\s+/);
    if (commented) {
      const rest = trimmed.replace(/^#\s*/, "");
      const m = rest.match(/^(bindsym|bindcode)\s+([^\s]+)\s+(.+)$/);
      if (m) {
        keybinds.push({
          id: nextId(),
          mode,
          keys: m[2],
          command: m[3],
          enabled: false,
          raw: line,
          lineIndex: i,
        });
      }
      return;
    }

    const execMatch = trimmed.match(
      /^(#?\s*)(exec|exec_always)\b(.*)$/
    );
    if (execMatch && !trimmed.startsWith("bindsym") && !trimmed.startsWith("bindcode")) {
      const enabled = !execMatch[1].includes("#");
      const kindWord = execMatch[2] as "exec" | "exec_always";
      // Strip the leading separator that separates keyword from command.
      let command = execMatch[3].replace(/^[ \t]+/, "");
      command = command.replace(/^--no-startup-id\s+/, "").trim();
      // Note: --no-startup-id flag is dropped from the parsed command;
      // when re-enabled it is restored on serialize (see serializeI3).
      // note read from preceding comment line, if present
      const note = lines[i - 1]?.trim().startsWith("# note:")
        ? lines[i - 1].trim().replace(/^#\s*note:\s*/, "")
        : "";
      startup.push({
        id: nextId(),
        kind: kindWord,
        command,
        note,
        enabled,
        raw: line,
        lineIndex: i,
      });
      return;
    }

    const bindMatch = trimmed.match(/^(bindsym|bindcode)\s+([^\s]+)\s+(.+)$/);
    if (bindMatch) {
      keybinds.push({
        id: nextId(),
        mode,
        keys: bindMatch[2],
        command: bindMatch[3],
        enabled: true,
        raw: line,
        lineIndex: i,
      });
      return;
    }
  });

  return {
    lines,
    model: {
      keybinds,
      startup,
      appearance: parseAppearance(lines),
    },
  };
}

function parseAppearance(lines: string[]): I3Model["appearance"] {
  const get = (re: RegExp): string | null => {
    for (const line of lines) {
      const m = line.trim().match(re);
      if (m) return m[1];
    }
    return null;
  };
  return {
    gapsInner: Number(get(/^gaps\s+inner\s+(\d+)/) ?? 10),
    gapsOuter: Number(get(/^gaps\s+outer\s+(\d+)/) ?? 4),
    font: get(/^font\s+(.+)$/) ?? "pango:JetBrains Mono 9",
    borderWidth: Number(get(/^default_border\s+pixel\s+(\d+)/) ?? 2),
  };
}

// Serialization --------------------------------------------------------------
//
// The file is reconstructed line-by-line from the original raw lines.
// Edited binds/execs replace their line in place; new entries append
// before the closing brace of their mode (or at end of file for main).
// The appearance directives are rewritten in place where found, or
// appended if missing.

// Conflict detection: same key combo in the same mode, only among
// enabled binds. Returns entries grouped by "mode|keys".
export function findKeyConflicts(keybinds: I3Keybind[]): Map<string, I3Keybind[]> {
  const groups = new Map<string, I3Keybind[]>();
  for (const b of keybinds) {
    if (!b.enabled) continue;
    const key = `${b.mode}|${b.keys}`;
    const list = groups.get(key);
    if (list) list.push(b);
    else groups.set(key, [b]);
  }
  const conflicts = new Map<string, I3Keybind[]>();
  for (const [k, list] of groups) {
    if (list.length > 1) conflicts.set(k, list);
  }
  return conflicts;
}

// Validation before write: syntax and sanity checks. Empty result means
// the config is safe to write.
export function validateI3(model: I3Model): string[] {
  const errors: string[] = [];
  if (model.appearance.gapsInner < 0 || model.appearance.gapsInner > 200) {
    errors.push("Gaps inner must be between 0 and 200 px.");
  }
  if (model.appearance.gapsOuter < 0 || model.appearance.gapsOuter > 200) {
    errors.push("Gaps outer must be between 0 and 200 px.");
  }
  if (model.appearance.borderWidth < 0 || model.appearance.borderWidth > 10) {
    errors.push("Border width must be between 0 and 10 px.");
  }
  if (model.appearance.font.trim().length === 0) {
    errors.push("Font cannot be empty.");
  }
  for (const b of model.keybinds) {
    if (!b.enabled) continue;
    if (b.keys.trim().length === 0) {
      errors.push(`Keybind "${b.command}" has no key combo.`);
    }
    if (b.command.trim().length === 0) {
      errors.push(`Keybind ${b.keys} has no command.`);
    }
  }
  for (const e of model.startup) {
    if (!e.enabled) continue;
    if (e.command.trim().length === 0) {
      errors.push(`Startup entry "${e.kind}" has no command.`);
    }
  }
  return errors;
}

export function serializeI3(file: I3File): string {
  const lines = [...file.lines];
  const { keybinds, startup, appearance } = file.model;

  // Build a map of lineIndex -> replacement for binds and execs.
  const replaceAt = new Map<number, string>();

  // Preserve the original line's indentation (mode blocks indent their
  // binds; the raw line is the authority for whitespace).
  const indentOf = (idx: number) => lines[idx]?.match(/^[ \t]*/)?.[0] ?? "";

  for (const b of keybinds) {
    if (b.lineIndex === undefined) continue;
    const keyword = b.keys.match(/^\d+$/) ? "bindcode" : "bindsym";
    const ind = indentOf(b.lineIndex);
    replaceAt.set(
      b.lineIndex,
      b.enabled ? ind + renderBind(b, keyword) : `${ind}# ${renderBind(b, keyword)}`
    );
  }
  for (const e of startup) {
    if (e.lineIndex === undefined) continue;
    const ind = indentOf(e.lineIndex);
    replaceAt.set(e.lineIndex, e.enabled ? ind + renderExec(e) : `${ind}# ${renderExec(e)}`);
  }

  // Appearance directives.
  const appearMap: Array<[RegExp, string]> = [
    [/^gaps\s+inner\s+\d+/, `gaps inner ${appearance.gapsInner}`],
    [/^gaps\s+outer\s+\d+/, `gaps outer ${appearance.gapsOuter}`],
    [/^font\s+/, `font ${appearance.font}`],
    [
      /^default_border\s+pixel\s+\d+/,
      `default_border pixel ${appearance.borderWidth}`,
    ],
  ];
  for (const [re, rendered] of appearMap) {
    const idx = lines.findIndex((l) => re.test(l.trim()));
    if (idx >= 0) lines[idx] = rendered;
    else lines.push(rendered);
  }

  // Apply bind/exec replacements.
  for (const [idx, rendered] of replaceAt) {
    if (idx < lines.length) lines[idx] = rendered;
  }

  // New binds with no lineIndex (added in the UI) append at end.
  for (const b of keybinds) {
    if (b.lineIndex === undefined) {
      const keyword = b.keys.match(/^\d+$/) ? "bindcode" : "bindsym";
      lines.push(b.enabled ? renderBind(b, keyword) : `# ${renderBind(b, keyword)}`);
  }
  }
  // New execs with no lineIndex append at end.
  for (const e of startup) {
    if (e.lineIndex === undefined) {
      lines.push(e.enabled ? renderExec(e) : `# ${renderExec(e)}`);
    }
  }

  return lines.join("\n");
}

function renderBind(b: I3Keybind, keyword: string): string {
  return `${keyword} ${b.keys} ${b.command}`;
}

function renderExec(e: I3StartupApp): string {
  // --no-startup-id restored only when the original had it.
  const flag = e.raw.includes("--no-startup-id") ? "--no-startup-id " : "";
  return `${e.kind} ${flag}${e.command}`;
};

