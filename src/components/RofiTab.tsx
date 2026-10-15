// rofi tab: launcher settings over the rasi configuration block, plus a
// raw property list for anything the typed fields do not cover.

import { useCallback } from "react";
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import StagedTabShell, { SectionTitle } from "./StagedTabShell";
import { useStagedConfig } from "../lib/useStagedConfig";
import {
  applySettings,
  parseRasi,
  serializeRasi,
  toSettings,
  validateRofi,
  type RasiFile,
  type RofiSettings,
} from "../adapters/rofi";

type File = { rasi: RasiFile; settings: RofiSettings };

function parse(text: string): File {
  const rasi = parseRasi(text);
  return { rasi, settings: toSettings(rasi) };
}

function serialize(file: File): string {
  return serializeRasi(applySettings(file.rasi, file.settings));
}

function validate(file: File): string[] {
  return validateRofi(file.settings);
}

export default function RofiTab() {
  const api = useStagedConfig<File>({
    targetKey: "rofi",
    format: "rasi",
    defaultPath: "~/.config/rofi/config.rasi",
    parse,
    serialize,
    validate,
  });

  const update = useCallback(
    (patch: Partial<RofiSettings>) => {
      api.setFile(
        (f) => f && { rasi: f.rasi, settings: { ...f.settings, ...patch } }
      );
    },
    [api]
  );

  if (!api.file) return <StagedTabShell targetKey="rofi" api={api} children={null} />;

  const s = api.file.settings;

  return (
    <StagedTabShell targetKey="rofi" api={api}>
      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Launcher" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            label="modi"
            value={s.modi}
            onChange={(e) => update({ modi: e.target.value })}
            sx={{ minWidth: 240 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="Font"
            value={s.font}
            onChange={(e) => update({ font: e.target.value })}
            sx={{ minWidth: 200 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={s.showIcons}
                onChange={(e) => update({ showIcons: e.target.checked })}
                inputProps={{ "aria-label": "Show icons" }}
              />
            }
            label="Show icons"
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="drun display" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            label="display-drun"
            value={s.displayDrun}
            onChange={(e) => update({ displayDrun: e.target.value })}
            sx={{ minWidth: 140 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
          <TextField
            label="drun-display-format"
            value={s.drunDisplayFormat}
            onChange={(e) => update({ drunDisplayFormat: e.target.value })}
            sx={{ minWidth: 260 }}
            slotProps={{
              htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
            }}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ px: 2, pt: 1.5 }}>
          <SectionTitle
            title="All properties"
            action={
              <Button startIcon={<AddIcon />} onClick={addProp} size="small">
                Add
              </Button>
            }
          />
        </Box>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table stickyHeader size="small" aria-label="rofi properties">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Value</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {api.file.rasi.properties.map((p, i) => (
                <TableRow key={`${p.name}-${i}`} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {p.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={p.value}
                      onChange={(e) =>
                        api.setFile(
                          (f) =>
                            f && {
                              rasi: {
                                ...f.rasi,
                                properties: f.rasi.properties.map((q, j) =>
                                  j === i ? { ...q, value: e.target.value } : q
                                ),
                              },
                              settings: f.settings,
                            }
                        )
                      }
                      fullWidth
                      slotProps={{
                        htmlInput: { style: { fontFamily: '"JetBrains Mono", monospace' } },
                      }}
                    />
                  </TableCell>
                  <TableCell padding="checkbox">
                    <Tooltip title="Remove property">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() =>
                            api.setFile(
                              (f) =>
                                f && {
                                  rasi: {
                                    ...f.rasi,
                                    properties: f.rasi.properties.filter((_, j) => j !== i),
                                  },
                                  settings: f.settings,
                                }
                            )
                          }
                          aria-label={`Remove property ${p.name}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </StagedTabShell>
  );

  function addProp() {
    api.setFile(
      (f) =>
        f && {
          rasi: {
            ...f.rasi,
            properties: [...f.rasi.properties, { name: "new-property", value: "" }],
          },
          settings: f.settings,
        }
    );
  }
}
