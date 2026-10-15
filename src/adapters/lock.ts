// i3lock-color adapter: edits ONLY the i3lock invocation flags inside a
// lock script. Anything it cannot parse fails loudly; the rest of the
// script is preserved byte-for-byte.

export interface LockFlag {
  /** Flag name without leading dashes, e.g. "insidever-color". */
  name: string;
  /** Raw value text, "" for bare flags. */
  value: string;
}

export interface LockInvocation {
  /** Original full text of the invocation lines, preserved when untouched. */
  raw: string;
  /** Parsed flags; user edits happen here. */
  flags: LockFlag[];
  /** Line indices of the whole invocation in the script. */
  startLine: number;
  endLine: number;
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
    let ok = true;
    for (let t = 1; t < tokens.length; t++) {
      const tok = tokens[t];
      if (tok === ";" || tok === "&&" || tok === "||") break; // separator
      if (!tok.startsWith("--")) {
        ok = false; // positional/unknown token: fail loudly, never guess
        break;
      }
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags.push({ name: body.slice(0, eq), value: body.slice(eq + 1) });
      } else if (t + 1 < tokens.length && !tokens[t + 1].startsWith("-")) {
        flags.push({ name: body, value: tokens[++t] });
      } else {
        flags.push({ name: body, value: "" });
      }
    }
    if (!ok) continue;

    invocation = {
      raw: lines.slice(startLine, endLine + 1).join("\n"),
      flags,
      startLine,
      endLine,
    };
    break;
  }

  return { raw, lines, invocation };
}

/** Render flags back to a continuation-style i3lock command line. */
function renderFlags(flags: LockFlag[]): string {
  const rendered = flags.map((f) =>
    f.value === "" ? `--${f.name}` : `--${f.name}=${f.value}`
  );
  if (rendered.length === 0) return "i3lock";
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
  out.push(line);
  return out.join("\n");
}

/**
 * Rebuild the script with the edited invocation. Untouched lines outside
 * [startLine, endLine] are preserved byte-for-byte.
 */
export function serializeLock(file: LockFile, invocation: LockInvocation): string {
  const lines = [...file.lines];
  const replacement = renderFlags(invocation.flags);
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

const COLOR_FLAGS: Record<string, keyof Omit<LockSettings, "timeout">> = {
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
};

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
    if (key) (s[key] as string) = f.value;
    else if (f.name === "font" || f.name === "time-font" || f.name === "date-font") s.font = f.value;
    else if (f.name === "timeout" || f.name === "t") s.timeout = Number(f.value) || 0;
  }
  return s;
}

/** Merge settings back onto the flag list; unknown flags ride along. */
export function applySettings(inv: LockInvocation, s: LockSettings): LockInvocation {
  const inverse: Partial<Record<keyof LockSettings, string>> = {
    insideColor: "inside-color",
    ringColor: "ring-color",
    keyhlColor: "keyhl-color",
    bshlColor: "bshl-color",
    verifColor: "insidever-color",
    wrongColor: "insidewrong-color",
    timeColor: "time-color",
    dateColor: "date-color",
    font: "time-font",
    timeout: "timeout",
  };
  const wanted = new Map<string, string>();
  for (const [k, flagName] of Object.entries(inverse)) {
    if (k === "timeout") {
      if (s.timeout > 0) wanted.set(flagName!, String(s.timeout));
    } else {
      wanted.set(flagName!, String(s[k as keyof LockSettings]));
    }
  }
  const seen = new Set<string>();
  const flags = inv.flags
    .map((f) => {
      if (wanted.has(f.name)) {
        seen.add(f.name);
        return { ...f, value: wanted.get(f.name)! };
      }
      return f;
    })
    // Also map canonical spellings that differ from the file's variant.
    .map((f) => {
      const key = COLOR_FLAGS[f.name];
      const canonical = key ? inverse[key] : undefined;
      if (canonical && wanted.has(canonical) && !seen.has(canonical)) {
        seen.add(canonical);
        return { name: canonical, value: wanted.get(canonical)! };
      }
      return f;
    });
  // Append any wanted flags the script did not have yet, keeping order.
  for (const [name, value] of wanted) {
    if (!seen.has(name)) flags.push({ name, value });
  }
  return { ...inv, flags };
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
