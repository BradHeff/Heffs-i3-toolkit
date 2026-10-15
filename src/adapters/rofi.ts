// rofi adapter: rasi is CSS-like but not CSS. Pragmatic parser for a
// `configuration { ... }` block. Anything unexpected fails loudly.

export interface RasiProperty {
  name: string;
  value: string;
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
    properties.push({ name: m[1], value: m[2].replace(/;$/, "").trim() });
  }

  return { raw, lines, properties, configStart, configEnd };
}

export function serializeRasi(file: RasiFile): string {
  const lines = [...file.lines];
  const body = file.properties.map((p) => `    ${p.name}: ${p.value};`);
  const replacement = ["configuration {", ...body, "}"];
  lines.splice(file.configStart, file.configEnd - file.configStart + 1, ...replacement);
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
  const get = (n: string) => file.properties.find((p) => p.name === n)?.value ?? null;
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
    const idx = props.findIndex((p) => p.name === name);
    if (idx >= 0) props[idx] = { ...props[idx], value };
    else props.push({ name, value });
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
