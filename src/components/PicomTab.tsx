// picom tab: compositor backend, shadows, fading and rounded corners
// over the staged-edit pipeline. Unknown keys and wintype blocks ride along.

import { useCallback } from "react";
import { Box, FormControlLabel, MenuItem, Paper, Switch, TextField } from "@mui/material";
import StagedTabShell, { SectionTitle } from "./StagedTabShell";
import { useStagedConfig } from "../lib/useStagedConfig";
import * as picom from "../adapters/picom";

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
                inputProps={{ "aria-label": "vsync" }}
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
                inputProps={{ "aria-label": "detect rounded corners" }}
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
                inputProps={{ "aria-label": "glx-no-stencil" }}
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
                inputProps={{ "aria-label": "shadows" }}
              />
            }
            label="Enabled"
          />
          <TextField
            label="Radius (px)"
            type="number"
            value={s.shadowRadius}
            onChange={(e) => update({ shadowRadius: Number(e.target.value) })}
            sx={{ minWidth: 120 }}
          />
          <TextField
            label="Offset X"
            type="number"
            value={s.shadowOffsets[0]}
            onChange={(e) =>
              update({
                shadowOffsets: [Number(e.target.value), s.shadowOffsets[1]],
              })
            }
            sx={{ minWidth: 110 }}
          />
          <TextField
            label="Offset Y"
            type="number"
        value={s.shadowOffsets[1]}
            onChange={(e) =>
              update({
                shadowOffsets: [s.shadowOffsets[0], Number(e.target.value)],
              })
            }
            sx={{ minWidth: 110 }}
          />
          <TextField
            label="Opacity (0 to 1)"
            type="number"
            value={s.shadowOpacity}
            onChange={(e) => update({ shadowOpacity: Number(e.target.value) })}
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
                inputProps={{ "aria-label": "fading" }}
              />
            }
            label="Enabled"
          />
          <TextField
            label="Corner radius (px)"
            type="number"
            value={s.cornerRadius}
            onChange={(e) => update({ cornerRadius: Number(e.target.value) })}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label="Fade delta (ms)"
            type="number"
            value={s.fadeDelta}
            onChange={(e) => update({ fadeDelta: Number(e.target.value) })}
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
