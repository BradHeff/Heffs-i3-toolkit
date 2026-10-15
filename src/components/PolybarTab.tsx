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

  const toggleModule = useCallback(
    (name: string, enabled: boolean) => {
      api.setFile(
        (f) =>
          f && {
            ini: f.ini,
            model: {
              ...f.model,
              settings: {
                ...f.model.settings,
                modulesLeft: listWith(f.model.settings.modulesLeft, name, enabled),
                modulesCenter: listWith(f.model.settings.modulesCenter, name, enabled),
                modulesRight: listWith(f.model.settings.modulesRight, name, enabled),
              },
            },
          }
      );
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
          <TextField
            label="Height (px)"
            type="number"
            value={s.height}
            onChange={(e) => updateSettings({ height: Number(e.target.value) })}
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
                <TableCell>Slot</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {file.model.modules.map((m) => {
                const slot = s.modulesLeft.includes(m.name)
                  ? "left"
                  : s.modulesCenter.includes(m.name)
                    ? "center"
                    : s.modulesRight.includes(m.name)
                      ? "right"
                      : "off";
                return (
                  <TableRow key={m.name} hover>
                    <TableCell padding="checkbox">
                      <Switch
                        size="small"
                        checked={m.enabled}
                        onChange={(e) => toggleModule(m.name, e.target.checked)}
                        inputProps={{ "aria-label": `Enable module ${m.name}` }}
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
                      <TextField
                        select
                        value={slot}
                        onChange={(e) => moveModule(m.name, e.target.value)}
                        sx={{ minWidth: 110 }}
                      >
                        <MenuItem value="off">off</MenuItem>
                        <MenuItem value="left">left</MenuItem>
                        <MenuItem value="center">center</MenuItem>
                        <MenuItem value="right">right</MenuItem>
                      </TextField>
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

  function moveModule(name: string, slot: string) {
    api.setFile(
      (f) => {
        if (!f) return f;
        const clean = {
          modulesLeft: f.model.settings.modulesLeft.filter((n) => n !== name),
          modulesCenter: f.model.settings.modulesCenter.filter((n) => n !== name),
          modulesRight: f.model.settings.modulesRight.filter((n) => n !== name),
        };
        if (slot === "left") clean.modulesLeft.push(name);
        if (slot === "center") clean.modulesCenter.push(name);
        if (slot === "right") clean.modulesRight.push(name);
        return {
          ini: f.ini,
          model: { ...f.model, settings: { ...f.model.settings, ...clean } },
        };
      }
    );
  }
}

function listWith(list: string[], name: string, enabled: boolean): string[] {
  if (enabled) return list.includes(name) ? list : [...list, name];
  return list.filter((n) => n !== name);
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
