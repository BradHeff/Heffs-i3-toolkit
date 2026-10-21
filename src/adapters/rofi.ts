// rofi adapter: rasi is CSS-like but not CSS. Pragmatic parser for a
// `configuration { ... }` block. Anything unexpected fails loudly.

export interface RasiProperty {
  name: string;
  value: string;
  /** Quote char the original value carried; re-applied on rewrite. */
  quote?: '"' | "'";
  /** Line index inside the file; undefined for UI-added properties. */
  lineIndex?: number;
  /** Indent of the original line, preserved when regenerating. */
  indent: number;
  /** Parsed original value; a line is rewritten only when it changed. */
  origValue: string;
  /** Parsed original name; renaming rewrites the line. */
  origName?: string;
  /** UI removal marker; serialize deletes the line. */
  removed?: boolean;
}

export interface RasiFile {
  raw: string;
  lines: string[];
  /** Properties inside the configuration block, in file order. */
  properties: RasiProperty[];
  /** Line index of the `configuration {` opener. */
  configStart: number;
  /** Line index of the matching `}`. */
  configEnd: number;
}

const PROP_RE = /^([A-Za-z0-9_-]+)\s*:\s*(.+?);?$/;

export function parseRasi(raw: string): RasiFile {
  const lines = raw.split("\n");
  let configStart = -1;
  let configEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "configuration {") {
      configStart = i;
      break;
    }
  }
  if (configStart < 0) {
    throw new Error(
      "No configuration { } block found. Add one or manage this file by hand."
    );
  }

  // Find the matching close brace by depth counting.
  let depth = 1;
  for (let j = configStart + 1; j < lines.length; j++) {
    const lt = lines[j].trim();
    if (lt.endsWith("{")) depth++;
    if (lt.startsWith("}")) {
      depth--;
      if (depth === 0) {
        configEnd = j;
        break;
      }
    }
  }
  if (configEnd < 0) {
    throw new Error("configuration block is missing its closing brace.");
  }

  const properties: RasiProperty[] = [];
  for (let i = configStart + 1; i < configEnd; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) continue;
    if (t.startsWith("@")) continue; // directives are preserved as-is via lines
    const m = PROP_RE.exec(t);
    if (!m) throw new Error(`Unparseable line inside configuration block: "${t}"`);
    let value = m[2].replace(/;$/, "").trim();
    // Values are written quoted in rasi: `font: "JetBrains Mono 10";`.
    // Strip quotes on parse so the UI shows and edits the bare value,
    // then re-apply on rewrite.
    let quote: '"' | "'" | undefined;
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      quote = '"';
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      quote = "'";
      value = value.slice(1, -1);
    }
    properties.push({
      name: m[1],
      value,
      quote,
      lineIndex: i,
      indent: lines[i].length - lines[i].trimStart().length,
      origValue: value,
      origName: m[1],
    });
  }

  return { raw, lines, properties, configStart, configEnd };
}

export function serializeRasi(file: RasiFile): string {
  const lines = [...file.lines];
  const kept = file.properties.filter((p) => !p.removed);

  for (const p of kept) {
    if (p.lineIndex === undefined) continue;
    const changed = p.value !== p.origValue || p.name !== p.origName;
    if (!changed) continue; // untouched property lines survive byte-for-byte
    const v = p.quote ? `${p.quote}${p.value}${p.quote}` : p.value;
    lines[p.lineIndex] = `${" ".repeat(p.indent)}${p.name}: ${v};`;
  }
  // UI-added properties append just before the closing brace.
  const added = kept.filter((p) => p.lineIndex === undefined);
  if (added.length > 0) {
    const insertAt = file.configEnd;
    const rendered = added.map((p) => `    ${p.name}: ${p.quote ? `${p.quote}${p.value}${p.quote}` : p.value};`);
    lines.splice(insertAt, 0, ...rendered);
  }
  // Removed properties: blank their original line, then strip trailing
  // blank lines inside the block so the close brace does not drift up.
  for (const p of file.properties) {
    if (p.removed && p.lineIndex !== undefined) {
      lines[p.lineIndex] = "";
    }
  }
  if (file.properties.some((p) => p.removed && p.lineIndex !== undefined)) {
    for (let i = file.configEnd - 1; i > file.configStart; i--) {
      if (lines[i].trim() === "") lines.splice(i, 1);
      else break;
    }
  }
  return lines.join("\n");
}

export interface RofiSettings {
  modi: string;
  font: string;
  showIcons: boolean;
  displayDrun: string;
  drunDisplayFormat: string;
}

export function toSettings(file: RasiFile): RofiSettings {
  const get = (n: string) =>
    file.properties.find((p) => !p.removed && (p.name === n || p.origName === n))
      ?.value ?? null;
  return {
    modi: get("modi") ?? "window,run,ssh,drun",
    font: get("font") ?? "JetBrains Mono 10",
    showIcons: (get("show-icons") ?? "false") === "true",
    displayDrun: get("display-drun") ?? "run",
    drunDisplayFormat: get("drun-display-format") ?? "{name}",
  };
}

export function applySettings(file: RasiFile, s: RofiSettings): RasiFile {
  const wanted: Array<[string, string]> = [
    ["modi", s.modi],
    ["font", s.font],
    ["show-icons", s.showIcons ? "true" : "false"],
    ["display-drun", s.displayDrun],
    ["drun-display-format", s.drunDisplayFormat],
  ];
  const props = [...file.properties];
  for (const [name, value] of wanted) {
    const idx = props.findIndex(
      (p) => p.name === name || p.origName === name
    );
    if (idx >= 0) {
      if (props[idx].removed) {
        // The user removed the property row: keep it removed rather than
        // resurrecting it from the typed fields.
        continue;
      }
      props[idx] = { ...props[idx], value };
    } else
      props.push({
        name,
        value,
        quote: '"',
        lineIndex: undefined,
        indent: 4,
        origValue: value,
        origName: name,
      });
  }
  return { ...file, properties: props };
}

export function validateRofi(s: RofiSettings): string[] {
  const errs: string[] = [];
  if (!s.modi.trim()) errs.push("modi must not be empty.");
  if (!s.font.trim()) errs.push("font must not be empty.");
  return errs;
}

export const ROFI_DEFAULT_PATH = "~/.config/rofi/config.rasi";
