# Heffs i3 toolkit

A visual config toolkit for the i3 ecosystem: i3, Polybar, i3lock-color,
rofi and the LightDM GTK greeter. Built with Tauri 2 + React + MUI.

## Safety rails

Nothing auto-writes. Every change is staged in the app, previewed as a
unified diff, backed up with a timestamped copy, and then written
atomically (temp file + rename), so a crash can never truncate a config.

Backups land in `~/.config/heffs-i3-toolkit/backups/`.

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
npm run dev        # Vite dev server; the app runs in demo mode
npm run build      # tsc + vite production build
```

Demo mode: without the Tauri backend the app boots with an in-memory i3
config so the whole staged-edit pipeline (parse -> edit -> diff ->
"write" -> apply) is exercised end to end.

## Layout

- `src/` — React frontend (theme, adapters, components)
- `src-tauri/` — Rust backend (commands: file_meta, read_config,
  write_config, apply_tool)
- `Heffs-i3-toolkit-Plan.md` — the full product plan and roadmap

## Roadmap status

- **M0 (this build):** i3 keybind editor with live conflict detection,
  startup-app manager, appearance panel, file locator header, staged
  writes with diff preview, backup and atomic write pipeline.
- M1: Polybar module tree with live visual bar preview.
- M2: i3lock-color editor with canvas lock preview.
- M3: rofi theme editor and LightDM greeter preview.
