use serde::{Deserialize,Serialize};
use std::{collections::HashMap,fs,path::{Component,Path,PathBuf},io::Write,sync::Mutex};
#[derive(Default)]
pub struct OutputJobs(Mutex<HashMap<String,PathBuf>>,Mutex<HashMap<String,PathBuf>>);
#[derive(Serialize)]
pub struct OutputJob {pub id:String,pub path:String}
const LIMIT:u64=128*1024*1024;
#[derive(Clone,Copy,Default,Deserialize,Serialize,PartialEq,Debug)]
#[serde(rename_all="lowercase")]
pub enum WorkspaceKind {#[default] Cooking,Handheld}
impl WorkspaceKind {fn prefix(self)->&'static str{match self{Self::Cooking=>"料理动画-",Self::Handheld=>"手持动画-"}}}
#[derive(Clone,Deserialize,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Preset {pub id:String,pub name:String,#[serde(default)]pub workspace:WorkspaceKind,pub scene:String,pub scene_build:Option<String>,pub template_dir:String,pub scml:String,pub image:String,#[serde(default)]pub apply_all_images:bool,pub target_symbol:String,pub source_symbol:String,pub export_placeholder:String,pub animation:Option<String>,pub facing:Option<u8>,pub fixed_frame:Option<u32>}
#[derive(Deserialize)]
struct Manifest {version:u32,presets:Vec<Preset>}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Catalog {root:String,presets:Vec<Preset>}
#[derive(Serialize)]
pub struct FileData {path:String,bytes:Vec<u8>}
fn base()->Result<PathBuf,String>{
 if cfg!(debug_assertions){Ok(data_base(Path::new(env!("CARGO_MANIFEST_DIR")).parent().ok_or("项目目录无效")?,true))}
 else{Ok(data_base(std::env::current_exe().map_err(|e|e.to_string())?.parent().ok_or("程序目录无效")?,false))}
}
fn data_base(root:&Path,development:bool)->PathBuf{if development{root.join("data")}else{root.to_path_buf()}}
fn relative(path:&str)->Result<PathBuf,String>{
 let normalized=path.replace('\\',"/");let p=PathBuf::from(&normalized);
 if normalized.is_empty()||normalized.contains(':')||p.components().any(|c|!matches!(c,Component::Normal(_)|Component::CurDir)){return Err("资源相对路径不安全".into())}Ok(p)
}
fn inside(root:&Path,path:&str)->Result<PathBuf,String>{
 let root=root.canonicalize().map_err(|e|e.to_string())?;let p=root.join(relative(path)?).canonicalize().map_err(|e|format!("缺少资源 {path}: {e}"))?;
 if !p.starts_with(&root){return Err("资源越出允许目录".into())}Ok(p)
}
fn read(path:&Path)->Result<Vec<u8>,String>{let m=fs::metadata(path).map_err(|e|e.to_string())?;if !m.is_file()||m.len()>LIMIT{return Err("资源类型或大小超出限制".into())}fs::read(path).map_err(|e|e.to_string())}
fn manifest()->Result<(PathBuf,Vec<Preset>),String>{
 let root=base()?.join("resources");let raw=read(&inside(&root,"presets.json")?)?;
 let m:Manifest=serde_json::from_slice(&raw).map_err(|e|format!("预设配置错误：{e}"))?;
 if m.version!=1||m.presets.len()>100{return Err("预设版本或数量不支持".into())}
 let mut ids=std::collections::HashSet::new();for p in &m.presets{if p.id.is_empty()||!ids.insert(p.id.clone()){return Err("预设ID为空或重复".into())}relative(&p.scene)?;if let Some(ref build)=p.scene_build{relative(build)?;}relative(&p.template_dir)?;relative(&p.scml)?;relative(&p.image)?;if p.export_placeholder.is_empty(){return Err("导出名称占位符不能为空".into())}}
 Ok((root,m.presets))
}
fn preset(id:&str)->Result<(PathBuf,Preset,PathBuf),String>{let (root,all)=manifest()?;let p=all.into_iter().find(|p|p.id==id).ok_or("预设不存在")?;let dir=inside(&root,&p.template_dir)?;if !dir.is_dir(){return Err("模板目录无效".into())}Ok((root,p,dir))}
#[tauri::command]
pub fn resource_catalog()->Result<Catalog,String>{let (root,presets)=manifest()?;Ok(Catalog{root:root.to_string_lossy().into_owned(),presets})}
#[tauri::command]
pub fn load_preset(id:String,state:tauri::State<'_,crate::Imports>)->Result<Vec<FileData>,String>{
 let (root,p,dir)=preset(&id)?;let scene=inside(&root,&p.scene)?;let scml=inside(&dir,&p.scml)?;
 state.0.lock().map_err(|_|"授权锁失败")?.insert(scml.clone());
 let mut files=vec![FileData{path:scene.to_string_lossy().into_owned(),bytes:read(&scene)?},FileData{path:scml.to_string_lossy().into_owned(),bytes:read(&scml)?}];
 if let Some(ref build)=p.scene_build{let path=inside(&root,build)?;files.push(FileData{path:path.to_string_lossy().into_owned(),bytes:read(&path)?});}Ok(files)
}
#[tauri::command]
pub fn load_handheld_scene()->Result<Vec<FileData>,String>{
 let root=base()?.join("resources");["player_idles.zip","wilson.zip"].iter().map(|name|{let path=inside(&root,name)?;Ok(FileData{path:path.to_string_lossy().into_owned(),bytes:read(&path)?})}).collect()
}
fn png_size(bytes:&[u8])->Result<(u32,u32),String>{if bytes.len()<24||&bytes[..8]!=b"\x89PNG\r\n\x1a\n"||&bytes[12..16]!=b"IHDR"{return Err("替换图层必须为 PNG".into())}Ok((u32::from_be_bytes(bytes[16..20].try_into().unwrap()),u32::from_be_bytes(bytes[20..24].try_into().unwrap())))}
fn valid_dish_name(name:&str)->bool{
 let mut bytes=name.bytes();matches!(bytes.next(),Some(b) if b.is_ascii_alphabetic()||b==b'_')&&name.len()<=80&&bytes.all(|b|b.is_ascii_alphanumeric()||b==b'_')
}
fn output_stem(file_name:&str)->String{
 let leaf=file_name.rsplit(['/', '\\']).next().unwrap_or(file_name);
 let stem=leaf.rsplit_once('.').map(|(stem,_)|stem).unwrap_or(leaf);
 let clean:String=stem.chars().map(|c|if c.is_control()||"<>:\"/\\|?*".contains(c){'_'}else{c}).take(100).collect();
 let clean=clean.trim_end_matches([' ','.']);if clean.is_empty(){"image".into()}else{clean.into()}
}
#[cfg(test)]
fn reserve_output(root:&Path,stem:&str)->Result<PathBuf,String>{
 reserve_output_kind(root,stem,WorkspaceKind::Cooking)
}
fn reserve_output_kind(root:&Path,stem:&str,kind:WorkspaceKind)->Result<PathBuf,String>{
 fs::create_dir_all(root).map_err(|e|e.to_string())?;
 if fs::symlink_metadata(root).map_err(|e|e.to_string())?.file_type().is_symlink(){return Err("output不允许是符号链接".into())}
 for number in 1..10000{
  let prefix=kind.prefix();let name=if number==1{format!("{prefix}{stem}")}else{format!("{prefix}{stem}-{number}")};let path=root.join(name);
  match fs::create_dir(&path){Ok(())=>return Ok(path),Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>continue,Err(e)=>return Err(e.to_string())}
 }Err("同名输出目录过多".into())
}
#[tauri::command]
pub fn prepare_cooking_output(file_name:String,workspace:Option<WorkspaceKind>,state:tauri::State<'_,OutputJobs>)->Result<OutputJob,String>{
 let path=reserve_output_kind(&base()?.join("output"),&output_stem(&file_name),workspace.unwrap_or_default())?;
 let id=path.file_name().ok_or("目录名无效")?.to_string_lossy().into_owned();
 state.0.lock().map_err(|_|"输出锁失败")?.insert(id.clone(),path.clone());
 Ok(OutputJob{id,path:path.to_string_lossy().into_owned()})
}
fn copy_named(source:&Path,dest:&Path,root:&Path,targets:&[PathBuf],png:&[u8],placeholder:&str,name:&str,budget:&mut u64)->Result<(),String>{
 fs::create_dir(dest).map_err(|e|e.to_string())?;
 for entry in fs::read_dir(source).map_err(|e|e.to_string())?{
  let e=entry.map_err(|e|e.to_string())?;let kind=e.file_type().map_err(|e|e.to_string())?;
  if kind.is_symlink(){return Err("模板不允许符号链接".into())}
  let original=e.file_name().into_string().map_err(|_|"模板文件名不是Unicode")?;let renamed=original.replace(placeholder,name);
  let target=dest.join(relative(&renamed)?);
  if kind.is_dir(){copy_named(&e.path(),&target,root,targets,png,placeholder,name,budget)?}
  else if kind.is_file(){
   let size=e.metadata().map_err(|e|e.to_string())?.len();*budget=budget.checked_add(size).ok_or("模板过大")?;if *budget>512*1024*1024{return Err("模板超过512MiB".into())}
   let relative_path=e.path().strip_prefix(root).map_err(|e|e.to_string())?.to_path_buf();
   let bytes=if targets.contains(&relative_path){png.to_vec()}else if e.path().extension().and_then(|v|v.to_str()).map(|s|s.eq_ignore_ascii_case("scml")).unwrap_or(false){
    String::from_utf8(read(&e.path())?).map_err(|_|"SCML不是UTF-8")?.replace(placeholder,name).into_bytes()
   }else{read(&e.path())?};
   fs::OpenOptions::new().write(true).create_new(true).open(target).map_err(|e|e.to_string())?.write_all(&bytes).map_err(|e|e.to_string())?;
  }
 }Ok(())
}
fn write_template(dir:&Path,dest:&Path,targets:&[PathBuf],png:&[u8],placeholder:&str,name:&str)->Result<String,String>{
 if placeholder.is_empty()||!valid_dish_name(name){return Err("料理命名或模板占位符无效".into())}
 let parent=dest.parent().ok_or("输出父目录无效")?;
 if fs::symlink_metadata(dest).map_err(|e|e.to_string())?.file_type().is_symlink()||fs::read_dir(dest).map_err(|e|e.to_string())?.next().is_some(){return Err("输出目录已被修改或不为空，请重新导入图片".into())}
 let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();let stage=parent.join(format!(".staging-{stamp}"));
 let result=(||{
  fs::create_dir(&stage).map_err(|e|e.to_string())?;
  let folder=dir.file_name().and_then(|v|v.to_str()).ok_or("模板目录名无效")?.replace(placeholder,name);
  copy_named(dir,&stage.join(relative(&folder)?),dir,targets,png,placeholder,name,&mut 0)?;
  fs::remove_dir(dest).map_err(|e|e.to_string())?;
  if let Err(e)=fs::rename(&stage,dest){let _=fs::create_dir(dest);return Err(e.to_string())}
  Ok(dest.to_string_lossy().into_owned())
 })();
 if result.is_err(){let _=fs::remove_dir_all(stage);}result
}
fn export_job(p:&Preset,dir:&Path,png:&[u8],name:&str,dest:&Path)->Result<String,String>{
 if png.len()>64*1024*1024{return Err("输出图片过大".into())}
 if !valid_dish_name(name){return Err("料理名只允许英文字母、数字和下划线，不能以数字开头，长度1～80".into())}
 let targets=export_targets(p,dir,png)?;
 write_template(dir,dest,&targets,png,&p.export_placeholder,name)
}
fn export_targets(p:&Preset,dir:&Path,png:&[u8])->Result<Vec<PathBuf>,String>{
 let anchor=png_size(png)?;
 let mut targets=vec![relative(&p.image)?];
 if p.apply_all_images{
  fn collect(source:&Path,root:&Path,out:&mut Vec<PathBuf>)->Result<(),String>{for entry in fs::read_dir(source).map_err(|e|e.to_string())?{let e=entry.map_err(|e|e.to_string())?;if e.file_type().map_err(|e|e.to_string())?.is_dir(){collect(&e.path(),root,out)?}else if e.path().extension().and_then(|v|v.to_str()).map(|s|s.eq_ignore_ascii_case("png")).unwrap_or(false){out.push(e.path().strip_prefix(root).map_err(|e|e.to_string())?.to_path_buf())}}Ok(())}
  targets.clear();collect(dir,dir,&mut targets)?;
  if targets.is_empty(){return Err("模板目录中没有PNG".into())}
  if !targets.contains(&relative(&p.image)?){return Err("模板目录中不存在预设指定的图片".into())}
 }
 for target in &targets{if png_size(&read(&inside(dir,&target.to_string_lossy())?)?)?!=anchor{return Err(format!("拒绝导出：{} 画布尺寸与模板不一致",target.to_string_lossy()))}}
 Ok(targets)
}
#[tauri::command]
pub fn export_cooking(id:String,png:Vec<u8>,name:String,job_id:String,state:tauri::State<'_,OutputJobs>)->Result<String,String>{
 let mut jobs=state.0.lock().map_err(|_|"输出锁失败")?;
 let original=jobs.get(&job_id).ok_or("输出任务不存在，请重新导入图片")?.clone();let root=base()?.join("output");
 if original.parent()!=Some(root.as_path()){return Err("输出路径无效".into())}
 let (_,p,dir)=preset(&id)?;
 let stem=job_id.strip_prefix(p.workspace.prefix()).ok_or("输出任务与预设工作区不匹配")?;
 let result=export_next(&p,&dir,&png,&name,&root,&original,stem);
 if let Ok(ref path)=result{jobs.insert(job_id.clone(),PathBuf::from(path));state.1.lock().map_err(|_|"输出锁失败")?.insert(job_id,PathBuf::from(path));}
 result
}
fn completed_directory(root:&Path,expected:&Path,requested:&Path)->Result<PathBuf,String>{
 if requested!=expected||expected.parent()!=Some(root){return Err("不是本次制作的输出目录".into())}
 if fs::symlink_metadata(root).map_err(|e|e.to_string())?.file_type().is_symlink()||fs::symlink_metadata(expected).map_err(|e|e.to_string())?.file_type().is_symlink(){return Err("输出目录不允许符号链接".into())}
 let canonical_root=fs::canonicalize(root).map_err(|e|e.to_string())?;let path=fs::canonicalize(expected).map_err(|e|e.to_string())?;
 if !path.is_dir()||path.parent()!=Some(canonical_root.as_path()){return Err("输出目录已不存在或位置已改变".into())}Ok(path)
}
#[tauri::command]
pub fn open_cooking_output(job_id:String,path:String,state:tauri::State<'_,OutputJobs>)->Result<(),String>{
 let completed=state.1.lock().map_err(|_|"输出锁失败")?;let expected=completed.get(&job_id).ok_or("请先完成制作")?;
 let directory=completed_directory(&base()?.join("output"),expected,Path::new(&path))?;
 #[cfg(target_os="windows")]
 let mut command={let windows=std::env::var_os("SystemRoot").ok_or("无法定位Windows目录")?;std::process::Command::new(PathBuf::from(windows).join("explorer.exe"))};
 #[cfg(target_os="macos")]
 let mut command=std::process::Command::new("/usr/bin/open");
 #[cfg(not(any(target_os="windows",target_os="macos")))]
 let mut command=std::process::Command::new("xdg-open");
 command.arg(directory).spawn().map_err(|e|e.to_string())?;Ok(())
}
fn export_next(p:&Preset,dir:&Path,png:&[u8],name:&str,root:&Path,original:&Path,stem:&str)->Result<String,String>{
 if fs::symlink_metadata(root).map_err(|e|e.to_string())?.file_type().is_symlink()||fs::symlink_metadata(original).map_err(|e|e.to_string())?.file_type().is_symlink(){return Err("输出目录不允许符号链接".into())}
 let occupied=fs::read_dir(original).map_err(|e|e.to_string())?.next().is_some();
 let dest=if occupied{reserve_output_kind(root,stem,p.workspace)?}else{original.to_path_buf()};
 let result=export_job(p,dir,png,name,&dest);
 if result.is_err()&&occupied{let _=fs::remove_dir(&dest);}
 result
}
#[cfg(test)]
mod tests{
 #[test]fn development_and_portable_data_layouts_are_distinct(){
  let root=Path::new("test-project");assert_eq!(data_base(root,true),root.join("data"));assert_eq!(data_base(root,false),root);
  assert_eq!(data_base(root,true).join("resources"),root.join("data/resources"));assert_eq!(data_base(root,false).join("output"),root.join("output"));
 }
 #[test]fn dish_names_follow_variable_rules(){
  for name in ["defaultdish","dish_name","_dish2"]{assert!(valid_dish_name(name));}
  for name in ["","料理","my dish","my-dish","1dish","a/b","x.png"]{assert!(!valid_dish_name(name),"{name}");}
  assert!(!valid_dish_name(&"a".repeat(81)));
 }
 use super::*;
 #[test]fn open_directory_only_accepts_the_completed_output(){
  let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();let root=std::env::temp_dir().join(format!("dst-open-output-{stamp}"));
  let one=reserve_output(&root,"料理 图片-1").unwrap();let two=reserve_output(&root,"another").unwrap();
  assert_eq!(completed_directory(&root,&one,&one).unwrap(),fs::canonicalize(&one).unwrap());
  assert!(completed_directory(&root,&one,&two).is_err());assert!(completed_directory(&root,&root,&root).is_err());
  fs::remove_dir(&one).unwrap();assert!(completed_directory(&root,&one,&one).is_err());fs::remove_dir_all(root).unwrap();
 }
 #[test]fn paths_reject_traversal(){for p in ["../x","a/../../x","C:/x","/tmp/x",""]{assert!(relative(p).is_err(),"{p}")}}
 #[test]fn png_checks_signature(){assert!(png_size(b"not an image").is_err());}
 #[test]fn output_folders_keep_original_names_and_reserve_unique_siblings(){
  assert_eq!(output_stem("C:\\images\\红烧 肉-1.png"),"红烧 肉-1");
  assert_eq!(output_stem("a:b?.png"),"a_b_");
  let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();let root=std::env::temp_dir().join(format!("dst-output-test-{stamp}"));
  let one=reserve_output(&root,"红烧 肉-1").unwrap();let two=reserve_output(&root,"红烧 肉-1").unwrap();
  let held=reserve_output_kind(&root,"红烧 肉-1",WorkspaceKind::Handheld).unwrap();assert_eq!(held.file_name().unwrap().to_str().unwrap(),"手持动画-红烧 肉-1");
  assert_eq!(one.file_name().unwrap().to_str().unwrap(),"料理动画-红烧 肉-1");assert_eq!(two.file_name().unwrap().to_str().unwrap(),"料理动画-红烧 肉-1-2");
  fs::write(one.join("existing.txt"),b"keep").unwrap();assert_eq!(read(&one.join("existing.txt")).unwrap(),b"keep");fs::remove_dir_all(root).unwrap();
 }
 #[test]fn export_renames_placeholders_without_changing_other_scml_data(){
  let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
  let root=std::env::temp_dir().join(format!("dst-cooking-test-{stamp}"));let dir=root.join("dish_xplaceholderx");fs::create_dir_all(dir.join("dish_xplaceholderx")).unwrap();
  let scml="<spriter_data><folder name=\"dish_xplaceholderx\"><file name=\"dish_xplaceholderx/dish_xplaceholderx-0.png\" width=\"1024\" height=\"1024\" pivot_x=\"0.505\" pivot_y=\"0.48\"/></folder><entity name=\"dish_xplaceholderx\"/></spriter_data>";
  fs::write(dir.join("dish_xplaceholderx.scml"),scml).unwrap();fs::write(dir.join("dish_xplaceholderx/dish_xplaceholderx-0.png"),b"original").unwrap();fs::write(dir.join("other.png"),b"unchanged").unwrap();
  for name in ["defaultdish","custom_dish"]{
   let dest=reserve_output(&root.join("output"),"料理 图片-1").unwrap();
   let targets=vec![relative("dish_xplaceholderx/dish_xplaceholderx-0.png").unwrap()];let result=write_template(&dir,&dest,&targets,b"replacement","xplaceholderx",name).unwrap();let out=Path::new(&result);
   let wrapped=out.join(format!("dish_{name}"));assert_eq!(fs::read_dir(out).unwrap().count(),1);
   assert_eq!(read(&wrapped.join(format!("dish_{name}.scml"))).unwrap(),scml.replace("xplaceholderx",name).as_bytes());
   assert_eq!(read(&wrapped.join(format!("dish_{name}/dish_{name}-0.png"))).unwrap(),b"replacement");
   assert_eq!(read(&wrapped.join("other.png")).unwrap(),b"unchanged");assert!(!out.join(format!("{name}.scml")).exists());
   assert!(write_template(&dir,&dest,&targets,b"new","xplaceholderx",name).is_err());
  }
  assert_eq!(read(&dir.join("dish_xplaceholderx.scml")).unwrap(),scml.as_bytes());assert_eq!(read(&dir.join("dish_xplaceholderx/dish_xplaceholderx-0.png")).unwrap(),b"original");fs::remove_dir_all(root).unwrap();
 }
 fn verify_template_tree(source:&Path,output:&Path,root:&Path,image:&Path,png:&[u8],placeholder:&str,name:&str){
  let original:Vec<_>=fs::read_dir(source).unwrap().map(|e|e.unwrap()).collect();assert_eq!(fs::read_dir(output).unwrap().count(),original.len());
  for entry in original{
   let target=output.join(entry.file_name().to_str().unwrap().replace(placeholder,name));
   if entry.file_type().unwrap().is_dir(){assert!(target.is_dir());verify_template_tree(&entry.path(),&target,root,image,png,placeholder,name)}
   else{
    let path=entry.path();let expected=if path.strip_prefix(root).unwrap()==image{png.to_vec()}else if path.extension().and_then(|e|e.to_str())==Some("scml"){String::from_utf8(read(&path).unwrap()).unwrap().replace(placeholder,name).into_bytes()}else{read(&path).unwrap()};
    assert_eq!(read(&target).unwrap(),expected,"{}",target.display());
   }
  }
 }
 #[test]fn apply_all_images_replaces_every_same_size_png_and_keeps_sources(){
  fn png(w:u32,h:u32)->Vec<u8>{let mut v=vec![0x89,b'P',b'N',b'G',b'\r',b'\n',0x1a,b'\n',0,0,0,13,b'I',b'H',b'D',b'R'];v.extend_from_slice(&w.to_be_bytes());v.extend_from_slice(&h.to_be_bytes());v.extend_from_slice(&[0,0,0,0]);v}
  let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();let root=std::env::temp_dir().join(format!("dst-all-images-{stamp}"));let dir=root.join("swap_xplaceholderx");fs::create_dir_all(dir.join("swap_xplaceholderx")).unwrap();
  let p=Preset{id:"held".into(),name:"手持".into(),workspace:WorkspaceKind::Handheld,scene:"s.zip".into(),scene_build:None,template_dir:"swap_xplaceholderx".into(),scml:"swap_xplaceholderx.scml".into(),image:"swap_xplaceholderx/swap_xplaceholderx-0-0.png".into(),apply_all_images:true,target_symbol:"swap_object".into(),source_symbol:"swap_xplaceholderx".into(),export_placeholder:"xplaceholderx".into(),animation:None,facing:None,fixed_frame:Some(0)};
  fs::write(dir.join("swap_xplaceholderx.scml"),b"<spriter_data/>").unwrap();for n in 0..3{fs::write(dir.join(format!("swap_xplaceholderx/swap_xplaceholderx-0-{n}.png")),png(620,1298)).unwrap();}
  let rendered=png(620,1298);let dest=reserve_output_kind(&root.join("output"),"手斧-1",WorkspaceKind::Handheld).unwrap();
  fs::write(dir.join("swap_xplaceholderx/other.png"),png(512,512)).unwrap();assert!(export_job(&p,&dir,&rendered,"handheld_axe",&dest).is_err());
  fs::remove_file(dir.join("swap_xplaceholderx/other.png")).unwrap();
  let output=export_job(&p,&dir,&rendered,"handheld_axe",&dest).unwrap();let out=Path::new(&output);
  for n in 0..3{assert_eq!(read(&out.join(format!("swap_handheld_axe/swap_handheld_axe/swap_handheld_axe-0-{n}.png"))).unwrap(),rendered);assert_eq!(read(&dir.join(format!("swap_xplaceholderx/swap_xplaceholderx-0-{n}.png"))).unwrap(),png(620,1298));}
  assert!(!out.join("swap_xplaceholderx").exists());fs::remove_dir_all(root).unwrap();
 }
 #[test]
 #[ignore = "requires user cooking template and DST_COOKING_TEST_PNG generated by browser check"]
 fn real_template_export_preserves_animation_pivot_size_and_source(){
  let path=std::env::var("DST_COOKING_TEST_PNG").expect("test PNG path required");let png=fs::read(path).unwrap();
  let (_,p,dir)=preset("cook-pot-dish").unwrap();let image=inside(&dir,&p.image).unwrap();let original=read(&image).unwrap();let scml=read(&inside(&dir,&p.scml).unwrap()).unwrap();
  assert_eq!(png_size(&original).unwrap(),(1024,1024));
  let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();let root=std::env::temp_dir().join(format!("dst-real-cooking-{stamp}"));
  for name in ["defaultdish","custom_dish"]{
   let dest=reserve_output(&root,"新料理 图片-1").unwrap();
   let mut wrong=png.clone();wrong[16..20].copy_from_slice(&512u32.to_be_bytes());assert!(export_job(&p,&dir,&wrong,name,&dest).is_err());
   assert!(export_job(&p,&dir,&png,"bad-name",&dest).is_err());
   let result=export_next(&p,&dir,&png,name,&root,&dest,"新料理 图片-1").unwrap();let out=Path::new(&result);
   let wrapper=dir.file_name().unwrap().to_str().unwrap().replace(&p.export_placeholder,name);
   let scml_path=Path::new(&wrapper).join(p.scml.replace(&p.export_placeholder,name));let image_path=Path::new(&wrapper).join(p.image.replace(&p.export_placeholder,name));
   assert_eq!(fs::read_dir(out).unwrap().count(),1);
   verify_template_tree(&dir,&out.join(&wrapper),&dir,&relative(&p.image).unwrap(),&png,&p.export_placeholder,name);
   assert_eq!(read(&out.join(&scml_path)).unwrap(),String::from_utf8(scml.clone()).unwrap().replace(&p.export_placeholder,name).as_bytes());
   assert_eq!(read(&out.join(&image_path)).unwrap(),png);assert_eq!(png_size(&read(&out.join(&image_path)).unwrap()).unwrap(),(1024,1024));
   let second=export_next(&p,&dir,&png,name,&root,&dest,"新料理 图片-1").unwrap();assert_ne!(result,second);assert_eq!(read(&out.join(&image_path)).unwrap(),png);
  }
  assert_eq!(read(&image).unwrap(),original);assert_eq!(read(&inside(&dir,&p.scml).unwrap()).unwrap(),scml);fs::remove_dir_all(root).unwrap();
 }
}
