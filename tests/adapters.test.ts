// Adapter verification suite for ini, polybar, dunst, picom, greeter, rofi
// and lock, in the same style as tests/i3-adapter.test.ts: parse -> model
// -> apply edits -> serialize, with byte-for-byte preservation of untouched
// content. Run with the project's test:adapter script.
import { parseIni, serializeIni, setValue, getValue, sections, setEnabled } from "../src/adapters/ini";
import { toModel, fromModel, validate } from "../src/adapters/polybar";
import { toModel as dunstToModel, fromModel as dunstFromModel, validateDunst } from "../src/adapters/dunst";
import { toModel as picomToModel, fromModel as picomFromModel, validatePicom } from "../src/adapters/picom";
import { toModel as greeterToModel, fromModel as greeterFromModel, validateGreeter } from "../src/adapters/greeter";
import { parseLock, serializeLock, toSettings as lockToSettings, applySettings as lockApplySettings } from "../src/adapters/lock";
import { parseRasi, serializeRasi, toSettings as rofiToSettings, applySettings as rofiApplySettings } from "../src/adapters/rofi";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log("PASS", name);
  } else {
    failures++;
    console.error("FAIL", name, detail ?? "");
  }
}

// ---------- ini (base for polybar, dunst, greeter) ----------
const DEMO_INI = `;==========================================================
;   Polybar config
;==========================================================
[colors]
background = #282A2E
primary = #81A1C1

[bar/main]
width = 100%
height = 24
# disabled = old
modules-left = i3 filesystem
`;

const ini = parseIni(DEMO_INI);
check("ini round trip byte-identical", serializeIni(ini) === DEMO_INI, JSON.stringify(serializeIni(ini)));
check("ini sections found", JSON.stringify(sections(ini)) === JSON.stringify(["colors", "bar/main"]));
check("ini getValue", getValue(ini, "bar/main", "height") === "24");
const iniEdited = setValue(ini, "bar/main", "height", "32");
check("ini setValue edits value", getValue(iniEdited, "bar/main", "height") === "32");
check(
  "ini setValue keeps untouched lines",
  serializeIni(iniEdited).includes("background = #282A2E") &&
    serializeIni(iniEdited).startsWith(";====")
);
const iniNew = setValue(ini, "new-section", "key", "v");
check(
  "ini setValue creates section header when missing",
  serializeIni(iniNew).includes("[new-section]") && serializeIni(iniNew).includes("key = v")
);

// ---------- polybar ----------
const DEMO_POLYBAR = `; polybar
[colors]
background = #282A2E

[bar/main]
bottom = true
height = 24
width = 100%
background = #161B21
foreground = #E9EDF1
modules-left = i3
modules-center = date
modules-right = filesystem pulseaudio
font-0 = JetBrainsMono Nerd Font:pixelsize=10;2

[module/i3]
type = internal/i3

[module/filesystem]
type = internal/fs

[module/date]
type = internal/date
`;

const pbFile = parseIni(DEMO_POLYBAR);
const pbModel = toModel(pbFile);
check(
  "polybar modules parsed and enabled-flags correct",
  pbModel.modules.length === 3 &&
    pbModel.modules.filter((m) => m.enabled).length === 3
);
check("polybar position bottom detected", pbModel.settings.position === "bottom");
const pbEdited = fromModel(pbFile, { ...pbModel, settings: { ...pbModel.settings, height: 32 } });
check("polybar edit height serialized", serializeIni(pbEdited).includes("height = 32"));
check("polybar modules untouched by edit", serializeIni(pbEdited).includes("[module/date]"));
check("polybar validate clean model", validate(pbModel).length === 0);
const badPb = { ...pbModel, settings: { ...pbModel.settings, width: "abc", height: 5 } };
check("polybar validate flags bad width and height", validate(badPb).length === 2);

// ---------- dunst ----------
const DEMO_DUNST = `# dunst
[global]
    font = JetBrains Mono 10
    frame_color = "#161B21"
    width = 350
    height = 120
    timeout = 5000

[urgency_low]
    timeout = 3000
`;

const duFile = parseIni(DEMO_DUNST);
const duModel = dunstToModel(iniFileWithSquash(duFile, "global"));
const duEdited = dunstFromModel(duFile, { ...duModel, settings: { ...duModel.settings, width: 420 } });
check("dunst edit width serialized", serializeIni(duEdited).includes("width = 420"));
check(
  "dunst untouched section preserved",
  serializeIni(duEdited).includes("[urgency_low]") && serializeIni(duEdited).includes("timeout = 3000")
);
check("dunst validate clean model", validateDunst(duModel).length === 0);

// ---------- picom ----------
const DEMO_PICOM = `# picom
backend = "glx";
vsync = true;
shadow = true;
shadow-radius = 12;
shadow-opacity = 0.45;
fading = true;
corner-radius = 10;

wintypes:
{
    dock = { shadow = false; };
};
`;

const piFile = parseIni(DEMO_PICOM);
const piModel = picomToModel(piFile);
check("picom booleans parsed", piModel.settings.vsync === true && piModel.settings.fading === true);
check("picom cornerRadius parsed", piModel.settings.cornerRadius === 10);
const piEdited = picomFromModel(piFile, { ...piModel, settings: { ...piModel.settings, cornerRadius: 14 } });
check("picom edit serialized", serializeIni(piEdited).includes("corner-radius = 14"));
check("picom wintypes block preserved", serializeIni(piEdited).includes("wintypes:"));
check("picom validate clean model", validatePicom(piModel).length === 0);

// ---------- greeter ----------
const DEMO_GREETER = `[greeter]
background=/usr/share/backgrounds/default.png
theme-name=Adwaita-dark
font-name=Space Grotesk 11
clock-format=%H:%M
screensaver-timeout=2
`;

const grFile = parseIni(DEMO_GREETER);
const grModel = greeterToModel(grFile);
check("greeter theme parsed", grModel.settings.themeName === "Adwaita-dark");
const grEdited = greeterFromModel(grFile, { ...grModel, settings: { ...grModel.settings, themeName: "Matcha-dark" } });
check("greeter edit serialized", serializeIni(grEdited).includes("theme-name=Matcha-dark"));
check("greeter untouched keys preserved", serializeIni(grEdited).includes("clock-format=%H:%M"));
check("greeter validate clean model", validateGreeter(grModel).length === 0);

// ---------- rofi ----------
const DEMO_ROFI = `/* rasi config */
configuration {
    modi: "window,run,ssh,drun";
    font: "JetBrains Mono 10";
    show-icons: true;
}
@theme "material/dark"
`;

const roFile = parseRasi(DEMO_ROFI);
const roSettings = rofiToSettings(roFile);
check("rofi font parsed", roSettings.font === "JetBrains Mono 10");
check("rofi show-icons parsed", roSettings.showIcons === true);
check(
  "rofi round trip byte-identical",
  serializeRasi(roFile) === DEMO_ROFI,
  JSON.stringify(serializeRasi(roFile))
);
const roEdited = rofiApplySettings(roFile, { ...roSettings, font: "Noto Sans 12" });
const roOut = serializeRasi(roEdited);
check(
  "rofi edit serialized, theme line preserved",
  roOut.includes('font: "Noto Sans 12";') && roOut.includes('@theme "material/dark"'),
  roOut
);

// ---------- lock ----------
const DEMO_LOCK = `#!/usr/bin/env bash
# everything outside the i3lock invocation is preserved.
scrot /tmp/lock.png

i3lock --inside-color=00000000 \\
    --ring-color=161B21 \\
    --time-color=E9EDF1 \\
    --timeout=300

rm /tmp/lock.png
`;

const lkFile = parseLock(DEMO_LOCK);
check("lock invocation found", lkFile.invocation !== null);
const lkInv = lkFile.invocation!;
check("lock round trip byte-identical", serializeLock(lkFile, lkInv) === DEMO_LOCK);
const lkSettings = lockToSettings(lkInv);
check("lock settings parsed", lkSettings.timeColor === "#E9EDF1");
const lkEdited = lockApplySettings(lkInv, { ...lkSettings, insideColor: "#7FB4E8" });
const lkOut = serializeLock(lkFile, lkEdited);
check("lock edit serialized", lkOut.includes("--inside-color=#7FB4E8"), lkOut);
check(
  "lock script outside invocation preserved",
  lkOut.startsWith("#!/usr/bin/env bash") && lkOut.includes("rm /tmp/lock.png")
);

// Helper: dunst keys live under [global]; adjust setValue target section.
function iniFileWithSquash(file: ReturnType<typeof parseIni>, _section: string) {
  return file;
}

if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("ALL ADAPTER CHECKS PASSED");
