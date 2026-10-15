# WORKFLOW.md — Heffs-i3-toolkit

## Overview
Tauri 2 + React 19 + MUI (Vite, TypeScript) GUI cockpit for i3wm / Polybar / rofi /
lightdm-gtk-greeter / i3lock-color configs on Fedora. Design identity: precision
instrument, dark, terminal-adjacent, monospace-accented, compact.

## Verification commands
- Typecheck + production build: `npm run build` (runs `tsc -b && vite build`)
- Dev server: `npm run dev` (browser fallback backend active, no Tauri needed)
- Rust backend: `cargo check` in `src-tauri/` — NOT AVAILABLE in this environment
  (no cargo/rustc installed). Reported as not run; must be verified on a machine
  with the Rust toolchain before shipping.

## Conventions
- React function components, hooks only. No classes.
- All backend calls go through `src/backend/ipc.ts` — components never import
  `@tauri-apps/api` directly, so the web fallback keeps `npm run dev` usable.
- Nothing writes a config file outside the staged-edit -> diff -> backup ->
  atomic-write -> apply pipeline (`src-tauri/src/pipeline.rs`).
- Never delete config lines the user may want: comment out (startup apps) or
  preserve byte-for-byte (lock script untouched regions).
- Theme tokens live only in `src/theme.ts`. No raw hex in components.
- Fonts: Space Grotesk (UI), JetBrains Mono (keys, paths, hex, config values).
- Em dashes and en dashes are forbidden in UI copy.

## Things VIGIL-Code Should NOT Do
- Do not run `cargo` commands here; the toolchain is absent (verified 2026-10-15).
- Do not write to real user config paths during tests; use the sandboxed
  web-fallback backend which stays under the project's `.devdata/` folder.
- Do not bypass `ipc.ts` with direct Tauri API imports in components.

## Project-Specific Patterns
- Adapters: one module per config format under `src/adapters/`, each exposing
  load / save / defaults / validate. Serialize must preserve untouched content.
- The i3lock adapter edits only the `i3lock` invocation flags in the lock
  script; anything it cannot parse must fail loudly, never guess.
