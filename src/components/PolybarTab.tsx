// Polybar tab: bar geometry, colours, fonts and module slots over the
// staged-edit pipeline. Modules defined in the file get enable toggles;
// module ordering follows the modules-left/center/right lists.

import { useCallback, useMemo } from "react";
import {
  Box,
  Chip,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import StagedTabShell, { SectionTitle } from "./StagedTabShell";
import NumberField from "./NumberField";
import { useStagedConfig } from "../lib/useStagedConfig";
import * as polybar from "../adapters/polybar";

type File = { ini: polybar.IniFile; model: polybar.PolybarModel };

function parse(text: string): File {
  const ini = polybar.parse(text);
  return { ini, model: polybar.toModel(ini) };
}

function serialize(file: File): string {
  return polybar.serialize(polybar.fromModel(file.ini, file.model));
}

function validate(file: File): string[] {
  return polybar.validate(file.model);
}

export default function PolybarTab() {
  const api = useStagedConfig<File>({
    targetKey: "polybar",
    format: "ini",
    defaultPath: "~/.config/polybar/config.ini",
    parse,
    serialize,
    validate,
  });

  const updateSettings = useCallback(
    (patch: Partial<polybar.PolybarBarSettings>) => {
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

  // A module may occupy several slots at once (e.g. a border module on both
  // ends), so each slot is toggled independently.
  const toggleSlot = useCallback(
    (name: string, slot: "left" | "center" | "right", on: boolean) => {
      api.setFile((f) => {
        if (!f) return f;
        const key =
          slot === "left" ? "modulesLeft" : slot === "center" ? "modulesCenter" : "modulesRight";
        const list = f.model.settings[key];
        const next = on
          ? list.includes(name)
            ? list
            : [...list, name]
          : list.filter((n) => n !== name);
        return {
          ini: f.ini,
          model: { ...f.model, settings: { ...f.model.settings, [key]: next } },
        };
      });
    },
    [api]
  );

  const file = api.file;
  const activeBarName = file?.model.bar ?? "bar/main";

  const barSelector = useMemo(() => {
    if (!file || file.model.bars.length <= 1) return null;
    return (
      <TextField
        select
        label="Bar"
        value={activeBarName}
        onChange={(e) => {
          const bar = e.target.value;
          api.setFile(
            (f) =>
              f && {
                ini: f.ini,
                model: polybar.toModel(f.ini, bar),
              }
          );
        }}
        sx={{ minWidth: 160 }}
      >
        {file.model.bars.map((b) => (
          <MenuItem key={b} value={b}>
            {b}
          </MenuItem>
        ))}
      </TextField>
    );
  }, [file, activeBarName, api]);

  if (!file) return <StagedTabShell targetKey="polybar" api={api} children={null} />;

  const s = file.model.settings;

  return (
    <StagedTabShell targetKey="polybar" api={api}>
      <Paper sx={{ p: 2 }}>
        <SectionTitle
          title="Bar"
          action={
            barSelector ?? (
              <Chip size="small" label={activeBarName} variant="outlined" />
            )
          }
        />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            select
            label="Position"
            value={s.position}
            onChange={(e) =>
              updateSettings({
                position: e.target.value as polybar.PolybarBarSettings["position"],
              })
            }
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="top">top</MenuItem>
            <MenuItem value="bottom">bottom</MenuItem>
          </TextField>
          <NumberField
            label="Height (px)"
            value={s.height}
            min={0}
            onChange={(v) => updateSettings({ height: v })}
            sx={{ minWidth: 110 }}
          />
          <TextField
            label="Width"
            value={s.width}
            onChange={(e) => updateSettings({ width: e.target.value })}
            sx={{ minWidth: 110 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="Font 0"
            value={s.font0}
            onChange={(e) => updateSettings({ font0: e.target.value })}
            sx={{ minWidth: 220 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Colours" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <ColorField
            label="Background"
            value={s.background}
            onChange={(v) => updateSettings({ background: v })}
          />
          <ColorField
            label="Foreground"
            value={s.foreground}
            onChange={(v) => updateSettings({ foreground: v })}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ px: 2, pt: 1.5 }}>
          <SectionTitle title="Modules" />
        </Box>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table stickyHeader size="small" aria-label="Polybar modules">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">On</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>L / C / R</TableCell>
                <TableCell>Position</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {file.model.modules.map((m) => {
                const inLeft = s.modulesLeft.includes(m.name);
                const inCenter = s.modulesCenter.includes(m.name);
                const inRight = s.modulesRight.includes(m.name);
                return (
                  <TableRow key={m.name} hover>
                    <TableCell padding="checkbox">
                      <Switch
                        size="small"
                        checked={inLeft || inCenter || inRight}
                        onChange={(e) => {
                          // Master toggle: switching off clears every slot;
                          // switching on places it in the left list if it
                          // had none, leaving existing slots untouched.
                          if (e.target.checked) {
                            if (!inLeft && !inCenter && !inRight) toggleSlot(m.name, "left", true);
                          } else {
                            toggleSlot(m.name, "left", false);
                            toggleSlot(m.name, "center", false);
                            toggleSlot(m.name, "right", false);
                          }
                        }}
                        slotProps={{ input: { "aria-label": `Enable module ${m.name}` } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        {m.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {m.type ?? "custom"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1.5 }}>
                        {(["left", "center", "right"] as const).map((slot) => {
                          const on =
                            slot === "left"
                              ? inLeft
                              : slot === "center"
                                ? inCenter
                                : inRight;
                          return (
                            <Switch
                              key={slot}
                              size="small"
                              checked={on}
                              onChange={(e) => toggleSlot(m.name, slot, e.target.checked)}
                              slotProps={{ input: { "aria-label": `Module ${m.name} in ${slot}` } }}
                            />
                          );
                        })}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {[
                          inLeft ? `left:${s.modulesLeft.indexOf(m.name) + 1}` : null,
                          inCenter ? `center:${s.modulesCenter.indexOf(m.name) + 1}` : null,
                          inRight ? `right:${s.modulesRight.indexOf(m.name) + 1}` : null,
                        ]
                          .filter(Boolean)
                          .join("  ")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </StagedTabShell>
  );

}

export function ColorField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextField
      label={props.label}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      sx={{ minWidth: 150 }}
      slotProps={{
        htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
      }}
    />
  );
}
