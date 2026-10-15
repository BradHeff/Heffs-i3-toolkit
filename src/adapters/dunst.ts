// dunst adapter: INI format, section-aware, comment-preserving. The tab
// edits notification appearance and behaviour; unknown keys ride along.

import { parseIni, serializeIni, getValue, setValue, sections, type IniFile } from "./ini";

export type { IniFile };

export interface DunstSettings {
  font: string;
  width: number;
  height: number;
  offset: string;
  origin: string;
  transparency: number;
  frameWidth: number;
  frameColor: string;
  gapSize: number;
  cornerRadius: number;
  timeout: number;
}

export interface DunstModel {
  settings: DunstSettings;
  sections: string[];
}

const S = "global";

export function toModel(file: IniFile): DunstModel {
  return {
    settings: {
      font: getValue(file, S, "font") ?? "JetBrains Mono 10",
      width: Number(getValue(file, S, "width") ?? 300),
      height: Number(getValue(file, S, "height") ?? 100),
      offset: getValue(file, S, "offset") ?? "10x30",
      origin: getValue(file, S, "origin") ?? "top-right",
      transparency: Number(getValue(file, S, "transparency") ?? 0),
      frameWidth: Number(getValue(file, S, "frame_width") ?? 2),
      frameColor: getValue(file, S, "frame_color") ?? "#232B33",
      gapSize: Number(getValue(file, S, "gap_size") ?? 0),
      cornerRadius: Number(getValue(file, S, "corner_radius") ?? 0),
      timeout: Number(getValue(file, S, "timeout") ?? 5000),
    },
    sections: sections(file),
  };
}

export function fromModel(file: IniFile, model: DunstModel): IniFile {
  const s = model.settings;
  let f = file;
  f = setValue(f, S, "font", s.font);
  f = setValue(f, S, "width", String(s.width));
  f = setValue(f, S, "height", String(s.height));
  f = setValue(f, S, "offset", s.offset);
  f = setValue(f, S, "origin", s.origin);
  f = setValue(f, S, "transparency", String(s.transparency));
  f = setValue(f, S, "frame_width", String(s.frameWidth));
  f = setValue(f, S, "frame_color", s.frameColor);
  f = setValue(f, S, "gap_size", String(s.gapSize));
  f = setValue(f, S, "corner_radius", String(s.cornerRadius));
  f = setValue(f, S, "timeout", String(s.timeout));
  return f;
}

export function validateDunst(model: DunstModel): string[] {
  const errs: string[] = [];
  if (model.settings.font.trim() === "") errs.push("Font must not be empty.");
  if (model.settings.width < 50 || model.settings.width > 2000) {
    errs.push("Width must be between 50 and 2000 px.");
  }
  if (model.settings.timeout < 100 || model.settings.timeout > 600000) {
    errs.push("Timeout must be 100 ms to 10 minutes.");
  }
  return errs;
}

export const DUNST_DEFAULT_PATH = "~/.config/dunst/dunstrc";

export const defaults = (): string =>
`[global]
font = JetBrains Mono 10
width = 300
height = 100
offset = 10x30
origin = top-right
transparency = 0
frame_width = 2
frame_color = #232B33
gap_size = 0
corner_radius = 2
timeout = 5000

[urgency_low]
timeout = 3000

[urgency_normal]
timeout = 5000

[urgency_critical]
timeout = 0
`;

export const parse = parseIni;
export const serialize = serializeIni;
