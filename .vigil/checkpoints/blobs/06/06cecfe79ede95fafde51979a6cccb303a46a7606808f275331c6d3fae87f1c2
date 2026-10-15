// Adapter verification: parse -> serialize round trip, conflict detection,
// validation. Run with:
//   npx esbuild --bundle tests/i3-adapter.test.ts --platform=node \
//     --format=cjs --outfile=dist-tests.cjs --log-level=error && node dist-tests.cjs
import {
  parseI3,
  serializeI3,
  findKeyConflicts,
  validateI3,
} from "../src/adapters/i3";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log("PASS", name);
  } else {
    failures++;
    console.error("FAIL", name, detail ?? "");
  }
}

const DEMO = `# i3 config (v4)
font pango:JetBrains Mono 9
gaps inner 10
gaps outer 4
default_border pixel 2
exec --no-startup-id nm-applet
# exec --no-startup-id flameshot
bindsym $mod+j focus left
bindsym $mod+Return exec alacritty
bindsym $mod+j focus down
mode "resize" {
    bindsym j resize shrink width 10 px or 10 ppt
    bindsym Escape mode "default"
}
`;

// 1. Round trip: untouched config must serialize byte-for-byte identical,
//    including the 4-space indentation of binds inside the mode block.
const file = parseI3(DEMO);
const out = serializeI3(file);
check("round trip byte-identical", out === DEMO, JSON.stringify(out));

// 2. Model contents.
check(
  "parsed 5 keybinds (incl. mode + none commented)",
  file.model.keybinds.length === 5,
  String(file.model.keybinds.length)
);
check(
  "parsed 2 startup apps (one disabled)",
  file.model.startup.length === 2 &&
    file.model.startup.filter((e) => !e.enabled).length === 1
);

// 3. Conflict detection: $mod+j is bound twice in main mode.
const conflicts = findKeyConflicts(file.model.keybinds);
check(
  "exactly one conflict group main|$mod+j",
  conflicts.size === 1 && conflicts.has("main|$mod+j"),
  [...conflicts.keys()].join(",")
);
check(
  "conflict group holds both binds",
  conflicts.get("main|$mod+j")?.length === 2
);

// 4. Disabled round trip: toggling a bind off comments it, indentation kept.
const toggled = parseI3(DEMO);
const modeBind = toggled.model.keybinds.find(
  (b) => b.mode === "resize" && b.keys === "j"
)!;
modeBind.enabled = false;
const toggledOut = serializeI3(toggled);
check(
  "disabled mode bind serializes commented with indent",
  toggledOut.includes("    # bindsym j resize shrink width 10 px or 10 ppt"),
  toggledOut
);

// 5. Validation on the clean model must report no errors.
check("clean model validates", validateI3(file.model).length === 0);

if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log("ALL ADAPTER CHECKS PASSED");
