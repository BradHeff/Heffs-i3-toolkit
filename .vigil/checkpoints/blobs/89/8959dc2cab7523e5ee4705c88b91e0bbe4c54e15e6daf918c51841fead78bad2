# Heffs-i3-toolkit — Complete Project Plan

A precision GUI configuration cockpit for the i3wm / Polybar / rofi / lightdm-gtk-greeter / i3lock-color stack on Fedora Linux.

---

## 1. Design Identity

**One sentence everything serves:** a precision instrument for a tiling-window power user — dark, terminal-adjacent, monospace-accented, compact. It should feel like a beautifully organized dotfiles repo brought to life, and never like a generic web admin dashboard.

Every design and UX decision below is checked against that sentence.

## 2. Recommended Stack

**Tauri 2 + React + MUI (Vite).**

- **Tauri** over Electron: a tiling-WM user notices a 400 MB idle footprint. Tauri uses the system webview (WebKitGTK on Fedora), ships small, and its Rust backend is perfect for file I/O, config parsing, and shelling out to `i3-msg`.
- **React + MUI** for the frontend, themed hard through `createTheme`. MUI gives accessible components and form wiring; the theme gives it a soul (section 6).
- Alternative if staying pure Python is preferred: **PySide6**. It integrates more naturally with GTK-land, but the modern look is harder to achieve. Recommended call: Tauri.

## 3. Architecture

### 3.1 Config Adapters

One adapter per config format, all behind one interface:

| Target | Format | Default path |
|---|---|---|
| i3 | i3 config dialect | `~/.config/i3/config` |
| Polybar | INI | `~/.config/polybar/config.ini` |
| lightdm-gtk-greeter | GTK INI | `/etc/lightdm/lightdm-gtk-greeter.conf` |
| i3lock-color | shell script (edit the `i3lock` command line) | `/usr/local/bin/lock` |
| rofi | rasi (CSS-like) | `~/.config/rofi/config.rasi` |
| dunst | INI | `~/.config/dunst/dunstrc` |
| picom | conf | `~/.config/picom/picom.conf` |

Each adapter implements:

- `load()` — parse the file into a typed model
- `save(model)` — serialize the model back, preserving untouched content and comments
- `defaults()` — factory defaults for reset
- `validate()` — syntax and sanity checks before write

### 3.2 Write Pipeline (Safety Rails)

Nothing ever touches a file without going through this pipeline, in order:

1. **Staged edit** — changes are held in the app model, never written live
2. **Diff preview** — user sees exactly what will change before applying
3. **Timestamped backup** — to `~/.config/heffs-i3-toolkit/backups/`
4. **Atomic write** — temp file + rename, so a crash can never leave a half-written config
5. **Apply action** — the tool's own refresh command runs (`i3-msg reload`, `polybar-msg cmd restart`, etc.)

### 3.3 File Locator Header (Killer Feature)

Every tab gets a persistent header strip:

- Detected default path
- File format chip
- Last-modified time
- "Use custom path" checkbox that enables a path field (defaults to the standard config path)
- External-change watcher that warns if the file changed on disk while the tab was open

**Lock script handling:** the i3lock-color adapter parses the lock script, locates the `i3lock` invocation, and edits only its flags — the rest of the script is preserved byte-for-byte.

### 3.4 Root Handling

The lightdm greeter config lives in `/etc`. Do NOT run the whole app as root. Write the staged config to a temp file and apply it with `pkexec cp`, which pops the standard polkit prompt. One elevated action, only where needed, fully auditable.

## 4. The Tabs

### 4.1 i3

- **Keybind editor:** table grouped by mode; key-capture widget (press the combo, it records); command field with autocomplete from common i3 commands; search/filter; live conflict detection (same key in same mode).
- **Startup apps:** `exec` / `exec_always` manager with enable/disable (comment the line out rather than deleting it, so nothing is ever lost), drag-to-reorder, note column.
- **Appearance:** gaps (inner/outer), font, borders, colors class. Applies via `i3-msg reload` with one-click revert to the pre-edit backup.

### 4.2 Polybar

- Full module tree: bar settings (position, height, fonts, background/foreground) and per-module config.
- **Live visual bar preview:** an HTML/SVG mock of the bar at the top of the tab, re-rendered on every change, showing left/center/right modules with the user's actual colors, fonts, and icons. This is where the app earns its keep.
- Module toggle grid with type chips: which modules run, which are disabled.

### 4.3 i3lock-color

- Visual editor for the lock script's `i3lock` flags: ring colors, verif/wrong/keypress colors, clock (font, size, date format), blur, screenshot background, indicator radius.
- **Canvas lock preview:** a darkened mock of the current wallpaper with the ring, clock, and colors rendered live — tune the lock screen without locking yourself out twelve times.

### 4.4 Rofi

- Theme editor with a live mock of the rofi window: colors, window width/position, font, entry spacing, highlighted-row styling.
- Mode list editor (drun, run, window, custom).

### 4.5 LightDM GTK Greeter

- **Full lockscreen/login visual:** the selected wallpaper behind a mock greeter panel, with theme, icon theme, font, clock format, indicator position, and default user-session rendered as they will actually appear. Greeter appearance is the one thing you can never preview without logging out — this tab is the app's best party trick.

### 4.6 Extras (Backlog Bucket)

- **Dunst** notification editor with a live notification preview toast.
- **Picom** compositor settings (shadows, blur, opacity rules).
- **Pywal bridge:** pull the current wal colors and push them consistently into i3 colors, Polybar, rofi, and i3lock in one click.
- **Profile switcher:** named snapshots of all configs (work, gaming, presentation), switchable in one action.
- **Dotfiles snapshot browser:** timestamped backups with diff view and restore.
- **Keybind cheatsheet export:** printable HTML/PDF of all binds, grouped by mode.

## 5. Shared UX Mechanics

- Every tab: file locator header (path, format, custom-path checkbox, watcher) at top; editor + live preview split below.
- Unsaved-changes indicator with a warn-on-navigate guard.
- One primary action per view: **Apply**. Secondary: Revert to backup, View diff. Nothing auto-writes.
- Status toasts with `aria-live` for apply success/failure, including actual command output when something fails.

## 6. Design System

- **Typography:** Space Grotesk for UI text; JetBrains Mono for keys, paths, hex colors, and all config values. A tiling-WM tool where monospace is a first-class citizen, not an afterthought. Tightened headings; small-caps technical labels at 0.08em letter-spacing for section headers.
- **Palette:** near-black ink surface ramp (`#0B0E11` through `#161B21`); cool-grey neutrals (deliberately not MUI's blue-tinted grey); primary "signal teal" ramp with a full 50-900 tone ladder; ember amber as the warning/unsaved accent. One accent working hue, WCAG AA verified. No default MUI blue anywhere.
- **Shape:** sharp register. 2px radius on controls, 8px on cards, 0px on code and path fields with a 1px border. A technical tool should look like one.
- **Depth:** elevation by surface-tone steps and borders, not MUI's default shadow stack. Shadows reserved for floating elements only (dialogs, toasts, color picker popover).
- **Motion:** fast and snappy, 150-200ms, sharp cubic-bezier befitting a WM user. Live previews update instantly; tab transitions are subtle cross-fades, disabled under `prefers-reduced-motion`.
- **Density:** compact professional tool register. Tight control heights, 2-unit gaps, comfortable labels. i3 and Polybar configs run long; the app respects vertical space.

## 7. Roadmap

| Milestone | Scope |
|---|---|
| **M0** | Tauri + Vite + MUI scaffold, full theme file, file locator header component, backup/atomic-write pipeline. Safety rails first. |
| **M1** | i3 tab (keybinds, startup apps, appearance) + diff preview + `i3-msg` apply. |
| **M2** | Polybar tab with live bar preview. |
| **M3** | i3lock-color (lock script adapter + canvas preview) and rofi (rasi parser + window mock). |
| **M4** | LightDM greeter with pkexec flow and full greeter preview. |
| **M5** | Extras: dunst, picom, pywal bridge, profiles, cheatsheet export. |

## 8. Known Risks

- **i3 config dialect parsing** is the biggest technical risk, not the UI. Build the adapter layer with a fat test corpus of real-world configs before trusting it near a live setup.
- rasi parsing (rofi) is CSS-like but not CSS; treat it as its own format.
- The lock script adapter must never rewrite parts of the script it does not understand — fail loudly instead.
