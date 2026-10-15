// LightDM GTK greeter adapter: GTK INI flavor. Keys live in the
// [greeter] section; other sections and comments ride along untouched.

import { parseIni, serializeIni, getValue, setValue, type IniFile } from "./ini";

export type { IniFile };

export interface GreeterSettings {
  background: string;
  themeName: string;
  iconThemeName: string;
  fontName: string;
  clockFormat: string;
  indicators: string;
  userBackground: boolean;
  screensaverTimeout: number; // minutes, 0 = off
}

export interface GreeterModel {
  settings: GreeterSettings;
}

const SECTION = "greeter";

export function toModel(file: IniFile): GreeterModel {
  return {
    settings: {
      background: getValue(file, SECTION, "background") ?? "",
      themeName: getValue(file, SECTION, "theme-name") ?? "Adwaita-dark",
      iconThemeName: getValue(file, SECTION, "icon-theme-name") ?? "Papirus-Dark",
      fontName: getValue(file, SECTION, "font-name") ?? "Space Grotesk 11",
      clockFormat: getValue(file, SECTION, "clock-format") ?? "%H:%M",
      indicators: getValue(file, SECTION, "indicators") ?? "",
      userBackground: (getValue(file, SECTION, "user-background") ?? "false") === "true",
      screensaverTimeout: Number(getValue(file, SECTION, "screensaver-timeout") ?? 0),
    },
  };
}

export function fromModel(file: IniFile, model: GreeterModel): IniFile {
  const s = model.settings;
  let f = file;
  f = setValue(f, SECTION, "background", s.background);
  f = setValue(f, SECTION, "theme-name", s.themeName);
  f = setValue(f, SECTION, "icon-theme-name", s.iconThemeName);
  f = setValue(f, SECTION, "font-name", s.fontName);
  f = setValue(f, SECTION, "clock-format", s.clockFormat);
  f = setValue(f, SECTION, "indicators", s.indicators);
  f = setValue(f, SECTION, "user-background", s.userBackground ? "true" : "false");
  f = setValue(f, SECTION, "screensaver-timeout", String(s.screensaverTimeout));
  return f;
}

export function validateGreeter(model: GreeterModel): string[] {
  const errs: string[] = [];
  if (!model.settings.themeName.trim()) errs.push("Theme name must not be empty.");
  if (!model.settings.fontName.trim()) errs.push("Font name must not be empty.");
  if (model.settings.screensaverTimeout < 0 || model.settings.screensaverTimeout > 120) {
    errs.push("Screensaver timeout must be 0 to 120 minutes.");
  }
  return errs;
}

export const GREETER_DEFAULT_PATH = "/etc/lightdm/lightdm-gtk-greeter.conf";

export const defaults = (): string =>
`[greeter]
background=/usr/share/backgrounds/default.png
theme-name=Adwaita-dark
icon-theme-name=Papirus-Dark
font-name=Space Grotesk 11
clock-format=%H:%M
screensaver-timeout=2
indicators=~host;~spacer;~clock;~spacer;~session;~language;~a11y;~power
`;

export const parse = parseIni;
export const serialize = serializeIni;
