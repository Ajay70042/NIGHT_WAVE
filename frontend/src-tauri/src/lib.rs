use std::sync::Mutex;
use std::process::{Child, Command};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn window_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
async fn open_floating_lyrics(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("floating-lyrics") {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "floating-lyrics",
        WebviewUrl::App("index.html?floating=1".into()),
    )
    .title("Murgichor Lyrics")
    .inner_size(640.0, 290.0)
    .min_inner_size(320.0, 140.0)
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .shadow(false)
    .skip_taskbar(true)
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to open floating lyrics: {e}"))?;

    Ok(())
}

#[tauri::command]
fn close_floating_lyrics(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("floating-lyrics") {
        let _ = win.close();
    }
}

#[tauri::command]
fn broadcast_lyrics_state(app: tauri::AppHandle, payload: serde_json::Value) {
    let _ = app.emit_to("floating-lyrics", "lyrics-sync", payload);
}

#[tauri::command]
fn send_lyrics_action(app: tauri::AppHandle, action: String) {
    let _ = app.emit_to("main", "lyrics-action", action);
}

#[tauri::command]
async fn open_google_login(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(existing) = app.get_webview_window("ytm-login") {
        let _ = existing.close();
        std::thread::sleep(Duration::from_millis(250));
    }

    let login_url: tauri::Url = "https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3Dhttps%253A%252F%252Fmusic.youtube.com%252F"
        .parse()
        .map_err(|e| format!("Invalid URL: {e}"))?;

    let _win = WebviewWindowBuilder::new(&app, "ytm-login", WebviewUrl::External(login_url))
        .title("Sign in with Google — YouTube Music")
        .inner_size(520.0, 720.0)
        .center()
        .incognito(true)
        .build()
        .map_err(|e| format!("Failed to open login window: {e}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        let ytm_url: tauri::Url = "https://music.youtube.com".parse().unwrap();

        loop {
            std::thread::sleep(Duration::from_millis(800));
            let Some(win) = app.get_webview_window("ytm-login") else {
                return Err("Sign-in cancelled".to_string());
            };

            if let Ok(current_url) = win.url() {
                if current_url.host_str() == Some("music.youtube.com") {
                    if let Ok(cookies) = win.cookies_for_url(ytm_url.clone()) {
                        let has_sapisid = cookies.iter().any(|c| c.name() == "SAPISID");
                        let has_3p = cookies
                            .iter()
                            .any(|c| matches!(c.name(), "__Secure-3PAPISID" | "__Secure-1PAPISID" | "SID"));

                        if has_sapisid && has_3p {
                            let cookie_str = cookies
                                .iter()
                                .map(|c| format!("{}={}", c.name(), c.value()))
                                .collect::<Vec<_>>()
                                .join("; ");
                            let _ = win.close();
                            return Ok(format!("Cookie: {cookie_str}"));
                        }
                    }
                }
            }
        }
    })
    .await
    .map_err(|e| format!("Login task failed: {e}"))?
}

struct BackendProcess(Mutex<Option<Child>>);

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn find_backend_executable(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    // 0. Check alongside current running executable (portable / standalone distribution)
    if let Ok(curr_exe) = std::env::current_exe() {
        if let Some(exe_dir) = curr_exe.parent() {
            let p = exe_dir.join("nightwave-engine").join("nightwave-engine.exe");
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 1. Check resource directory (production bundle)
    if let Ok(res_dir) = app_handle.path().resource_dir() {
        let p = res_dir.join("dist").join("nightwave-engine").join("nightwave-engine.exe");
        if p.exists() {
            return Some(p);
        }
        let p2 = res_dir.join("nightwave-engine").join("nightwave-engine.exe");
        if p2.exists() {
            return Some(p2);
        }
    }

    // 2. Check workspace relative paths (dev mode)
    let candidates = [
        PathBuf::from("dist/nightwave-engine/nightwave-engine.exe"),
        PathBuf::from("../dist/nightwave-engine/nightwave-engine.exe"),
        PathBuf::from("../../dist/nightwave-engine/nightwave-engine.exe"),
        PathBuf::from("C:/Users/ajayb/Documents/Music_app/dist/nightwave-engine/nightwave-engine.exe"),
    ];

    for c in &candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }

    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_google_login,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_start_dragging,
            open_floating_lyrics,
            close_floating_lyrics,
            broadcast_lyrics_state,
            send_lyrics_action
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Spawn Python backend sidecar in background with no window
            let app_handle = app.handle().clone();
            if let Some(exe_path) = find_backend_executable(&app_handle) {
                let working_dir = exe_path.parent().unwrap_or(&exe_path);
                let mut cmd = Command::new(&exe_path);
                cmd.current_dir(working_dir);

                #[cfg(target_os = "windows")]
                cmd.creation_flags(CREATE_NO_WINDOW);

                match cmd.spawn() {
                    Ok(child) => {
                        println!("[NightWave Tauri] Started backend engine (PID: {})", child.id());
                        let state = app.state::<BackendProcess>();
                        if let Ok(mut lock) = state.0.lock() {
                            *lock = Some(child);
                        }
                    }
                    Err(e) => {
                        eprintln!("[NightWave Tauri] Failed to spawn backend engine: {}", e);
                    }
                }
            } else {
                eprintln!("[NightWave Tauri] Could not locate nightwave-engine.exe");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::Destroyed = event {
                    // Close floating lyrics window if open
                    if let Some(fl) = window.app_handle().get_webview_window("floating-lyrics") {
                        let _ = fl.close();
                    }
                    // When main window closes, terminate background backend process cleanly
                    let state = window.state::<BackendProcess>();
                    if let Ok(mut lock) = state.0.lock() {
                        if let Some(mut child) = lock.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
