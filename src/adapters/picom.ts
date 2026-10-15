// picom adapter: flat key = value conf. The tab edits the core settings;
// unknown keys and wintype/other blocks ride along untouched.

import { parseIni, serializeIni, getValue, setValue, type IniFile } from "./ini";

export type { IniFile };

export interface PicomSettings {
  backend: "glx" | "xrender" | "egl";
  vsync: boolean;
  detectRoundedCorners: boolean;
  glxNoStencil: boolean;
  cornerRadius: number;
  shadow: boolean;
  shadowRadius: number;
  shadowOffsets: [number, number]; // x, y
  shadowOpacity: number; // 0..1
  fading: boolean;
  fadeDelta: number;
  fadeSteps: string; // picom takes two numbers, kept as text
}

export interface PicomModel {
  settings: PicomSettings;
}

const S = ""; // picom's top level has no section header

export function toModel(file: IniFile): PicomModel {
  return {
    settings: {
      backend: (getValue(file, S, "backend") ?? "glx") as PicomSettings["backend"],
      vsync: (getValue(file, S, "vsync") ?? "true") === "true",
      detectRoundedCorners:
        (getValue(file, S, "detect-rounded-corners") ?? "true") === "true",
      glxNoStencil: (getValue(file, S, "glx-no-stencil") ?? "true") === "true",
      cornerRadius: Number(getValue(file, S, "corner-radius") ?? 0),
      shadow: (getValue(file, S, "shadow") ?? "true") === "true",
      shadowRadius: Number(getValue(file, S, "shadow-radius") ?? 7),
      shadowOffsets: [
        Number(getValue(file, S, "shadow-offset-x") ?? -7),
        Number(getValue(file, S, "shadow-offset-y") ?? -7),
      ],
      shadowOpacity: Number(getValue(file, S, "shadow-opacity") ?? 0.6),
      fading: (getValue(file, S, "fading") ?? "true") === "true",
      fadeDelta: Number(getValue(file, S, "fade-delta") ?? 5),
      fadeSteps: getValue(file, S, "fade-steps") ?? "0.028 0.03",
    },
  };
}

export function fromModel(file: IniFile, model: PicomModel): IniFile {
  const s = model.settings;
  let f = file;
  f = setValue(f, S, "backend", s.backend);
  f = setValue(f, S, "vsync", s.vsync ? "true" : "false");
  f = setValue(f, S, "detect-rounded-corners", s.detectRoundedCorners ? "true" : "false");
  f = setValue(f, S, "glx-no-stencil", s.glxNoStencil ? "true" : "false");
  f = setValue(f, S, "corner-radius", String(s.cornerRadius));
  f = setValue(f, S, "shadow", s.shadow ? "true" : "false");
  f = setValue(f, S, "shadow-radius", String(s.shadowRadius));
  f = setValue(f, S, "shadow-offset-x", String(s.shadowOffsets[0]));
  f = setValue(f, S, "shadow-offset-y", String(s.shadowOffsets[1]));
  f = setValue(f, S, "shadow-opacity", s.shadowOpacity.toFixed(2));
  f = setValue(f, S, "fading", s.fading ? "true" : "false");
  f = setValue(f, S, "fade-delta", String(s.fadeDelta));
  f = setValue(f, S, "fade-steps", s.fadeSteps);
  return f;
}

export function validatePicom(model: PicomModel): string[] {
  const errs: string[] = [];
  if (!["glx", "xrender", "egl"].includes(model.settings.backend)) {
    errs.push("Backend must be glx, xrender or egl.");
  }
  if (model.settings.cornerRadius < 0 || model.settings.cornerRadius > 50) {
    errs.push("Corner radius must be between 0 and 50 px.");
  }
  if (model.settings.shadowOpacity < 0 || model.settings.shadowOpacity > 1) {
    errs.push("Shadow opacity must be between 0 and 1.");
  }
  return errs;
}

export const PICOM_DEFAULT_PATH = "~/.config/picom/picom.conf";

export const defaults = (): string =>
`backend = "glx"
vsync = true
detect-rounded-corners = true
glx-no-stencil = true
corner-radius = 4
shadow = true
shadow-radius = 7
shadow-offset-x = -7
shadow-offset-y = -7
shadow-opacity = 0.60
fading = true
fade-delta = 5
fade-steps = 0.028 0.03
`;

export const parse = parseIni;
export const serialize = serializeIni;
