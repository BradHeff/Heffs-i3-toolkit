// Greeter tab: LightDM GTK greeter theme, background and indicators
// over the staged-edit pipeline. Other sections ride along untouched.

import { useCallback } from "react";
import { Box, FormControlLabel, Paper, Switch, TextField } from "@mui/material";
import StagedTabShell, { SectionTitle } from "./StagedTabShell";
import { useStagedConfig } from "../lib/useStagedConfig";
import * as greeter from "../adapters/greeter";

type File = { ini: greeter.IniFile; model: greeter.GreeterModel };

function parse(text: string): File {
  const ini = greeter.parse(text);
  return { ini, model: greeter.toModel(ini) };
}

function serialize(file: File): string {
  return greeter.serialize(greeter.fromModel(file.ini, file.model));
}

function validate(file: File): string[] {
  return greeter.validateGreeter(file.model);
}

export default function GreeterTab() {
  const api = useStagedConfig<File>({
    targetKey: "greeter",
    format: "ini",
    defaultPath: greeter.GREETER_DEFAULT_PATH,
    parse,
    serialize,
    validate,
  });

  const update = useCallback(
    (patch: Partial<greeter.GreeterSettings>) => {
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

  if (!api.file) return <StagedTabShell targetKey="greeter" api={api} children={null} />;

  const s = api.file.model.settings;

  return (
    <StagedTabShell targetKey="greeter" api={api}>
      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Theme" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            label="Theme name"
            value={s.themeName}
            onChange={(e) => update({ themeName: e.target.value })}
            sx={{ minWidth: 200 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="Icon theme"
            value={s.iconThemeName}
            onChange={(e) => update({ iconThemeName: e.target.value })}
            sx={{ minWidth: 200 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="Font"
            value={s.fontName}
            onChange={(e) => update({ fontName: e.target.value })}
            sx={{ minWidth: 200 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Background and clock" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
          <TextField
            label="Background"
            value={s.background}
            onChange={(e) => update({ background: e.target.value })}
            sx={{ minWidth: 320 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={s.userBackground}
                onChange={(e) => update({ userBackground: e.target.checked })}
                inputProps={{ "aria-label": "Use user background" }}
              />
            }
            label="User background"
          />
          <TextField
            label="Clock format"
            value={s.clockFormat}
            onChange={(e) => update({ clockFormat: e.target.value })}
            sx={{ minWidth: 140 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="Screensaver timeout (min)"
            type="number"
            value={s.screensaverTimeout}
            onChange={(e) => update({ screensaverTimeout: Number(e.target.value) })}
            sx={{ minWidth: 200 }}
          />
        </Box>
      </Paper>
    </StagedTabShell>
  );
}
