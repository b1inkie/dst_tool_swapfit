use serde::Serialize;
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct UpdateStatus { version:String, enabled:bool, reason:Option<String> }
#[tauri::command]
pub fn update_status(app:tauri::AppHandle)->UpdateStatus {
 let config=app.config();
 let updater=config.plugins.0.get("updater");
 let configured=updater.is_some_and(|v|v.get("pubkey").and_then(|k|k.as_str()).is_some_and(|s|!s.trim().is_empty())&&v.get("endpoints").and_then(|e|e.as_array()).is_some_and(|a|!a.is_empty()));
 let reason=if cfg!(debug_assertions){Some("开发版不安装更新，请使用正式安装版。".into())}else if !configured{Some("此版本尚未接入更新服务。".into())}else{None};
 UpdateStatus{version:app.package_info().version.to_string(),enabled:reason.is_none(),reason}
}

#[cfg(test)]
mod tests {
 #[test]
 fn checked_in_updater_config_can_initialize_without_a_published_endpoint() {
  let config:serde_json::Value=serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
  let updater:tauri_plugin_updater::Config=serde_json::from_value(config["plugins"]["updater"].clone()).expect("registered updater requires a non-null Config with pubkey");
  assert!(updater.endpoints.is_empty());
  assert!(updater.pubkey.is_empty());
 }
}
