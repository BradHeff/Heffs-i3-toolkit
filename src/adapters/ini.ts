// Generic INI engine: parse into a line model that preserves comments,
// blank lines and unknown keys byte-for-byte, so serialize() only rewrites
// the entries the user actually changed. Shared by polybar, dunst,
// greeter (gtk-ini) and picom (sectionless conf).

export interface IniEntry {
  id: string;
  section: string; // "" for sectionless keys (picom)
  key: string;
  value: string;
  raw: string; // original line, used when untouched
  enabled: boolean; // false = commented out
  lineIndex?: number;
}

export interface IniFile {
  lines: string[]; // raw file lines, mutated only where entries changed
  entries: IniEntry[];
}

let seq = 0;
const nextId = () => `ini-${Date.now()}-${seq++}`;

const ENTRY_RE = /^(\s*)(#|;)?\s*([A-Za-z0-9_.-]+)\s*=\s*(.*)$/;

/** Parse INI text. Section headers are `[name]`; comments start with # or ;. */
export function parseIni(text: string): IniFile {
  const lines = text.split("\n");
  const entries: IniEntry[] = [];
  let section = "";

  lines.forEach((line, i) => {
    const secMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (secMatch) {
      section = secMatch[1].trim();
      return;
    }
    const m = line.match(ENTRY_RE);
    if (!m) return;
    const commented = Boolean(m[2]);
    // Preserve inline comment on the value.
    entries.push({
      id: nextId(),
      section,
      key: m[3],
      value: m[4].trim(),
      raw: line,
      enabled: !commented,
      lineIndex: i,
    });
  });

  return { lines, entries };
}

/** Serialize back. Only lines whose entry was edited are regenerated. */
export function serializeIni(file: IniFile): string {
  const out = [...file.lines];
  const used = new Set<number>();

  for (const e of file.entries) {
    if (e.lineIndex === undefined) continue; // UI-added; handled below
    if (used.has(e.lineIndex)) continue;
    const indent = (e.raw.match(/^\s*/) ?? [""])[0];
    const rendered = e.enabled
      ? `${indent}${e.key} = ${e.value}`
      : `${indent}# ${e.key} = ${e.value}`;
    // Preserve trailing inline comment from the original when present.
    const inline = e.raw.match(/\s(#|;)\s.*$/);
    out[e.lineIndex] = inline ? `${rendered} ${inline[0].trim()}` : rendered;
    used.add(e.lineIndex);
  }

  // UI-added entries append into their section (or file end when sectionless).
  const added = file.entries.filter((e) => e.lineIndex === undefined);
  for (const e of added) {
    const rendered = e.enabled ? `${e.key} = ${e.value}` : `# ${e.key} = ${e.value}`;
    let insertAt = out.length;
    if (e.section) {
      const start = out.findIndex((l) => l.trim() === `[${e.section}]`);
      if (start >= 0) {
        insertAt = start + 1;
        while (insertAt < out.length && !/^\s*\[/.test(out[insertAt])) insertAt++;
      }
    }
    out.splice(insertAt, 0, rendered);
  }

  return out.join("\n");
}

/** Read a value (section + key). Returns null when absent or commented out. */
export function getValue(file: IniFile, section: string, key: string): string | null {
  const e = file.entries.find((x) => x.section === section && x.key === key);
  return e && e.enabled ? e.value : null;
}

/** Set a value, creating the entry (and section header) when missing. */
export function setValue(
  file: IniFile,
  section: string,
  key: string,
  value: string
): IniFile {
  const idx = file.entries.findIndex(
    (x) => x.section === section && x.key === key
  );
  if (idx >= 0) {
    const entries = [...file.entries];
    const e = { ...entries[idx], value, enabled: true };
    entries[idx] = e;
    return { ...file, entries };
  }
  // New entry: needs the section header line if it is not present yet.
  let lines = file.lines;
  const hasHeader =
    section === "" || lines.some((l) => l.trim() === `[${section}]`);
  if (!hasHeader) {
    lines = [...lines, "", `[${section}]`];
  }
  const entries = [
    ...file.entries,
    { id: nextId(), section, key, value, raw: "", enabled: true },
  ];
  return { lines, entries };
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
