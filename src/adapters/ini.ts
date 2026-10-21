// Generic INI engine: parse into a line model that preserves comments,
// blank lines and unknown keys byte-for-byte, so serialize() only rewrites
// the entries the user actually changed. Shared by polybar, dunst,
// greeter (gtk-ini) and picom (sectionless conf).

export interface IniEntry {
  id: string;
  section: string; // "" for sectionless keys (picom)
  key: string;
  value: string; // value text WITHOUT any trailing inline comment
  inline?: string; // trailing inline comment incl. its marker, e.g. "; fmt"
  raw: string; // original line, used verbatim when untouched
  enabled: boolean; // false = commented out
  // Quote character the original value carried, e.g. `frame_color = "#161B21"`.
  // Re-applied on rewrite so edits keep the file's quoting style.
  quote?: '"' | "'";
  // picom-style statement terminator: `vsync = true;`
  semi?: boolean;
  // Exact separator between key and value (greeter uses `key=value`,
  // dunst/polybar `key = value`). Re-applied on rewrite.
  sep?: string;
  // Parsed originals: a line is regenerated only when the user actually
  // changed its value or enabled state, so untouched formatting survives.
  origValue: string;
  origEnabled: boolean;
  origInline?: string;
  lineIndex?: number;
}

export interface IniFile {
  lines: string[]; // raw file lines, mutated only where entries changed
  entries: IniEntry[];
}

let seq = 0;
const nextId = () => `ini-${Date.now()}-${seq++}`;

const ENTRY_RE = /^(\s*)(#|;)?\s*([A-Za-z0-9_.-]+)(\s*=\s*)(.*)$/;

// A trailing inline comment needs whitespace before the marker so values
// like polybar's font-0 "Nerd Font:pixelsize=10;2" stay intact.
const INLINE_RE = /\s([#;]\s.*)$/;

/** Parse INI text. Section headers are `[name]`; comments start with # or ;. */
export function parseIni(text: string): IniFile {
  const lines = text.split("\n");
  const entries: IniEntry[] = [];
  let section = "";
  // Brace depth, so picom-style `wintype { shadow = false; }` blocks are
  // skipped: their inner keys ride along byte-for-byte instead of
  // colliding with the top-level keys the model edits.
  let depth = 0;

  lines.forEach((line, i) => {
    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    const secMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (secMatch && depth === 0) {
      section = secMatch[1].trim();
      return;
    }
    // A key is captured only at depth 0 on a brace-free line.
    const m =
      depth === 0 && opens === 0 && closes === 0 ? line.match(ENTRY_RE) : null;
    if (!m) {
      depth = Math.max(0, depth + opens - closes);
      return;
    }
    const commented = Boolean(m[2]);
    // Split a trailing inline comment off the value.
    let value = m[5].trim();
    let inline: string | undefined;
    const im = value.match(INLINE_RE);
    if (im) {
      inline = im[1];
      value = value.slice(0, im.index).trim();
    }
    // picom-style trailing semicolon, and surrounding quotes on the value.
    let semi = false;
    if (/;$/.test(value)) {
      semi = true;
      value = value.slice(0, -1).trim();
    }
    let quote: '"' | "'" | undefined;
    if (/^".*"$/.test(value) && value.length >= 2) {
      quote = '"';
      value = value.slice(1, -1);
    } else if (/^'.*'$/.test(value) && value.length >= 2) {
      quote = "'";
      value = value.slice(1, -1);
    }
    entries.push({
      id: nextId(),
      section,
      key: m[3],
      sep: m[4],
      value,
      inline,
      quote,
      semi,
      raw: line,
      enabled: !commented,
      origValue: value,
      origEnabled: !commented,
      origInline: inline,
      lineIndex: i,
    });
    depth = Math.max(0, depth + opens - closes);
  });

  return { lines, entries };
}

/** Render a single entry line, preserving its comment marker. */
function renderEntry(e: IniEntry): string {
  const indent = (e.raw.match(/^\s*/) ?? [""])[0];
  const marker = e.raw.trimStart().startsWith(";") ? ";" : "#";
  const v = e.quote ? `${e.quote}${e.value}${e.quote}` : e.value;
  const terminated = e.semi ? `${v};` : v;
  const eq = e.sep ?? " = ";
  const body = e.enabled
    ? `${e.key}${eq}${terminated}`
    : `${marker} ${e.key}${eq}${terminated}`;
  return e.inline ? `${indent}${body} ${e.inline}` : `${indent}${body}`;
}

/** Serialize back. Only lines whose entry was edited are regenerated. */
export function serializeIni(file: IniFile): string {
  const out = [...file.lines];

  for (const e of file.entries) {
    if (e.lineIndex === undefined) continue; // UI-added; handled below
    const changed =
      e.value !== e.origValue || e.enabled !== e.origEnabled || e.inline !== e.origInline;
    if (!changed) continue; // untouched line survives byte-for-byte
    out[e.lineIndex] = renderEntry(e);
  }

  // UI-added entries append into their section (or file end when sectionless).
  const added = file.entries.filter((e) => e.lineIndex === undefined);
  for (const e of added) {
    // Inherit the section's separator style so appended keys do not
    // mix `key = value` into a `key=value` file (greeter) or vice versa.
    const sep = e.sep ?? " = ";
    const rendered = e.enabled
      ? `${e.key}${sep}${e.value}`
      : `# ${e.key}${sep}${e.value}`;
    let insertAt = out.length;
    if (e.section) {
      const start = out.findIndex((l) => l.trim() === `[${e.section}]`);
      if (start >= 0) {
        insertAt = start + 1;
        while (insertAt < out.length && !/^\s*\[/.test(out[insertAt])) {
          // Stop before trailing blank lines at the section's end so new
          // keys stay grouped with their section, not scattered after
          // the file's trailing newline.
          if (out[insertAt].trim() === "" && insertAt > start + 1) break;
          insertAt++;
        }
      }
    }
    out.splice(insertAt, 0, rendered);
  }

  return out.join("\n");
}

/**
 * Read a value (section + key). With duplicate keys the LAST enabled
 * occurrence wins, matching how polybar and dunst resolve overrides.
 * Returns null when absent or commented out.
 */
export function getValue(file: IniFile, section: string, key: string): string | null {
  let found: IniEntry | undefined;
  for (const e of file.entries) {
    if (e.section === section && e.key === key && e.enabled) found = e;
  }
  return found ? found.value : null;
}

/**
 * Set a value, creating the entry (and section header) when missing.
 * With duplicates, the last occurrence is updated. Editing a commented
 * entry updates its value but does NOT silently uncomment it; use
 * setEnabled for that.
 */
export function setValue(
  file: IniFile,
  section: string,
  key: string,
  value: string
): IniFile {
  // With duplicate keys, the LAST ENABLED occurrence is the effective
  // one (matching getValue and how polybar/dunst resolve overrides), and
  // it is the line that must be edited. A commented line must never
  // swallow the edit, and an active line must never be left stale while
  // a later commented duplicate receives the new value.
  let idx = -1;
  file.entries.forEach((x, i) => {
    if (x.section === section && x.key === key && x.enabled) idx = i;
  });
  if (idx < 0) {
    // No active occurrence: fall back to the last occurrence of any
    // state, so editing a commented key updates its own line instead of
    // duplicating it.
    file.entries.forEach((x, i) => {
      if (x.section === section && x.key === key) idx = i;
    });
  }
  if (idx >= 0) {
    const entries = [...file.entries];
    // Carry the original line's quote/semi/sep onto the new value so an
    // edit keeps the file's style: `frame_color = "#161B21"` stays
    // quoted, `vsync = true;` keeps its terminator, `key=value` stays
    // unspaced.
    entries[idx] = { ...entries[idx], value };
    return { ...file, entries };
  }
  // New entry: needs the section header line if it is not present yet.
  let lines = file.lines;
  const hasHeader =
    section === "" || lines.some((l) => l.trim() === `[${section}]`);
  if (!hasHeader) {
    // Do not double up blank lines when the file already ends with one
    // (a trailing newline produces a final "" element after split).
    const endsBlank = lines.length === 0 || lines[lines.length - 1] === "";
    lines = endsBlank
      ? [...lines, `[${section}]`]
      : [...lines, "", `[${section}]`];
  }
  // Copy the section's separator style (greeter: `key=value`, dunst:
  // `key = value`) so appended keys do not mix conventions.
  const sep =
    file.entries.find((e) => e.section === section && e.sep)?.sep ?? " = ";
  const entries = [
    ...file.entries,
    {
      id: nextId(),
      section,
      key,
      value,
      raw: "",
      enabled: true,
      origValue: "\u0000", // never matches: always rendered as new
      origEnabled: true,
      lineIndex: undefined,
      sep,
    },
  ];
  // NB: return the local `lines` (with the added section header), not
  // file.lines; spreading file after computing lines would drop it.
  return { ...file, lines, entries };
}

/** Toggle a key's enabled state (comment/uncomment, never delete). */
export function setEnabled(
  file: IniFile,
  id: string,
  enabled: boolean
): IniFile {
  return {
    ...file,
    entries: file.entries.map((e) => (e.id === id ? { ...e, enabled } : e)),
  };
}

/** List section names present in the file, in order. */
export function sections(file: IniFile): string[] {
  const out: string[] = [];
  for (const l of file.lines) {
    const m = l.match(/^\s*\[([^\]]+)\]\s*$/);
    if (m && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Parse a polybar-style space-separated list value ("modules-left" etc). */
export function parseList(value: string | null): string[] {
  return value ? value.trim().split(/\s+/).filter(Boolean) : [];
}
