// Lock tab: i3lock-color flag editing over the staged-edit pipeline.
// Only the i3lock invocation inside the script is touched; everything
// else is preserved byte-for-byte (adapter guarantee).

import { useCallback } from "react";
import { Box, Paper, TextField, Typography } from "@mui/material";
import NumberField from "./NumberField";
import StagedTabShell, { SectionTitle } from "./StagedTabShell";
import { useStagedConfig } from "../lib/useStagedConfig";
import {
  applySettings,
  parseLock,
  serializeLock,
  toSettings,
  validateLock,
  type LockFile,
  type LockSettings,
} from "../adapters/lock";
import { ColorField } from "./PolybarTab";

type File = { lock: LockFile; settings: LockSettings };

function parse(text: string): File {
  const lock = parseLock(text);
  if (!lock.invocation) {
    throw new Error(
      "No parseable i3lock invocation found in this script. The lock script is left untouched."
    );
  }
  return { lock, settings: toSettings(lock.invocation) };
}

function serialize(file: File): string {
  return serializeLock(file.lock, applySettings(file.lock.invocation!, file.settings));
}

function validate(file: File): string[] {
  return validateLock(file.settings);
}

const COLOR_KEYS: Array<[keyof LockSettings, string]> = [
  ["insideColor", "Inside"],
  ["ringColor", "Ring"],
  ["keyhlColor", "Key highlight"],
  ["bshlColor", "Backspace highlight"],
  ["verifColor", "Verify"],
  ["wrongColor", "Wrong"],
  ["timeColor", "Time"],
  ["dateColor", "Date"],
];

export default function LockTab() {
  const api = useStagedConfig<File>({
    targetKey: "lock",
    format: "shell",
    defaultPath: "/usr/local/bin/lock",
    parse,
    serialize,
    validate,
  });

  const update = useCallback(
    (patch: Partial<LockSettings>) => {
      api.setFile(
        (f) => f && { lock: f.lock, settings: { ...f.settings, ...patch } }
      );
    },
    [api]
  );

  if (!api.file) {
    return <StagedTabShell targetKey="lock" api={api} lockedPath children={null} />;
  }

  const s = api.file.settings;

  return (
    <StagedTabShell targetKey="lock" api={api} lockedPath>
      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Colours" />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {COLOR_KEYS.map(([key, label]) => (
            <ColorField
              key={key}
              label={label}
              value={String(s[key])}
              onChange={(v) => update({ [key]: v } as Partial<LockSettings>)}
            />
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
          Colours accept #RRGGBB or #RRGGBBAA. Unknown i3lock flags ride along untouched.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <SectionTitle title="Clock and timeout" />
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
          <NumberField
            label="Timeout (s, 0 = off)"
            value={s.timeout}
            min={0}
            onChange={(v) => update({ timeout: v })}
            sx={{ minWidth: 160 }}
          />
        </Box>
      </Paper>

      <Paper
        sx={{
          p: 0,
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ px: 2, pt: 1.5 }}>
          <SectionTitle title="Lock screen preview" />
        </Box>
        <Box
          sx={{
            position: "relative",
            height: 200,
            mx: 2,
            mb: 2,
            borderRadius: 1,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: () => {
                // Ring colour doubles as the backdrop wash.
                const hex = s.ringColor.replace("#", "");
                // Fallback mirrors the theme charcoal base token so the
                // preview backdrop matches the app when unset.
                const rgb = hex.length >= 6 ? hex.slice(0, 6) : "14171B";
                return `#${rgb}`;
              },
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 84,
              height: 84,
              borderRadius: "50%",
              border: "2px solid",
              borderColor: s.ringColor,
              bgcolor: s.insideColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                color: s.keyhlColor,
                fontSize: 28,
              }}
            >
              •
            </Typography>
          </Box>
          <Typography
            aria-hidden
            sx={{
              position: "absolute",
              bottom: 56,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: '"JetBrains Mono", monospace',
              color: s.timeColor,
              fontSize: 22,
            }}
          >
            21:47
          </Typography>
          <Typography
            aria-hidden
            sx={{
              position: "absolute",
              bottom: 36,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: '"JetBrains Mono", monospace',
              color: s.dateColor,
              fontSize: 13,
            }}
          >
            Wed 15 Oct
          </Typography>
          <Typography
            aria-hidden
            sx={{
              position: "absolute",
              bottom: 12,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: '"JetBrains Mono", monospace',
              color: s.verifColor,
              fontSize: 12,
            }}
          >
            verifying
          </Typography>
        </Box>
      </Paper>
    </StagedTabShell>
  );
}
