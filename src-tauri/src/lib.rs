// Heffs i3 toolkit — Tauri 2 backend.
// Safety-rail write pipeline: backup -> atomic write -> (optional) apply.
// Nothing in this backend ever writes without making a timestamped backup
// first, and writes go to a temp file in the same directory followed by a
// rename, so a crash can never leave a truncated config.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMeta {
    pub path: String,
    pub format: String,
    pub exists: bool,
    pub last_modified: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
    pub ok: bool,
    pub backup_path: Option<String>,
    pub error: Option<String>,
    /// mtime of the file after the atomic write, so the watcher can
    /// rebaseline immediately and never mistake our own write for an
    /// external change.
    pub written_mtime: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub ok: bool,
    pub message: String,
    command_run: Option<String>,
    command_output: Option<String>,
}

/// Expand a leading `~` using $HOME.
fn expand_tilde(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(path)
}

/// Timestamped backup directory for all targets.
fn backup_dir() -> PathBuf {
    let base = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("heffs-i3-toolkit")
        .join("backups");
    let _ = fs::create_dir_all(&base);
    base
}

/// `20261015-162200-123` style stamp from the wall clock, with
/// milliseconds so two writes in the same second cannot collide.
fn timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs() as i64;
    let millis = now.subsec_millis();
    // Civil-time conversion (days -> y/m/d) without pulling in a full
    // chrono dependency for this one function.
    let days = secs.div_euclid(86400);
    let secs_of_day = secs.rem_euclid(86400);
    let (y, m, d) = civil_from_days(days);
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}-{:03}",
        y,
        m,
        d,
        secs_of_day / 3600,
        (secs_of_day % 3600) / 60,
        secs_of_day % 60,
        millis
    )
}

/// Howard Hinnant's days-to-civil algorithm.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 - doe / 36524 + doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[tauri::command]
fn file_meta(path: String) -> Result<FileMeta, String> {
    let p = expand_tilde(&path);
    match fs::metadata(&p) {
        Ok(md) => {
            let mtime = md
                .modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| format_rfc3339(d.as_secs() as i64));
            Ok(FileMeta {
                path: path.clone(),
                format: format_for(&p),
                exists: true,
                last_modified: mtime,
                size_bytes: Some(md.len()),
            })
        }
        Err(_) => Ok(FileMeta {
            path,
            format: format_for(&p),
            exists: false,
            last_modified: None,
            size_bytes: None,
        }),
    }
}

fn format_for(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()) {
        Some("conf") => "conf".into(),
        Some("ini") => "ini".into(),
        Some("rasi") => "rasi".into(),
        Some("sh") => "shell".into(),
        _ => {
            if path.to_string_lossy().contains("i3") {
                "i3".into()
            } else {
                "conf".into()
            }
        }
    }
}

/// Format epoch seconds as RFC 3339 (UTC). civil_from_days does the date.
fn format_rfc3339(epoch: i64) -> String {
    let days = epoch.div_euclid(86400);
    let secs = epoch.rem_euclid(86400);
    let (y, m, d) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y,
        m,
        d,
        secs / 3600,
        (secs % 3600) / 60,
        secs % 60
    )
}

#[tauri::command]
fn read_config(path: String) -> Result<String, String> {
    let p = expand_tilde(&path);
    fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_config(
    path: String,
    content: String,
    _format: String,
    expected_mtime: Option<String>,
) -> Result<WriteResult, String> {
    let p = expand_tilde(&path);
    let parent = p
        .parent()
        .ok_or_else(|| "invalid path: no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    // Refuse the write when the file changed on disk since it was loaded.
    // This closes the TOCTOU gap: the staged diff was computed against
    // the state the user saw, and clobbering an external edit silently
    // would defeat the whole backup pipeline.
    if let Some(expected) = expected_mtime {
        let current = fs::metadata(&p)
            .ok()
            .and_then(|md| md.modified().ok())
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| format_rfc3339(d.as_secs() as i64));
        match current {
            Some(actual) if actual != expected => {
                return Err(format!(
                    "changed on disk: file was modified at {}, but the staged edit was based on {} ({}). Reload the tab and re-apply.",
                    actual,
                    expected,
                    p.display()
                ));
            }
            None => {
                return Err(format!(
                    "changed on disk: file no longer exists ({}). Reload the tab and re-apply.",
                    p.display()
                ));
            }
            _ => {}
        }
    }

    // Preserve the execute bit (the lock script lives in /usr/local/bin).
    let mode = fs::metadata(&p).ok().map(|md| {
        use std::os::unix::fs::PermissionsExt;
        md.permissions().mode()
    });

    // 1. Backup: copy the existing file, if any.
    let mut backup_path: Option<String> = None;
    if p.exists() {
        let file_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("config");
        let bak = backup_dir().join(format!("{}-{}.bak", timestamp(), file_name));
        fs::copy(&p, &bak).map_err(|e| format!("backup failed: {}", e))?;
        backup_path = Some(bak.to_string_lossy().into_owned());
    }

    // 2. Atomic write: temp file in the same directory, then rename.
    // PID + atomic counter keep the temp name unique so two concurrent
    // writes to the same target can never share a temp file.
    let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("config");
    static TMP_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let seq = TMP_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let tmp = parent.join(format!(
        ".{}.{}.{}-heffs-tmp",
        file_name, std::process::id(), seq
    ));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(content.as_bytes())
            .and_then(|_| f.sync_all())
            .map_err(|e| {
                let _ = fs::remove_file(&tmp);
                e.to_string()
            })?;
    }
    // Resolve symlinks BEFORE renaming over the path: dotfile-managed
    // configs (stow, symlinks to a repo) must have their target file
    // replaced, not the symlink itself.
    let dest = match fs::read_link(&p) {
        Ok(target) if target.is_absolute() => target,
        Ok(target) => parent.join(target),
        Err(_) => p.clone(),
    };
    fs::rename(&tmp, &dest).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })?;
    if let Some(mode) = mode {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = fs::set_permissions(&dest, fs::Permissions::from_mode(mode)) {
            // A lock script that loses its execute bit breaks the lock
            // screen; never let this fail silently.
            return Err(format!(
                "written, but restoring permissions on {} failed: {}",
                dest.display(),
                e
            ));
        }
    }

    let written_mtime = fs::metadata(&p)
        .ok()
        .and_then(|md| md.modified().ok())
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| format_rfc3339(d.as_secs() as i64));

    Ok(WriteResult {
        ok: true,
        backup_path,
        error: None,
        written_mtime,
    })
}

#[tauri::command]
fn apply_tool(target: String, _path: String) -> Result<ApplyResult, String> {
    let (program, args) = match target.as_str() {
        "i3" => ("i3-msg", vec!["reload"]),
        "polybar" => ("polybar-msg", vec!["cmd", "restart"]),
        "dunst" => ("dunstctl", vec!["reload"]), // reload config; falls through if missing
        "picom" => ("killall", vec!["-SIGUSR1", "picom"]), // picom's documented reload signal
        _ => {
            return Ok(ApplyResult {
                ok: true,
                message: format!("{} has no live-reload command; changes take effect next start.", target),
                command_run: None,
                command_output: None,
            });
        }
    };

    let out = Command::new(program).args(&args).output();
    let out = match out {
        Ok(o) => o,
        // Tool not installed: report a soft success with a clear message
        // instead of an error. The write already succeeded; only the live
        // reload needs the user's attention.
        Err(e) => {
            return Ok(ApplyResult {
                ok: true,
                message: format!(
                    "{} written. Reload command {} is not available ({}); changes take effect next start.",
                    target, program, e
                ),
                command_run: None,
                command_output: None,
            });
        }
    };

    Ok(ApplyResult {
        ok: out.status.success(),
        message: if out.status.success() {
            format!("{} applied ({} {}).", target, program, args.join(" "))
        } else {
            format!(
                "{} failed to apply: {}",
                target,
                String::from_utf8_lossy(&out.stderr).trim()
            )
        },
        command_run: Some(format!("{} {}", program, args.join(" "))),
        command_output: Some(String::from_utf8_lossy(&out.stdout).into_owned()),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Some Fedora GPU/driver combos make WebKitGTK's DMABUF renderer fail
    // ("Failed to create GBM buffer"), which renders a blank window. Force
    // the software renderer path before the webview is created.
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    // Older WebKitGTK builds use this variable instead.
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            file_meta,
            read_config,
            write_config,
            apply_tool
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
