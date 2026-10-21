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
      const noStartupId = /^--no-startup-id\b/.test(command);
      command = command.replace(/^--no-startup-id\s+/, "").trim();
      // note read from preceding comment line, if present
      const noteLine = lines[i - 1]?.trim().startsWith("# note:")
        ? lines[i - 1].trim()
        : null;
      const note = noteLine ? noteLine.replace(/^#\s*note:\s*/, "") : "";
      startup.push({
        id: nextId(),
        kind: kindWord,
        command,
        note,
        enabled,
        raw: line,
        lineIndex: i,
        noteLineIndex: noteLine ? i - 1 : undefined,
        noStartupId,
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
    const rendered = b.enabled
      ? ind + renderBind(b, keyword)
      : `${ind}# ${renderBind(b, keyword)}`;
    // Untouched lines are never rewritten: byte-for-byte preservation
    // even when the raw line's spacing differs from our render style.
    if (rendered !== lines[b.lineIndex]) replaceAt.set(b.lineIndex, rendered);
  }
  for (const e of startup) {
    if (e.lineIndex === undefined) continue;
    const ind = indentOf(e.lineIndex);
    const rendered = e.enabled
      ? ind + renderExec(e)
      : `${ind}# ${renderExec(e)}`;
    if (rendered !== lines[e.lineIndex]) replaceAt.set(e.lineIndex, rendered);
    // Note persistence: rewrite the "# note:" line above an edited exec.
    const noteRendered = e.note.trim() ? `${ind}# note: ${e.note.trim()}` : null;
    if (e.noteLineIndex !== undefined) {
      if (noteRendered) replaceAt.set(e.noteLineIndex, noteRendered);
      // An emptied note leaves the old line in place; blanking a comment
      // line is safe (it stays a comment) and keeps indices stable.
      else replaceAt.set(e.noteLineIndex, `${ind}#`);
    } else if (noteRendered) {
      // Note added via the UI to an existing entry: insert directly above.
      replaceAt.set(-1 - e.lineIndex, noteRendered); // sentinel handled below
    }
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

  // Apply bind/exec replacements. IN-PLACE replacements run FIRST while
  // the original line indices are still valid; note insertions (negative
  // sentinels) then splice in bottom-up so no insertion shifts another
  // entry's target. (Inserts first would write replacements one line off
  // for every entry below an inserted note line.)
  const noteInserts: Array<[number, string]> = [];
  for (const [idx, rendered] of replaceAt) {
    if (idx < 0) noteInserts.push([-1 - idx, rendered]);
  }
  // In-place replacements: original indices, guaranteed in range.
  for (const [idx, rendered] of replaceAt) {
    if (idx >= 0) lines[idx] = rendered;
  }
  // Then insertions, from the highest index down.
  noteInserts.sort((a, b) => b[0] - a[0]);
  for (const [idx, rendered] of noteInserts) {
    lines.splice(idx, 0, rendered);
  }

  // New binds with no lineIndex (added in the UI) go INSIDE their mode
  // block, just before its closing brace; main-mode binds append at EOF.
  const modeClose = new Map<string, number>();
  {
    const stack: string[] = ["main"];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const m = t.match(/^mode\s+"([^"]+)"\s*\{/);
      if (m) {
        stack.push(m[1]);
        continue;
      }
      if (t.startsWith("}") && stack.length > 1) {
        modeClose.set(stack.pop()!, i);
      }
    }
  }

  // Group new binds by mode, in model order, then insert each group just
  // before the closing brace of its mode block. Insert from the highest
  // line index down so earlier insertions do not shift later ones.
  const byMode = new Map<string, I3Keybind[]>();
  for (const b of keybinds) {
    if (b.lineIndex === undefined) {
      if (!byMode.has(b.mode)) byMode.set(b.mode, []);
      byMode.get(b.mode)!.push(b);
    }
  }
  const inserts: Array<[number, string[]]> = [];
  for (const [mode, binds] of byMode) {
    if (mode === "main" || !modeClose.has(mode)) continue;
    const rendered = binds.map((b) => {
      const keyword = b.keys.match(/^\d+$/) ? "bindcode" : "bindsym";
      return `    ${b.enabled ? "" : "# "}${renderBind(b, keyword)}`;
    });
    inserts.push([modeClose.get(mode)!, rendered]);
  }
  inserts.sort((a, b) => b[0] - a[0]);
  for (const [idx, rendered] of inserts) {
    lines.splice(idx, 0, ...rendered);
  }

  // Main-mode new binds and all new execs append at end of file.
  for (const b of byMode.get("main") ?? []) {
    const keyword = b.keys.match(/^\d+$/) ? "bindcode" : "bindsym";
    lines.push(b.enabled ? renderBind(b, keyword) : `# ${renderBind(b, keyword)}`);
  }
  for (const e of startup) {
    if (e.lineIndex === undefined) {
      // A note on a UI-added startup entry rides above the exec line.
      if (e.note.trim()) lines.push(`# note: ${e.note}`);
      lines.push(e.enabled ? renderExec(e) : `# ${renderExec(e)}`);
    }
  }

  return lines.join("\n");
}

function renderBind(b: I3Keybind, keyword: string): string {
  return `${keyword} ${b.keys} ${b.command}`;
}

function renderExec(e: I3StartupApp): string {
  const flag = e.noStartupId ? "--no-startup-id " : "";
  return `${e.kind} ${flag}${e.command}`;
};

