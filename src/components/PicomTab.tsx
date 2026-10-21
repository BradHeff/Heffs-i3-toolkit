// picom tab: compositor backend, shadows, fading and rounded corners
// over the staged-edit pipeline. Unknown keys and wintype blocks ride along.

import { useCallback } from "react";
import { Box, FormControlLabel, MenuItem, Paper, Switch, TextField } from "@mui/material";
import StagedTabShell, { SectionTitle } from "./StagedTabShell";
import { useStagedConfig } from "../lib/useStagedConfig";
import * as picom from "../adapters/picom";
import NumberField from "./NumberField";

type File = { ini: picom.IniFile; model: picom.PicomModel };

function parse(text: string): File {
  const ini = picom.parse(text);
  return { ini, model: picom.toModel(ini) };
}

function serialize(file: File): string {
  return picom.serialize(picom.fromModel(file.ini, file.model));
}

function validate(file: File): string[] {
  return picom.validatePicom(file.model);
}

export default function PicomTab() {
  const api = useStagedConfig<File>({
    targetKey: "picom",
    format: "conf",
    defaultPath: picom.PICOM_DEFAULT_PATH,
    parse,
    serialize,
    validate,
  });

  const update = useCallback(
    (patch: Partial<picom.PicomSettings>) => {
      api.setFile(
        (f) =>
          f && {
            ini: f.ini,
            model: { ...f.model, settings: { ...f.model.settings, ...patch } },
          }
      );
    },
    [api]
  );

  if (!api.file) return <StagedTabShell targetKey="picom" api={api} children={null} />;

  const s = api.file.model.settings;

  return (
    <StagedTabShell targetKey="picom" api={api}>
      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Backend" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          <TextField
            select
            label="Backend"
            value={s.backend}
            onChange={(e) =>
              update({ backend: e.target.value as picom.PicomSettings["backend"] })
            }
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="glx">glx</MenuItem>
            <MenuItem value="xrender">xrender</MenuItem>
            <MenuItem value="egl">egl</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={s.vsync}
                onChange={(e) => update({ vsync: e.target.checked })}
                slotProps={{ input: { "aria-label": "vsync" } }}
              />
            }
            label="vsync"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={s.detectRoundedCorners}
                onChange={(e) => update({ detectRoundedCorners: e.target.checked })}
                slotProps={{ input: { "aria-label": "detect rounded corners" } }}
              />
            }
            label="detect-rounded-corners"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={s.glxNoStencil}
                onChange={(e) => update({ glxNoStencil: e.target.checked })}
                slotProps={{ input: { "aria-label": "glx-no-stencil" } }}
              />
            }
            label="glx-no-stencil"
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Shadows" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={s.shadow}
                onChange={(e) => update({ shadow: e.target.checked })}
                slotProps={{ input: { "aria-label": "shadows" } }}
              />
            }
            label="Enabled"
          />
          <NumberField
            label="Radius (px)"
            value={s.shadowRadius}
            onChange={(v) => update({ shadowRadius: v })}
            sx={{ minWidth: 120 }}
          />
          <NumberField
            label="Offset X"
            value={s.shadowOffsets[0]}
            onChange={(v) =>
              update({
                shadowOffsets: [v, s.shadowOffsets[1]],
              })
            }
            sx={{ minWidth: 110 }}
          />
          <NumberField
            label="Offset Y"
            value={s.shadowOffsets[1]}
            onChange={(v) =>
              update({
                shadowOffsets: [s.shadowOffsets[0], v],
              })
            }
            sx={{ minWidth: 110 }}
          />
          <NumberField
            label="Opacity (0 to 1)"
            value={s.shadowOpacity}
            onChange={(v) => update({ shadowOpacity: v })}
            sx={{ minWidth: 150 }}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Fading and corners" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={s.fading}
                onChange={(e) => update({ fading: e.target.checked })}
                slotProps={{ input: { "aria-label": "fading" } }}
              />
            }
            label="Enabled"
          />
          <NumberField
            label="Corner radius (px)"
            value={s.cornerRadius}
            onChange={(v) => update({ cornerRadius: v })}
            sx={{ minWidth: 150 }}
          />
          <NumberField
            label="Fade delta (ms)"
            value={s.fadeDelta}
            onChange={(v) => update({ fadeDelta: v })}
            sx={{ minWidth: 140 }}
          />
          <TextField
            label="Fade steps"
            value={s.fadeSteps}
            onChange={(e) => update({ fadeSteps: e.target.value })}
            sx={{ minWidth: 140 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
        </Box>
      </Paper>
    </StagedTabShell>
  );
}
