// dunst tab: notification geometry, colours and timing over the
// staged-edit pipeline. Unknown keys and urgency sections ride along.

import { useCallback } from "react";
import { Box, Paper, TextField, Typography } from "@mui/material";
import StagedTabShell, { SectionTitle } from "./StagedTabShell";
import { useStagedConfig } from "../lib/useStagedConfig";
import * as dunst from "../adapters/dunst";
import { ColorField } from "./PolybarTab";

type File = { ini: dunst.IniFile; model: dunst.DunstModel };

function parse(text: string): File {
  const ini = dunst.parse(text);
  return { ini, model: dunst.toModel(ini) };
}

function serialize(file: File): string {
  return dunst.serialize(dunst.fromModel(file.ini, file.model));
}

function validate(file: File): string[] {
  return dunst.validateDunst(file.model);
}

export default function DunstTab() {
  const api = useStagedConfig<File>({
    targetKey: "dunst",
    format: "ini",
    defaultPath: dunst.DUNST_DEFAULT_PATH,
    parse,
    serialize,
    validate,
  });

  const update = useCallback(
    (patch: Partial<dunst.DunstSettings>) => {
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

  if (!api.file) return <StagedTabShell targetKey="dunst" api={api} children={null} />;

  const s = api.file.model.settings;

  return (
    <StagedTabShell targetKey="dunst" api={api}>
      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Appearance" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            label="Font"
            value={s.font}
            onChange={(e) => update({ font: e.target.value })}
            sx={{ minWidth: 220 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <ColorField
            label="Frame colour"
            value={s.frameColor}
            onChange={(v) => update({ frameColor: v })}
          />
          <TextField
            label="Corner radius (px)"
            type="number"
            value={s.cornerRadius}
            onChange={(e) => update({ cornerRadius: Number(e.target.value) })}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label="Transparency (%)"
            type="number"
            value={s.transparency}
            onChange={(e) => update({ transparency: Number(e.target.value) })}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label="Frame width (px)"
            type="number"
            value={s.frameWidth}
            onChange={(e) => update({ frameWidth: Number(e.target.value) })}
            sx={{ minWidth: 150 }}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Geometry" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            label="Width (px)"
            type="number"
            value={s.width}
            onChange={(e) => update({ width: Number(e.target.value) })}
            sx={{ minWidth: 120 }}
          />
          <TextField
            label="Height (px)"
            type="number"
            value={s.height}
            onChange={(e) => update({ height: Number(e.target.value) })}
            sx={{ minWidth: 120 }}
          />
          <TextField
            label="Offset (e.g. 10x30)"
            value={s.offset}
            onChange={(e) => update({ offset: e.target.value })}
            sx={{ minWidth: 130 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="Origin"
            value={s.origin}
            onChange={(e) => update({ origin: e.target.value })}
            sx={{ minWidth: 140 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="Gap size (px)"
            type="number"
            value={s.gapSize}
            onChange={(e) => update({ gapSize: Number(e.target.value) })}
            sx={{ minWidth: 130 }}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Timing" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            label="Timeout (ms)"
            type="number"
            value={s.timeout}
            onChange={(e) => update({ timeout: Number(e.target.value) })}
            sx={{ minWidth: 150 }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
          Per-urgency timeouts in [urgency_low] and friends ride along untouched.
        </Typography>
      </Paper>
    </StagedTabShell>
  );
}
