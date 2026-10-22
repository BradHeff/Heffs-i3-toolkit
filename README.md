# Vigil-i3-Toolkit

A visual config toolkit for the i3 ecosystem: i3, Polybar, i3lock-color,
rofi, dunst, picom and the LightDM GTK greeter. The original build is
for the VigilOS i3wm setup. Developed by Brad Heffernan. Built with
Tauri 2 + React + MUI.

## Safety rails

Nothing auto-writes. Every change is staged in the app, previewed as a
unified diff, backed up with a timestamped copy, and then written
atomically (temp file + rename), so a crash can never truncate a config.

Backups land in `~/.config/vigil-i3-toolkit/backups/`.

Tabs stay mounted while you work, so staged edits survive switching
between them. External edits to a config file are detected and flagged
in the header, separately from the app's own writes.

## Tabs

- **i3** — keybind editor with live conflict detection, startup-app
  manager (entries are commented out, never deleted), appearance panel.
- **Polybar** — bar settings (position, height, fonts) with module tree.
- **i3lock** — i3lock-color flag editing with a canvas lock preview;
  only the `i3lock` invocation is edited, everything else in the lock
  script is preserved byte-for-byte. Anything the parser cannot handle
  fails loudly instead of guessing.
- **rofi** — launcher settings from the rasi `configuration` block plus
  a raw property table for the rest.
- **dunst** — notification appearance and urgency behavior.
- **picom** — compositing controls (shadows, fading, corner radius).
- **Greeter** — LightDM GTK greeter editor.
- **About** — developer, original VigilOS i3wm build, and version.

## Development

Requirements: Node 18+, a Rust toolchain (rustup), and Tauri 2 system
dependencies for Linux (webkit2gtk 4.1, etc.).

```bash
npm install
npm run tauri dev
```

Frontend-only development and the production frontend build run without
cargo:

```bash
npm run dev            # Vite dev server; the app runs in demo mode
npm run build          # tsc + vite production build
npm run test:adapter   # adapter round-trip and preservation tests
```

Demo mode: without the Tauri backend the app boots with an in-memory
demo config so the whole staged-edit pipeline (parse -> edit -> diff ->
"write" -> apply) is exercised end to end. Demo writes stay under the
project's `.devdata/` folder.

Adapter tests cover every format: i3 (byte-identical round trip,
conflict detection, commented binds preserved), the shared INI layer,
polybar, dunst, picom, greeter, rofi and the lock script.

## Layout

- `src/` — React frontend (theme, adapters, components)
- `src/adapters/` — one module per config format; load / save /
  defaults / validate, byte-preserving serialization
- `src-tauri/` — Rust backend (commands: file_meta, read_config,
  write_config, apply_tool)
- `tests/` — adapter verification suites
- `Vigil-i3-Toolkit-Plan.md` — the full product plan and roadmap

## Roadmap status

All seven config editors (M0 through M3) are implemented: i3, polybar,
i3lock, rofi, dunst, picom and the greeter. Remaining ideas live in the
plan document.

## Building a release

```bash
npm run tauri build
```

Produces the release binary and an RPM for Fedora under
`src-tauri/target/release/bundle/rpm/`.
