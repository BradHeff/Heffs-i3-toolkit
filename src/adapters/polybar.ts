// Polybar adapter: typed view over the INI engine. The tab edits bar
// settings and module lists; unknown keys ride along untouched.

import {
  parseIni,
  serializeIni,
  getValue,
  setValue,
  parseList,
  sections,
  type IniFile,
} from "./ini";

export type { IniFile };

export interface PolybarBarSettings {
  position: "top" | "bottom";
  height: number;
  width: string; // "100%" or "1900px" style; kept as text, validated
  background: string;
  foreground: string;
  modulesLeft: string[];
  modulesCenter: string[];
  modulesRight: string[];
  font0: string;
}

export interface PolybarModule {
  name: string; // section name after "module/"
  type: string | null;
  enabled: boolean; // referenced from any modules-* list
}

export interface PolybarModel {
  bar: string; // the [bar/*] section in use
  bars: string[];
  settings: PolybarBarSettings;
  modules: PolybarModule[];
}

export function findBarSection(file: IniFile): string {
  const bars = sections(file).filter((s) => s.startsWith("bar/"));
  return bars[0] ?? "bar/main";
}

export function toModel(file: IniFile, barOverride?: string): PolybarModel {
  const bar = barOverride ?? findBarSection(file);
  const modules = sections(file)
    .filter((s) => s.startsWith("module/"))
    .map((s) => ({
      name: s.slice("module/".length),
      type: getValue(file, s, "type"),
      enabled: false,
    }));
  const referenced = new Set([
    ...parseList(getValue(file, bar, "modules-left")),
    ...parseList(getValue(file, bar, "modules-center")),
    ...parseList(getValue(file, bar, "modules-right")),
  ]);
  for (const m of modules) if (referenced.has(m.name)) m.enabled = true;

  const settings: PolybarBarSettings = {
    position: (getValue(file, bar, "bottom") === "true" ? "bottom" : "top"),
    height: Number(getValue(file, bar, "height") ?? 24),
    width: getValue(file, bar, "width") ?? "100%",
    background: getValue(file, bar, "background") ?? "#161B21",
    foreground: getValue(file, bar, "foreground") ?? "#E9EDF1",
    modulesLeft: parseList(getValue(file, bar, "modules-left")),
    modulesCenter: parseList(getValue(file, bar, "modules-center")),
    modulesRight: parseList(getValue(file, bar, "modules-right")),
    font0: getValue(file, bar, "font-0") ?? "JetBrains Mono:size=9;0",
  };
  return { bar, bars: sections(file).filter((s) => s.startsWith("bar/")), settings, modules };
}

/** Apply the typed model back onto the INI file (staged; never touches disk). */
export function fromModel(file: IniFile, model: PolybarModel): IniFile {
  const bar = model.bar;
  let f = setValue(file, bar, "bottom", model.settings.position === "bottom" ? "true" : "false");
  f = setValue(f, bar, "height", String(model.settings.height));
  f = setValue(f, bar, "width", model.settings.width);
  f = setValue(f, bar, "background", model.settings.background);
  f = setValue(f, bar, "foreground", model.settings.foreground);
  f = setValue(f, bar, "font-0", model.settings.font0);
  f = setValue(f, bar, "modules-left", model.settings.modulesLeft.join(" "));
  f = setValue(f, bar, "modules-center", model.settings.modulesCenter.join(" "));
  f = setValue(f, bar, "modules-right", model.settings.modulesRight.join(" "));
  return f;
}

export function validate(model: PolybarModel): string[] {
  const errs: string[] = [];
  if (model.settings.height < 10 || model.settings.height > 200) {
    errs.push("Bar height must be between 10 and 200 px.");
  }
  if (!/^\d+(px|%)$/.test(model.settings.width)) {
    errs.push('Width must look like "100%" or "1900px".');
  }
  for (const key of ["background", "foreground"] as const) {
    const v = model.settings[key];
    if (!/^#[0-9A-Fa-f]{3,8}$|^rgba?\(/.test(v)) {
      errs.push(`${key} must be a #RRGGBB(AA) or rgba() colour.`);
    }
  }
  const dupes = new Set<string>();
  for (const list of [
    model.settings.modulesLeft,
    model.settings.modulesCenter,
    model.settings.modulesRight,
  ]) {
    for (const m of list) {
      if (dupes.has(m)) errs.push(`Module ${m} appears in more than one slot.`);
      dupes.add(m);
    }
  }
  return errs;
}

export const defaults = (): string =>
  `[bar/main]
bottom = false
height = 24
width = 100%
background = #161B21
foreground = #E9EDF1
font-0 = JetBrains Mono:size=9;0
modules-left = i3 workspace window
modules-center = date
modules-right = pulseaudio memory cpu

[module/i3]
type = internal/i3

[module/date]
type = internal/date
date = %H:%M

[module/pulseaudio]
type = internal/pulseaudio

[module/memory]
type = internal/memory

[module/cpu]
type = internal/cpu
`;

export const parse = parseIni;
export const serialize = serializeIni;
