// IPC layer. Talks to the Tauri Rust backend when present; in a plain
// browser (dev preview without cargo) it serves an in-memory demo
// backend so the whole staged-edit pipeline still works end to end.

import type { ApplyResult, FileMeta, WriteResult, ConfigFormat } from "./types";

interface TauriWindow {
  __TAURI_INTERNALS__?: {
    invoke: <T>(cmd: string, args?: unknown) => Promise<T>;
  };
}

const tw = window as unknown as TauriWindow;
const hasBackend = Boolean(tw.__TAURI_INTERNALS__);
export const isDemoMode = !hasBackend;

// Demo corpus: a realistic mid-size i3 config exercising the parser.
const DEMO_I3 = `# i3 config (v4)
# managed with Vigil-i3-Toolkit

font pango:JetBrains Mono 9

# gaps
gaps inner 10
gaps outer 4

default_border pixel 2

# autostart
exec --no-startup-id nm-applet
exec --no-startup-id dunst
exec_always --no-startup-id picom --config ~/.config/picom/picom.conf
# exec --no-startup-id flameshot

# window focus
bindsym $mod+j focus left
bindsym $mod+k focus down
bindsym $mod+l focus up
bindsym $mod+semicolon focus right

# movement
bindsym $mod+Shift+j move left
bindsym $mod+Shift+k move down
bindsym $mod+Shift+l move up
bindsym $mod+Shift+semicolon move right

bindsym $mod+Return exec alacritty
bindsym $mod+d exec rofi -show drun
bindsym $mod+Shift+q kill
bindsym $mod+f fullscreen toggle
bindsym $mod+space focus mode_toggle
bindsym $mod+Shift+c reload
bindsym $mod+Shift+r restart
bindsym $mod+Shift+e exec "i3-nagbar -t warning -m 'Exit i3?' -B 'Exit' 'i3-msg exit'"

mode "resize" {
    bindsym j resize shrink width 10 px or 10 ppt
    bindsym k resize grow height 10 px or 10 ppt
    bindsym l resize shrink height 10 px or 10 ppt
    bindsym semicolon resize grow width 10 px or 10 ppt
    bindsym Escape mode "default"
}
`;

const DEMO_POLYBAR = `;==========================================================
;   Polybar config
;==========================================================
[colors]
background = #282A2E
background-alt = #373B41
foreground = #C5C8C6
primary = #81A1C1
secondary = #B48EAD
alert = #E5484D

[bar/main]
monitor = \${env:MONITOR:DP-1}
width = 100%
height = 24
radius = 6.0
fixed-center = true

background = \${colors.background}
foreground = \${colors.foreground}

line-size = 2
line-color = #81A1C1

border-size = 0
border-color = #00000000

padding-left = 2
padding-right = 2

module-margin-left = 1
module-margin-right = 2

font-0 = JetBrainsMono Nerd Font:pixelsize=10;2
font-1 = Noto Color Emoji:scale=10;1

modules-left = i3
modules-right = filesystem pulseaudio memory cpu date

tray-position = right
tray-detached = false

cursor-click = pointer
cursor-scroll = ns-resize

enable-ipc = true

[module/i3]
type = internal/i3
pin-workspaces = true
show-urgent = true
format = <label-state> <label-mode>
label-focused = %name%
label-focused-background = \${colors.background-alt}

[module/filesystem]
type = internal/fs
interval = 25
mount-0 = /

[module/pulseaudio]
type = internal/pulseaudio
format-volume = <ramp-volume> <label-volume>
label-volume = %percentage%%
ramp-volume-0 = 🔊
ramp-volume-1 = 🔊
ramp-volume-2 = 🔊

[module/memory]
type = internal/memory
interval = 2
format-prefix = "RAM "
label = %percentage_used:2%%

[module/cpu]
type = internal/cpu
interval = 2
format-prefix = "CPU "
label = %percentage:2%%

[module/date]
type = internal/date
interval = 60
date = %H:%M
date-alt = %Y-%m-%d %H:%M:%S
`;

const DEMO_LOCK = `#!/usr/bin/env bash
# lock script: everything outside the i3lock invocation is preserved.

# screenshot the screen for the lock background
scrot /tmp/lock.png

i3lock --inside-color=00000000 \\
    --ring-color=161B21 \\
    --keyhl-color=7FB4E8 \\
    --bshl-color=E5534B \\
    --insidever-color=7FB4E8 \\
    --insidewrong-color=E5534B \\
    --time-color=E9EDF1 \\
    --date-color=93A1AE \\
    --time-font="JetBrains Mono" \\
    --timeout=300

# cleanup
rm /tmp/lock.png
`;

const DEMO_ROFI = `/* rasi config */
configuration {
    modi: "window,run,ssh,drun";
    font: "JetBrains Mono 10";
    show-icons: true;
    display-drun: run;
    drun-display-format: "{name}";
}
@theme "material/dark"
`;

const DEMO_DUNST = `# dunst config
[global]
    font = JetBrains Mono 10
    frame_color = "#161B21"
    corner_radius = 6
    transparency = 5
    frame_width = 2
    width = 350
    height = 120
    offset = 10x30
    origin = top-right
    gap_size = 0
    timeout = 5000

[urgency_low]
    timeout = 3000

[urgency_critical]
    timeout = 0
`;

const DEMO_PICOM = `#################################
# picom
#################################
backend = "glx";
vsync = true;
detect-rounded-corners = true;
glx-no-stencil = true;
shadow = true;
shadow-radius = 12;
shadow-offset-x = -12;
shadow-offset-y = -12;
shadow-opacity = 0.45;
fading = true;
fade-delta = 5;
fade-in-step = 0.038;
corner-radius = 10;

wintypes:
{
    dock = { shadow = false; };
};
`;

const DEMO_GREETER = `[greeter]
background=/usr/share/backgrounds/default.png
theme-name=Adwaita-dark
icon-theme-name=Papirus-Dark
font-name=Space Grotesk 11
clock-format=%H:%M
screensaver-timeout=2
indicators=~host;~spacer;~clock;~spacer;~session;~language;~a11y;~power
`;

const demoFiles = new Map<string, { content: string; mtime: string }>([
  ["~/.config/i3/config", { content: DEMO_I3, mtime: new Date().toISOString() }],
  ["~/.config/polybar/config.ini", { content: DEMO_POLYBAR, mtime: new Date().toISOString() }],
  ["/usr/local/bin/lock", { content: DEMO_LOCK, mtime: new Date().toISOString() }],
  ["~/.config/rofi/config.rasi", { content: DEMO_ROFI, mtime: new Date().toISOString() }],
  ["~/.config/dunst/dunstrc", { content: DEMO_DUNST, mtime: new Date().toISOString() }],
  ["~/.config/picom/picom.conf", { content: DEMO_PICOM, mtime: new Date().toISOString() }],
  ["/etc/lightdm/lightdm-gtk-greeter.conf", { content: DEMO_GREETER, mtime: new Date().toISOString() }],
]);

function demoMeta(path: string): FileMeta {
  const f = demoFiles.get(path);
  return {
    path,
    format: "i3",
    exists: Boolean(f),
    lastModified: f?.mtime ?? null,
    sizeBytes: f ? f.content.length : null,
  };
}

export async function readFileMeta(path: string): Promise<FileMeta> {
  if (hasBackend) {
    return tw.__TAURI_INTERNALS__!.invoke<FileMeta>("file_meta", { path });
  }
  return demoMeta(path);
}

export async function readConfig(path: string): Promise<string> {
  if (hasBackend) {
    return tw.__TAURI_INTERNALS__!.invoke<string>("read_config", { path });
  }
  return demoFiles.get(path)?.content ?? "";
}

// The safety rail: backup + atomic write, done backend-side.
// expectedMtime: mtime observed when the tab loaded the file; the
// backend refuses the write when the file changed on disk since.
export async function writeConfig(args: {
  path: string;
  content: string;
  format: ConfigFormat;
  expectedMtime?: string | null;
}): Promise<WriteResult> {
  if (hasBackend) {
    return tw.__TAURI_INTERNALS__!.invoke<WriteResult>("write_config", args);
  }
  const prev = demoFiles.get(args.path);
  if (args.expectedMtime && prev && prev.mtime !== args.expectedMtime) {
    return {
      ok: false,
      backupPath: null,
      error: "changed on disk: file was modified after this tab loaded it. Reload and re-apply.",
      writtenMtime: null,
    };
  }
  const now = new Date().toISOString();
  demoFiles.set(args.path, { content: args.content, mtime: now });
  return {
    ok: true,
    backupPath: prev
      ? `~/.config/vigil-i3-toolkit/backups/demo-${now.replace(/[:.]/g, "-")}.bak`
      : null,
    error: null,
    writtenMtime: now,
  };
}

export async function applyTool(target: string, path: string): Promise<ApplyResult> {
  if (hasBackend) {
    return tw.__TAURI_INTERNALS__!.invoke<ApplyResult>("apply_tool", { target, path });
  }
  return {
    ok: true,
    message: `Demo mode: ${target} apply skipped (no backend).`,
    commandRun: `i3-msg reload (${target})`,
    commandOutput: null,
  };
}
// Keep the fallback object literal in applyTool aligned with ApplyResult:
// ok, message, commandRun, commandOutput. If ApplyResult gains a field,
// update both the demo fallback above and the catch handler in
// useStagedConfig.ts.
