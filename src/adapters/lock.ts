// i3lock-color adapter: edits ONLY the i3lock invocation flags inside a
// lock script. Anything it cannot parse fails loudly; the rest of the
// script is preserved byte-for-byte.

export interface LockFlag {
  /** Flag name without leading dashes, e.g. "insidever-color". */
  name: string;
  /** Raw value text, "" for bare flags. */
  value: string;
  /** Value as parsed from the script; undefined for UI-appended flags.
   *  When every flag still matches its original, serializeLock returns
   *  the script byte-for-byte instead of reflowing it. */
  origValue?: string;
}

export interface LockInvocation {
  /** Original full text of the invocation lines, preserved when untouched. */
  raw: string;
  /** Parsed flags; user edits happen here. */
  flags: LockFlag[];
  /** Everything after ; && || on the invocation line, preserved verbatim. */
  tail: string;
  /** Snapshot of the parsed flags. serializeLock compares the full list
   *  against it, so a REMOVED flag (not just a changed value) also
   *  forces a rewrite instead of silently reverting to the original. */
  origFlags?: LockFlag[];
  /** Line indices of the whole invocation in the script. */
  startLine: number;
  endLine: number;
  /** Set when the invocation was found but could not be safely parsed. */
  parseError?: string;
}

export interface LockFile {
  raw: string;
  lines: string[];
  /** Null when no parseable i3lock invocation was found. */
  invocation: LockInvocation | null;
}

/** Shell-style tokenizer: quotes group, unterminated quotes fail. */
function tokenize(s: string): string[] | null {
  const out: string[] = [];
  let cur = "";
  let have = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") {
      const close = s.indexOf(c, i + 1);
      if (close < 0) return null;
      cur += s.slice(i + 1, close);
      i = close + 1;
      have = true;
      continue;
    }
    if (c === " " || c === "\t") {
      if (have) out.push(cur);
      cur = "";
      have = false;
      i++;
      continue;
    }
    cur += c;
    have = true;
    i++;
  }
  if (have) out.push(cur);
  return out;
}

export function parseLock(raw: string): LockFile {
  const lines = raw.split("\n");
  let invocation: LockInvocation | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!/(^|\s|;)i3lock(\s|$)/.test(trimmed)) continue;
    if (/\bi3lock(-color|wrapper|next|r)\b/.test(trimmed)) continue;

    // Gather the full invocation, following backslash continuations.
    const startLine = i;
    let endLine = i;
    const parts: string[] = [];
    let cur = trimmed;
    while (true) {
      const cont = /\\\s*$/.test(cur);
      parts.push(cur.replace(/\\\s*$/, ""));
      if (!cont) break;
      endLine++;
      if (endLine >= lines.length) break;
      cur = lines[endLine].trim();
    }

    const tokens = tokenize(parts.join(" "));
    if (!tokens || tokens[0] !== "i3lock") continue; // not a plain call; skip

    const flags: LockFlag[] = [];
    // Everything after the first ; && || separator is preserved verbatim
    // and re-emitted after the flags, so commands like
    // `i3lock --color=000000 && xset dpms force off` never lose their tail.
    let tail = "";
    let ok = true;
    for (let t = 1; t < tokens.length; t++) {
      const tok = tokens[t];
      if (tok === ";" || tok === "&&" || tok === "||") {
        // Re-join the remaining tokens with single spaces; the tail is
        // outside the modeled flag set, so exact whitespace is not
        // modeled, but the COMMANDS themselves must survive an edit.
        tail = tokens.slice(t + 1).join(" ");
        break;
      }
      if (/^-[a-zA-Z]/.test(tok)) {
        ok = false; // short flag not modeled; fail loudly, never guess
        break;
      }
      if (!tok.startsWith("--")) {
        ok = false; // positional/token: fail loudly, never guess
        break;
      }
      if (tok === "-t" || tok.startsWith("-t") || tok.length === 2) {
        ok = false; // short flags are not modeled; fail loudly, never guess
        break;
      }
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags.push({ name: body.slice(0, eq), value: body.slice(eq + 1), origValue: body.slice(eq + 1) });
      } else if (t + 1 < tokens.length && !tokens[t + 1].startsWith("-")) {
        flags.push({ name: body, value: tokens[++t], origValue: tokens[t] });
      } else {
        flags.push({ name: body, value: "", origValue: "" });
      }
    }
    // Fail loudly, never guess: an unparseable i3lock line must NOT make
    // the adapter silently adopt a later plain invocation instead; that
    // would edit the wrong line and (with tail preservation) rewrite it.
    if (!ok) {
      return {
        raw,
        lines,
        invocation: { raw: lines.slice(startLine, endLine + 1).join("\n"), flags: [], tail: "", startLine, endLine, parseError: "unsupported i3lock invocation (short flags or positional tokens); edit the script by hand" },
      };
    }

    invocation = {
      raw: lines.slice(startLine, endLine + 1).join("\n"),
      flags,
      origFlags: flags.map((f) => ({ ...f })),
      tail,
      startLine,
      endLine,
    };
    break;
  }

  return { raw, lines, invocation };
}

/** Render flags back to a continuation-style i3lock command line,
 *  with the preserved tail (commands after ; && ||) re-attached. */
function renderFlags(flags: LockFlag[], tail: string): string {
  const rendered = flags.map((f) =>
    f.value === "" ? `--${f.name}` : `--${f.name}=${f.value}`
  );
  if (rendered.length === 0 && !tail) return "i3lock";
  // Wrap at ~70 chars with backslash continuations, keeping it readable.
  const out: string[] = [];
  let line = "i3lock";
  for (const r of rendered) {
    if (line.length + r.length + 1 > 70 && line !== "i3lock") {
      out.push(line + " \\");
      line = "    " + r;
    } else {
      line += " " + r;
    }
  }
  // Re-attach the preserved tail on the final line, matching how the
  // separator was found (`--color=000000 && xset dpms force off`).
  if (tail) line += ` && ${tail}`;
  out.push(line);
  return out.join("\n");
}

/**
 * Rebuild the script with the edited invocation. Untouched lines outside
 * [startLine, endLine] are preserved byte-for-byte.
 */
export function serializeLock(file: LockFile, invocation: LockInvocation): string {
  // Untouched invocation: emit the original text byte-for-byte rather
  // than reflowing it through renderFlags.
  // Untouched = same flag list (same names in the same order, same
  // values) as parsed. Comparing against the origFlags snapshot, not
  // per-flag origValue, so a REMOVED flag also forces the rewrite.
  const orig = invocation.origFlags;
  const untouched =
    orig !== undefined &&
    orig.length === invocation.flags.length &&
    orig.every(
      (f, i) =>
        invocation.flags[i].name === f.name &&
        invocation.flags[i].value === f.value
    );
  if (untouched) return file.lines.join("\n");

  const lines = [...file.lines];
  const replacement = renderFlags(invocation.flags, invocation.tail ?? "");
  lines.splice(
    invocation.startLine,
    invocation.endLine - invocation.startLine + 1,
    ...replacement.split("\n")
  );
  return lines.join("\n");
}

export interface LockSettings {
  insideColor: string;
  ringColor: string;
  keyhlColor: string;
  bshlColor: string;
  verifColor: string;
  wrongColor: string;
  timeColor: string;
  dateColor: string;
  font: string;
  timeout: number; // seconds, from --timeout / -t; 0 = off
}

// Flags carrying colors, mapped to LockSettings keys. Where i3lock-color
// offers several spellings for one slot, all map to the same setting and
// applySettings updates every spelling present in the script.
const COLOR_FLAGS: Record<string, keyof Omit<LockSettings, "timeout" | "font">> = {
  "inside-color": "insideColor",
  "insidever-color": "verifColor",
  "ringver-color": "verifColor",
  "insidewrong-color": "wrongColor",
  "ringwrong-color": "wrongColor",
  "keyhl-color": "keyhlColor",
  "bshl-color": "bshlColor",
  "verif-text-color": "verifColor",
  "wrong-text-color": "wrongColor",
  "time-color": "timeColor",
  "date-color": "dateColor",
  "clock-color": "timeColor",
  "ring-color": "ringColor",
};

const FONT_FLAGS = ["font", "time-font", "date-font"];

/** Normalize a color for the settings model: prefix "#" when missing so
 *  script-style hex (161B21) passes validation; quotes stripped. */
function normalizeColor(v: string): string {
  const t = v.replace(/^["']|["']$/g, "").trim();
  if (/^[0-9A-Fa-f]{3,8}$/.test(t)) return `#${t}`;
  return t.startsWith("#") ? t : `#${t}`;
}

export function toSettings(inv: LockInvocation): LockSettings {
  const s: LockSettings = {
    insideColor: "#00000000",
    ringColor: "#161B21",
    keyhlColor: "#7FB4E8",
    bshlColor: "#E5534B",
    verifColor: "#7FB4E8",
    wrongColor: "#E5534B",
    timeColor: "#E9EDF1",
    dateColor: "#93A1AE",
    font: "JetBrains Mono",
    timeout: 0,
  };
  for (const f of inv.flags) {
    const key = COLOR_FLAGS[f.name];
    if (key) (s[key] as string) = normalizeColor(f.value);
    else if (FONT_FLAGS.includes(f.name)) s.font = f.value;
    else if (f.name === "timeout") s.timeout = Number(f.value) || 0;
  }
  return s;
}

/** Merge settings back onto the flag list; unknown flags ride along. */
export function applySettings(inv: LockInvocation, s: LockSettings): LockInvocation {
  const slotFlags: Partial<Record<keyof LockSettings, string[]>> = {
    insideColor: ["inside-color"],
    ringColor: ["ring-color"],
    keyhlColor: ["keyhl-color"],
    bshlColor: ["bshl-color"],
    verifColor: ["insidever-color", "ringver-color", "verif-text-color"],
    wrongColor: ["insidewrong-color", "ringwrong-color", "wrong-text-color"],
    timeColor: ["time-color", "clock-color"],
    dateColor: ["date-color"],
  };

  const flags = inv.flags.map((f) => {
    const settingKey = COLOR_FLAGS[f.name];
    if (!settingKey) {
      // Font: update whichever spelling the script uses, keep its name.
      if (FONT_FLAGS.includes(f.name)) return { ...f, value: s.font };
      return f;
    }
    return { ...f, value: String(s[settingKey]) };
  });

  // Track which settings already have a flag in the script.
  const covered = new Set<string>();
  for (const f of flags) {
    const k = COLOR_FLAGS[f.name];
    if (k) covered.add(k);
    else if (FONT_FLAGS.includes(f.name)) covered.add("font");
  }

  // Append wanted flags the script did not have, using canonical names.
  const append: LockFlag[] = [];
  for (const [k, spellings] of Object.entries(slotFlags)) {
    if (!spellings || covered.has(k)) continue;
    append.push({ name: spellings[0], value: String(s[k as keyof LockSettings]) });
  }
  if (!covered.has("font")) append.push({ name: "time-font", value: s.font });
  if (s.timeout > 0) {
    if (!flags.some((f) => f.name === "timeout")) {
      append.push({ name: "timeout", value: String(s.timeout) });
    }
  } else {
    // Timeout off (0): drop the flag entirely rather than write timeout=0.
    const kept = flags.filter((f) => f.name !== "timeout");
    return { ...inv, flags: [...kept, ...append] };
  }

  return { ...inv, flags: [...flags, ...append] };
}

export function validateLock(s: LockSettings): string[] {
  const errs: string[] = [];
  const colorRe = /^#[0-9A-Fa-f]{8}$|^#[0-9A-Fa-f]{6}$/;
  const colorKeys: (keyof LockSettings)[] = [
    "insideColor",
    "ringColor",
    "keyhlColor",
    "bshlColor",
    "verifColor",
    "wrongColor",
    "timeColor",
    "dateColor",
  ];
  for (const k of colorKeys) {
    if (!colorRe.test(String(s[k]))) errs.push(`${k} must be #RRGGBB or #RRGGBBAA.`);
  }
  if (s.timeout < 0 || s.timeout > 600) errs.push("Timeout must be 0 to 600 seconds.");
  if (!s.font.trim()) errs.push("Font must not be empty.");
  return errs;
}

export const LOCK_DEFAULT_PATH = "/usr/local/bin/lock";
