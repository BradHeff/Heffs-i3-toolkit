// NumberField: a numeric TextField that tolerates in-progress input.
// The raw TextField pattern Number(e.target.value) used across the tabs
// has two failure modes: clearing the field instantly writes 0 into the
// model, and "12a" becomes NaN which then serializes into the config.
// This component keeps a text draft while typing; empty or non-numeric
// drafts never reach the model. On blur the draft snaps back to the
// model value, so the field can never lie about what will be written.

import { useEffect, useState } from "react";
import { TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** Inclusive bounds; out-of-range drafts are not propagated. */
  min?: number;
  max?: number;
  sx?: SxProps<Theme>;
  ariaLabel?: string;
}

export default function NumberField(props: NumberFieldProps) {
  const { label, value, onChange, min, max, sx, ariaLabel } = props;
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // While not editing, follow the model (external refresh, apply, etc).
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const handleDraft = (raw: string) => {
    setDraft(raw);
    const t = raw.trim();
    if (t === "") return; // cleared mid-edit: keep model untouched
    const n = Number(t);
    if (!Number.isFinite(n)) return; // "12a": never propagate NaN
    if (min !== undefined && n < min) return;
    if (max !== undefined && n > max) return;
    onChange(n);
  };

  return (
    <TextField
      label={label}
      type="number"
      value={draft}
      onChange={(e) => handleDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setDraft(String(value));
      }}
      sx={sx}
      slotProps={{
        htmlInput: {
          inputMode: "numeric",
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        },
      }}
    />
  );
}
