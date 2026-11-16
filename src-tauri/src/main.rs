#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod resources;
mod updates;
use serde::Serialize;
use std::{collections::HashSet, fs, path::{Component, Path, PathBuf}, sync::Mutex};
use tauri::State;
#[derive(Default)]
struct Imports(Mutex<HashSet<PathBuf>>);
#[derive(Serialize)]
struct ImportedFile { path: String, bytes: Vec<u8> }
fn limited_read(path: &Path, max: u64) -> Result<Vec<u8>,String> {
    let meta=fs::metadata(path).map_err(|e|e.to_string())?;
    if !meta.is_file() || meta.len()>max { return Err("文件类型或大小超出限制".into()); }
    fs::read(path).map_err(|e|e.to_string())
}
#[tauri::command]
fn read_imports(paths: Vec<String>, state: State<'_,Imports>) -> Result<Vec<ImportedFile>,String> {
    if paths.len()>64 { return Err("一次最多导入 64 个文件".into()); }
    let mut result=Vec::new(); let mut total=0usize;
    for name in paths {
        let path=fs::canonicalize(name).map_err(|e|e.to_string())?;
        let ext=path.extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase();
        if !["zip","scml","png","jpg","jpeg","webp"].contains(&ext.as_str()) {return Err("仅允许动画或图片文件".into());}
        let bytes=limited_read(&path,256*1024*1024)?; total+=bytes.len();
        if total>512*1024*1024 {return Err("本次导入超过 512 MiB".into());}
        state.0.lock().map_err(|_|"资源锁错误")?.insert(path.clone());
        result.push(ImportedFile {path:path.to_string_lossy().into_owned(), bytes});
    }
    Ok(result)
}
#[tauri::command]
fn read_related(source: String, relative: String, state: State<'_,Imports>) -> Result<Vec<u8>,String> {
    let source=fs::canonicalize(source).map_err(|e|e.to_string())?;
    if !state.0.lock().map_err(|_|"资源锁错误")?.contains(&source) || source.extension().and_then(|v|v.to_str()).map(|v|!v.eq_ignore_ascii_case("scml")).unwrap_or(true) {return Err("源 SCML 未获导入授权".into());}
    let relative=relative.replace('\\',"/"); let path=Path::new(&relative);
    if path.components().any(|c|!matches!(c,Component::Normal(_)|Component::CurDir)) || relative.contains(':') {return Err("关联资源路径不安全".into());}
    let parent=source.parent().ok_or("SCML 无父目录")?;
    let resolved=fs::canonicalize(parent.join(path)).map_err(|e|e.to_string())?;
    if !resolved.starts_with(parent) {return Err("关联资源不允许越出 SCML 目录".into());}
    let ext=resolved.extension().and_then(|v|v.to_str()).unwrap_or("").to_lowercase();
    if !["png","jpg","jpeg","webp"].contains(&ext.as_str()) {return Err("只允许关联图片".into());}
    limited_read(&resolved,64*1024*1024)
}
fn main() {
    tauri::Builder::default().plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init()).plugin(tauri_plugin_opener::init()).manage(Imports::default()).manage(resources::OutputJobs::default())
        .invoke_handler(tauri::generate_handler![updates::update_status,read_imports,read_related,resources::resource_catalog,resources::load_preset,resources::load_handheld_scene,resources::prepare_cooking_output,resources::export_cooking,resources::open_cooking_output])
        .run(tauri::generate_context!()).expect("启动失败");
}
