// Desktop RPC: a second launch (or the gdbus fast path) can ask the running
// client to toggle the user's own mic. Off by default; the flag file is the
// Rust-visible mirror of the desktop-only setting.

use std::fs;
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Action {
  ToggleMute,
}

impl Action {
  pub fn as_str(self) -> &'static str {
    match self {
      Action::ToggleMute => "togglemute",
    }
  }
}

pub fn is_rpc_invocation(args: &[String]) -> bool {
  args.iter().any(|arg| arg == "rpc")
}

pub fn parse_action(args: &[String]) -> Option<Action> {
  let index = args.iter().position(|arg| arg == "rpc")?;
  match args.get(index + 1).map(String::as_str) {
    Some("togglemute") => Some(Action::ToggleMute),
    _ => None,
  }
}

fn flag_file_enabled(path: &Path) -> bool {
  let Ok(contents) = fs::read_to_string(path) else {
    return false;
  };
  let Ok(value) = serde_json::from_str::<serde_json::Value>(&contents) else {
    return false;
  };
  value
    .get("enabled")
    .and_then(serde_json::Value::as_bool)
    .unwrap_or(false)
}

pub fn enabled(app: &AppHandle) -> bool {
  if cfg!(debug_assertions) && std::env::var("HARMONY_RPC").ok().as_deref() == Some("1") {
    return true;
  }
  let Ok(dir) = app.path().app_data_dir() else {
    return false;
  };
  flag_file_enabled(&dir.join("rpc.json"))
}

pub fn handle(app: &AppHandle, args: &[String]) -> bool {
  let Some(action) = parse_action(args) else {
    return false;
  };
  if !enabled(app) {
    return false;
  }
  let _ = app.emit_to("main", "rpc://command", action.as_str());
  eprintln!("[rpc] dispatched {}", action.as_str());
  true
}

#[derive(Serialize)]
pub struct RpcStatusDto {
  enabled: bool,
  actions: Vec<&'static str>,
}

#[tauri::command]
pub fn rpc_set_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
  }

  let updated_at = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map_err(|e| e.to_string())?
    .as_secs();
  let contents = serde_json::json!({ "enabled": enabled, "updatedAt": updated_at }).to_string();
  let path = dir.join("rpc.json");
  fs::write(&path, contents).map_err(|e| e.to_string())?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
pub fn rpc_status(app: AppHandle) -> RpcStatusDto {
  RpcStatusDto {
    enabled: enabled(&app),
    actions: vec![Action::ToggleMute.as_str()],
  }
}

#[cfg(test)]
mod tests {
  use super::{flag_file_enabled, is_rpc_invocation, parse_action};
  use std::fs;
  use std::path::PathBuf;

  fn args(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
  }

  #[test]
  fn parses_allowlisted_action() {
    assert!(parse_action(&args(&["harmony", "rpc", "togglemute"])).is_some());
    assert!(parse_action(&args(&["rpc", "togglemute"])).is_some());
    assert!(parse_action(&args(&["--minimized", "rpc", "togglemute"])).is_some());
  }

  #[test]
  fn rejects_unknown_or_missing_action() {
    assert!(parse_action(&args(&["rpc", "deafen"])).is_none());
    assert!(parse_action(&args(&["rpc"])).is_none());
    assert!(parse_action(&[]).is_none());
    assert!(parse_action(&args(&["--minimized"])).is_none());
    assert!(parse_action(&args(&["harmony", "--rpc", "togglemute"])).is_none());
  }

  #[test]
  fn detects_rpc_invocation_before_action_validation() {
    assert!(is_rpc_invocation(&args(&["harmony", "rpc", "deafen"])));
    assert!(is_rpc_invocation(&args(&["rpc"])));
    assert!(!is_rpc_invocation(&args(&["harmony", "--minimized"])));
    assert!(!is_rpc_invocation(&args(&["harmony", "--rpc", "togglemute"])));
  }

  fn temp_flag(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("harmony-rpc-{}-{name}.json", std::process::id()))
  }

  fn read_flag(name: &str, contents: Option<&str>) -> bool {
    let path = temp_flag(name);
    let _ = fs::remove_file(&path);
    if let Some(contents) = contents {
      fs::write(&path, contents).unwrap();
    }
    let result = flag_file_enabled(&path);
    let _ = fs::remove_file(&path);
    result
  }

  #[test]
  fn flag_file_requires_boolean_true() {
    assert!(!read_flag("missing", None));
    assert!(!read_flag("false", Some(r#"{"enabled": false}"#)));
    assert!(read_flag("true", Some(r#"{"enabled": true}"#)));
    assert!(!read_flag("corrupt", Some("not json")));
  }
}
