import {useEffect,useMemo,useRef,useState} from 'react'
import {invoke,isTauri} from '@tauri-apps/api/core'
import {getCurrentWebviewWindow} from '@tauri-apps/api/webviewWindow'
import {open} from '@tauri-apps/plugin-dialog'
import type {AssetPackage,Mat,Project,Vec} from '../core/model'
import {inverse,multiply,transform} from '../core/matrix'
import {emptyProject} from '../core/model'
import {collectChannels} from '../core/channels'
import {kleiHash} from '../importers/binary'
import {importZip} from '../importers/zip'
import {importScml,MissingScmlImage} from '../importers/scml'
import {drawItem} from '../renderer/canvas'
import {decodeImage,defaultPlacement,pngBytes,rasterize,trimTransparent,type ImagePlacement} from './image'
import {textureToScreen,gizmo,updateGesture,type Gesture} from './interaction'
import {placementMatrix} from './image'
import {defaultViewport,editingTarget,viewMatrix,zoomAt,type Viewport} from './viewport'
import {rotationCursor} from './cursors'
import DishNameDialog from './DishNameDialog'
import {imageStem,validDishName} from './naming'
import {chooseSceneAnimation,visibleSceneElements,workspaceProfiles,type WorkspaceKind} from '../workspaces/profile'
import ThemedSelect from '../ui/ThemedSelect'
import Tooltip from '../ui/Tooltip'

type Preset={id:string;name:string;workspace?:WorkspaceKind;scene:string;sceneBuild?:string;templateDir:string;scml:string;image:string;applyAllImages?:boolean;targetSymbol:string;sourceSymbol:string;animation?:string;facing?:number;fixedFrame?:number}
type Catalog={root:string;presets:Preset[]}
type Loaded={preset:Preset;scene:AssetPackage;sceneBuild:AssetPackage;food:AssetPackage;target:HTMLCanvasElement;imageId:string;sourceHash:number}
type FileData={path:string;bytes:number[]}
type CharacterBuild={id:string;label:string;buildId:string;package:AssetPackage}
export default function CookingWorkspace({active=true,kind='cooking'}:{active?:boolean;kind?:WorkspaceKind}){
 const profile=workspaceProfiles[kind]
 const [standby,setStandby]=useState<{scene:AssetPackage;build:AssetPackage}>()
 const [catalog,setCatalog]=useState<Catalog>(),[loaded,setLoaded]=useState<Loaded>(),[source,setSource]=useState<HTMLCanvasElement>(),[placement,setPlacement]=useState<ImagePlacement>(defaultPlacement)
 const [characters,setCharacters]=useState<CharacterBuild[]>(),[characterId,setCharacterId]=useState('wilson')
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[animationId,setAnimationId]=useState(''),[name,setName]=useState<string>(profile.defaultName)
 const [selected,setSelected]=useState(true),[cursor,setCursor]=useState('default')
 const [viewport,setViewport]=useState(defaultViewport),[spaceHeld,setSpaceHeld]=useState(false)
 const pan=useRef<{point:Vec;view:Viewport}|null>(null),space=useRef(false)
 const characterInput=useRef<HTMLInputElement>(null)
 const canvas=useRef<HTMLCanvasElement>(null),input=useRef<HTMLInputElement>(null),drag=useRef<Gesture|null>(null),gestureValue=useRef<ImagePlacement>()
 const past=useRef<ImagePlacement[]>([]),future=useRef<ImagePlacement[]>([]),[revision,setRevision]=useState(0)
 const [naming,setNaming]=useState<{initial:string;pending?:{image:HTMLCanvasElement;fileName:string;job?:{id:string;path:string}}}>()
 const importSequence=useRef(0)
 const [outputJob,setOutputJob]=useState<{id:string;path:string}>()
 const [completedOutput,setCompletedOutput]=useState<{jobId:string;path:string}>(),[openingOutput,setOpeningOutput]=useState(false)
 const setEdit=(next:ImagePlacement)=>{past.current.push(placement);future.current=[];setPlacement(next);setRevision(n=>n+1)}
 const undo=()=>{const p=past.current.pop();if(p){future.current.push(placement);setPlacement(p);setRevision(n=>n+1)}}
 const redo=()=>{const p=future.current.pop();if(p){past.current.push(placement);setPlacement(p);setRevision(n=>n+1)}}
 useEffect(()=>{
  if(!active||naming)return
  const keyDown=(e:KeyboardEvent)=>{
   if(editingTarget(e.target))return
   if(e.code==='Space'){e.preventDefault();space.current=true;setSpaceHeld(true)}
   if((e.ctrlKey||e.metaKey)&&!e.altKey&&!drag.current&&!busy){
    if(e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo()}
    else if(e.key.toLowerCase()==='y'){e.preventDefault();redo()}
   }
   if(e.key==='Escape'){pointerEnd(true);pan.current=null}
  }
  const releaseSpace=(e:KeyboardEvent)=>{if(e.code==='Space'){space.current=false;setSpaceHeld(false)}}
  const blur=()=>{space.current=false;setSpaceHeld(false);pointerEnd(true);pan.current=null}
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',releaseSpace);window.addEventListener('blur',blur)
  return()=>{window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',releaseSpace);window.removeEventListener('blur',blur)}
 },[active,placement,busy,naming])
 useEffect(()=>{
  const element=canvas.current;if(!element||!active)return
  const wheel=(e:WheelEvent)=>{e.preventDefault();if(drag.current||pan.current)return;const r=element.getBoundingClientRect(),point={x:(e.clientX-r.left)*900/r.width,y:(e.clientY-r.top)*660/r.height};setViewport(v=>zoomAt(v,point,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?660:1)))}
  element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel)
 },[active])
 const [reloadToken,setReloadToken]=useState(0)
 useEffect(()=>{if(!isTauri()){setError('预设从软件旁的 resources 读取，请使用桌面模式。');return}invoke<Catalog>('resource_catalog').then(c=>{setCatalog(c);setError('')}).catch(e=>setError(String(e)))},[reloadToken])
 const autoPreset=useRef<string>()
 useEffect(()=>{
  const presets=catalog?.presets.filter(p=>(p.workspace??'cooking')===kind)??[],first=presets[0]
  if(active&&first&&!loaded&&autoPreset.current!==first.id){autoPreset.current=first.id;void selectPreset(first)}
  if(active&&kind==='handheld'&&!first&&!standby&&autoPreset.current!=='standby'){
   autoPreset.current='standby';setBusy(true)
   void invoke<FileData[]>('load_handheld_scene').then(async files=>{
    const scene=await importZip('player_idles.zip',new Uint8Array(files[0].bytes)),build=await importZip('wilson.zip',new Uint8Array(files[1].bytes))
    const anim=chooseSceneAnimation(scene,'idle_loop_nofaced',255);setStandby({scene,build});setAnimationId(anim.id)
   }).catch(e=>setError(String(e))).finally(()=>setBusy(false))
  }
 },[catalog,active,kind])
 async function selectPreset(preset:Preset){
  setBusy(true);setError('');setStatus('')
  try{
   const files=await invoke<FileData[]>('load_preset',{id:preset.id}),scene=await importZip(preset.scene,new Uint8Array(files[0].bytes)),images=new Map<string,HTMLCanvasElement>()
   const sceneBuild=preset.sceneBuild?await importZip(preset.sceneBuild,new Uint8Array(files[2].bytes)):scene
   const food=await importScml(preset.scml,new Uint8Array(files[1].bytes),async path=>{
    const image=await decodeImage(new Uint8Array(await invoke<number[]>('read_related',{source:files[1].path,relative:path})));images.set(path,image)
    return {id:path,width:image.width,height:image.height,rgba:image.getContext('2d')!.getImageData(0,0,image.width,image.height).data}
   })
   const prefix=preset.scml.replaceAll('\\','/').split('/').slice(0,-1).join('/'),configured=preset.image.replaceAll('\\','/')
   if(prefix&&!configured.startsWith(prefix+'/'))throw Error('目标图片必须位于 SCML 同目录或子目录')
   const imageId=prefix?configured.slice(prefix.length+1):configured,target=images.get(imageId),sourceHash=kleiHash(preset.sourceSymbol),symbol=food.builds[0]?.symbols.find(s=>s.hash===sourceHash)
   if(!target||!symbol||!symbol.frames.some(f=>f.parts.some(part=>part.textureId===imageId)))throw Error('模板 image 与 sourceSymbol 不匹配，请检查 presets.json')
   const xml=new DOMParser().parseFromString(new TextDecoder().decode(new Uint8Array(files[1].bytes)),'application/xml')
   const entries=[...xml.querySelectorAll('folder > file')].filter(file=>file.getAttribute('name')?.replaceAll('\\','/')===imageId)
   for(const file of entries)for(const [attribute,size] of [['width',target.width],['height',target.height]] as const){const value=file.getAttribute(attribute);if(value!==null&&Number(value)!==size)throw Error(`模板 PNG 与 SCML ${attribute} 不一致；为保护图层尺寸，拒绝处理`)}
   if(preset.fixedFrame!==undefined&&!symbol.frames.some(f=>preset.fixedFrame!>=f.index&&preset.fixedFrame!<f.index+f.duration&&f.parts.some(part=>part.textureId===imageId)))throw Error('fixedFrame 没有引用目标图片，无法保证预览与输出一致')
   if(!sceneBuild.builds.length||!scene.animations.length)throw Error('场景需要动画和基础 build，可配置独立 sceneBuild')
   const anim=chooseSceneAnimation(scene,preset.animation,preset.facing)
   if(!anim.frames[0].some(e=>e.symbol===kleiHash(preset.targetSymbol)))throw Error('预设动画第一帧中不存在目标通道')
   setLoaded({preset,scene,sceneBuild,food,target,imageId,sourceHash});setAnimationId(anim.id);setPlacement(defaultPlacement);past.current=[];future.current=[];setRevision(n=>n+1)
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 function acceptPicture(image:HTMLCanvasElement,fileName:string,job:{id:string;path:string}|undefined,dishName:string){
  setSource(image);setSelected(true);setName(dishName);setOutputJob(job);setNaming(undefined);setPlacement(defaultPlacement);past.current=[];future.current=[];setRevision(n=>n+1)
  setCompletedOutput(undefined)
  setStatus(job?`已创建输出目录：${job.path}`:'图片已导入；桌面模式下会在 output 创建工程目录。')
 }
 async function importPicture(bytes:Uint8Array,fileName:string){
  if(!loaded){setError(profile.missingTemplate);return}
  const sequence=++importSequence.current;setBusy(true);setError('')
  try{
   const image=trimTransparent(await decodeImage(bytes))
   if(sequence!==importSequence.current)return
   const job=isTauri()?await invoke<{id:string;path:string}>('prepare_cooking_output',{fileName,workspace:kind}):undefined
   if(sequence!==importSequence.current)return
   const candidate=imageStem(fileName)
   if(!validDishName(candidate)){setNaming({initial:candidate,pending:{image,fileName,job}});return}
   acceptPicture(image,fileName,job,candidate)
  }catch(e){if(sequence===importSequence.current)setError(String(e))}finally{if(sequence===importSequence.current)setBusy(false)}
 }
 const importPaths=async(paths:string[])=>{try{
  // Tauri desktop delivers all drops through the window-level event; character
  // packages dropped anywhere in the handheld workspace route to the character importer.
  if(kind==='handheld'&&paths.length&&paths.every(p=>/\.(zip|scml)$/i.test(p))){await importCharacter(paths);return}
  if(!loaded)throw Error(profile.missingTemplate);if(paths.length!==1)throw Error('请一次拖入一张图片');const [file]=await invoke<FileData[]>('read_imports',{paths});if(!/\.(png|jpg|jpeg|webp)$/i.test(file.path))throw Error('制作工作区仅接收图片');await importPicture(new Uint8Array(file.bytes),file.path.split(/[\\/]/).pop()!)
 }catch(e){setError(String(e))}}
// Character import: browser drops File objects; desktop paths go through read_imports.
 async function importCharacterBrowser(files:File[]){
  for(const file of files)await importCharacterData(file.name,new Uint8Array(await file.arrayBuffer()))
 }
 async function importCharacterData(fileName:string,bytes:Uint8Array,desktopPath?:string){
  if(!loaded)return
  const imported:CharacterBuild[]=[],missing:string[]=[]
  if(/\.zip$/i.test(fileName)){
   const pkg=await importZip(fileName,bytes)
   if(!pkg.builds.length)throw Error(`${fileName} 中没有 build，无法作为预览人物`)
   for(const build of pkg.builds)imported.push({id:pkg.id+':'+build.id,label:`${build.id} / ZIP`,buildId:build.id,package:pkg})
  }else if(/\.scml$/i.test(fileName)){
   const pkg=await importScml(fileName,bytes,async relative=>{
    if(desktopPath){
     let raw:number[]
     try{raw=await invoke<number[]>('read_related',{source:desktopPath,relative})}catch(e){if(String(e).startsWith('RELATED_NOT_FOUND:'))throw new MissingScmlImage(relative);throw e}
     const image=await decodeImage(new Uint8Array(raw))
     return {id:relative,width:image.width,height:image.height,rgba:image.getContext('2d')!.getImageData(0,0,image.width,image.height).data}
    }
    const files=[...(characterInput.current?.files??[])]
    const match=files.find(f=>f.name.replaceAll('\\','/')===relative)
    if(!match)throw Error(`浏览器模式需同时选入关联图片：${relative}`)
    const image=await decodeImage(new Uint8Array(await match.arrayBuffer()))
    return {id:relative,width:image.width,height:image.height,rgba:image.getContext('2d')!.getImageData(0,0,image.width,image.height).data}
   },{buildOnly:true,onMissingImage:path=>missing.push(path)})
   if(!pkg.textures.length)throw Error('人物 SCML 没有可读取的图片，请检查关联 PNG 是否齐全')
   for(const build of pkg.builds)imported.push({id:pkg.id+':'+build.id,label:`${build.id} / SCML`,buildId:build.id,package:pkg})
  }else throw Error('仅支持人物 ZIP 或 SCML 文件')
  setCharacters(existing=>[...(existing??[]).filter(old=>!imported.some(item=>item.id===old.id)),...imported]);setCharacterId(imported[0].id)
  setStatus(`已导入人物：${imported.map(item=>item.buildId).join('、')}。切换后武器调整保持不变。${missing.length?` 此工程缺少 ${missing.length} 张关联图片，已跳过：${missing.join('、')}`:''}`)
 }
async function importCharacter(paths:string[]){
  if(!loaded)return
  setBusy(true);setError('')
  try{
   const files=await invoke<FileData[]>('read_imports',{paths})
   for(const file of files)await importCharacterData(file.path.split(/[\\/]/).pop()!,new Uint8Array(file.bytes),file.path)
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 const chooseCharacter=async()=>{if(!isTauri()){characterInput.current?.click();return}const paths=await open({multiple:true,filters:[{name:'人物动画',extensions:['zip','scml']}]});if(paths)void importCharacter(Array.isArray(paths)?paths:[paths])}
 useEffect(()=>{if(!isTauri()||!active)return;const subscription=getCurrentWebviewWindow().onDragDropEvent(({payload})=>{if(payload.type==='drop')void importPaths(payload.paths)});return()=>{void subscription.then(fn=>fn()).catch(()=>{})}},[active,loaded,kind])
 const rendered=useMemo(()=>loaded&&source?rasterize(source,source.width,source.height,loaded.target.width,loaded.target.height,placement):undefined,[loaded,source,placement])
 const preview=useMemo(()=>{
  if(!loaded){if(!standby)return undefined;const anim=standby.scene.animations.find(a=>a.id===animationId);const elements=visibleSceneElements(anim?.frames[0]??[],kind);const channels=collectChannels(new Map([[standby.build.id,standby.build]]),emptyProject(),{packageId:standby.build.id,buildId:standby.build.builds[0].id,symbol:0},elements);return {anim,channels}}
  const food=rendered?{...loaded.food,textures:loaded.food.textures.map(t=>t.id===loaded.imageId?{...t,rgba:rendered.getContext('2d')!.getImageData(0,0,rendered.width,rendered.height).data}:t)}:loaded.food
  const project:Project={...emptyProject(),overrides:[{id:'cooking',enabled:true,targetSymbol:kleiHash(loaded.preset.targetSymbol),source:{packageId:food.id,buildId:food.builds[0].id,symbol:loaded.sourceHash},fixedFrame:loaded.preset.fixedFrame}]}
  const anim=loaded.scene.animations.find(a=>a.id===animationId)
  const elements=visibleSceneElements(anim?.frames[0]??[],kind)
  const defaultCharacter={id:'wilson',label:'wilson / ZIP',buildId:loaded.sceneBuild.builds[0].id,package:loaded.sceneBuild}
  const list=[defaultCharacter,...(characters??[]).filter(c=>c.id!=='wilson')]
  const active=list.find(c=>c.id===characterId)??defaultCharacter
  const channels=collectChannels(new Map([[active.package.id,active.package],[food.id,food]]),project,{packageId:active.package.id,buildId:active.buildId,symbol:0},elements)
  return {anim,channels,character:active}
 },[loaded,rendered,animationId,standby,kind,characters,characterId])
 const sceneView:Mat=multiply(viewMatrix(viewport),[1,0,0,1,450,430])
 const editBase=useMemo(()=>{
  if(!loaded)return undefined
  const food=preview?.channels.find(c=>c.item?.ruleId==='cooking')?.item
  if(!food)return undefined
  try{return textureToScreen(food,loaded.imageId,sceneView)}catch{return undefined}
 },[loaded,preview,viewport])
 const handles=editBase&&loaded&&source?gizmo(editBase,loaded.target.width,loaded.target.height,source.width,source.height,placement):undefined
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,900,660)
  if(!preview)return
  for(const c of preview?.channels??[])if(c.item)drawItem(ctx,c.item,sceneView)
  if(selected&&source&&handles){
   ctx.save();ctx.strokeStyle='#ffb340';ctx.fillStyle='#171208';ctx.lineWidth=1.5;ctx.beginPath();handles.corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke()
   const top={x:(handles.corners[0].x+handles.corners[1].x)/2,y:(handles.corners[0].y+handles.corners[1].y)/2};ctx.beginPath();ctx.moveTo(top.x,top.y);ctx.lineTo(handles.rotation.x,handles.rotation.y);ctx.stroke()
   for(const p of handles.corners){ctx.fillRect(p.x-5,p.y-5,10,10);ctx.strokeRect(p.x-5,p.y-5,10,10)}ctx.beginPath();ctx.arc(handles.rotation.x,handles.rotation.y,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()
  }
 },[loaded,rendered,preview,viewport,selected,source,placement])
 const position=(e:React.PointerEvent):Vec=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*900/r.width,y:(e.clientY-r.top)*660/r.height}}
 function hitMode(point:Vec):Gesture['mode']|undefined{
  if(!source||!editBase||!loaded)return
  if(handles&&Math.hypot(point.x-handles.center.x,point.y-handles.center.y)<8)return 'move'
  if(selected&&handles){if(Math.hypot(point.x-handles.rotation.x,point.y-handles.rotation.y)<12)return 'rotate';if(handles.corners.some(p=>Math.hypot(point.x-p.x,point.y-p.y)<12))return 'scale'}
  // Only the input image participates in hit-testing, never the pot. Its bounds
  // remain editable even behind opaque pot pixels or outside the output clip.
  const sourceMatrix=multiply(editBase,placementMatrix(loaded.target.width,loaded.target.height,source.width,source.height,placement))
  const p=transform(inverse(sourceMatrix),point)
  if(p.x>=0&&p.y>=0&&p.x<=source.width&&p.y<=source.height)return 'move'
  if(handles&&Math.hypot(point.x-handles.center.x,point.y-handles.center.y)<10)return 'move'
 }
 function pointerDown(e:React.PointerEvent<HTMLCanvasElement>){
  const point=position(e)
  if(e.button===1||(e.button===0&&space.current)){e.preventDefault();pan.current={point,view:viewport};e.currentTarget.setPointerCapture(e.pointerId);setCursor('grabbing');return}
  if(e.button!==0||busy||!loaded||!source||!editBase)return
  const mode=hitMode(point);setSelected(!!mode)
  if(!mode){pan.current={point,view:viewport};e.currentTarget.setPointerCapture(e.pointerId);setCursor('grabbing');return}
  setCursor(mode==='rotate'?rotationCursor:mode==='scale'?'nwse-resize':'grabbing')
  drag.current={mode,base:editBase,start:point,placement,center:{x:loaded.target.width/2+placement.x,y:loaded.target.height/2+placement.y}};gestureValue.current=placement;e.currentTarget.setPointerCapture(e.pointerId)
 }
 function pointerMove(e:React.PointerEvent<HTMLCanvasElement>){
  const point=position(e),g=drag.current,p=pan.current
  if(p){setViewport({...p.view,x:p.view.x+point.x-p.point.x,y:p.view.y+point.y-p.point.y});return}
  if(g){setCursor(g.mode==='rotate'?rotationCursor:g.mode==='scale'?'nwse-resize':'grabbing');const next=updateGesture(g,point,e.shiftKey);gestureValue.current=next;setPlacement(next)}
  else{const mode=hitMode(point);setCursor(space.current?'grab':mode==='move'?'grab':mode==='scale'?'nwse-resize':mode==='rotate'?rotationCursor:'default')}
 }
 function pointerEnd(cancel=false){
  if(pan.current){if(cancel)setViewport(pan.current.view);pan.current=null;setCursor(space.current?'grab':'default');return}
  const g=drag.current;if(!g)return
  if(cancel)setPlacement(g.placement)
  else if(gestureValue.current&&JSON.stringify(g.placement)!==JSON.stringify(gestureValue.current)){past.current.push(g.placement);future.current=[];setRevision(n=>n+1)}
  drag.current=null;gestureValue.current=undefined
 }
 async function exportProject(proposed=name||profile.defaultName){
  if(!rendered||!loaded)return
  if(!validDishName(proposed)){setNaming({initial:proposed});return}
  setName(proposed)
  if(!outputJob){setError(`尚未创建 output 目录，请重新导入${profile.label}图片`);return}
  setBusy(true);setError('');setCompletedOutput(undefined)
  try{const path=await invoke<string>('export_cooking',{id:loaded.preset.id,png:await pngBytes(rendered),name:proposed,jobId:outputJob.id});setCompletedOutput({jobId:outputJob.id,path});setStatus(`制作完成：${path}。占位符已替换为 ${proposed}，模板图层尺寸 ${rendered.width} × ${rendered.height}。`)}catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function openCompletedOutput(){
  if(!completedOutput||openingOutput)return
  setOpeningOutput(true)
  try{await invoke('open_cooking_output',completedOutput);setError('')}catch(e){setError(`无法打开输出目录：${String(e)}`)}finally{setOpeningOutput(false)}
 }
 const choose=async()=>{if(!isTauri()){input.current?.click();return}const path=await open({multiple:false,filters:[{name:`${profile.label}图片`,extensions:['png','jpg','jpeg','webp']}]});if(typeof path==='string')void importPaths([path])}
 const nameDialog=naming ? (
  <DishNameDialog
   label={profile.label} defaultName={profile.defaultName}
   initial={naming.initial}
   onCancel={()=>setNaming(undefined)}
   onConfirm={(value)=>{
    const pending=naming.pending
    setNaming(undefined)
    setName(value)
    if(pending)acceptPicture(pending.image,pending.fileName,pending.job,value)
    else void exportProject(value)
   }}
  />
 ) : null
 return <main className="cooking-workspace" data-workspace={kind} onDragOver={e=>e.preventDefault()} onDrop={e=>{
  e.preventDefault()
  if(!isTauri()){
   const file=e.dataTransfer.files[0]
   if(file)void file.arrayBuffer().then(b=>importPicture(new Uint8Array(b),file.name))
  }
 }}>
  {nameDialog}
  <header><strong>{profile.title}</strong><span>固定模板画布 · 只修改图片内容</span><button onClick={choose} disabled={busy||!loaded}>导入{profile.label}图片</button><button onClick={undo} disabled={!past.current.length}>撤销</button><button onClick={redo} disabled={!future.current.length}>重做</button></header>
  <input hidden ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void f.arrayBuffer().then(b=>importPicture(new Uint8Array(b),f.name))}}/>
  <input hidden ref={characterInput} type="file" multiple accept=".zip,.scml" onChange={e=>{const files=[...e.target.files??[]];if(files.length)void importCharacterBrowser(files).catch(err=>setError(String(err)));e.target.value=''}}/>
  {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>关闭</button></div>}
  <div className="layout">
   <aside className="cooking-workflow" aria-label={`${profile.label}制作流程`}>
    <h3>{profile.label}制作流程</h3>
    <ol>
     <li className={!source?'current':'done'} aria-current={!source?'step':undefined}><span className="step-number">1</span><div><strong>导入{profile.label}图片</strong><p>拖入图片，或点击导入按钮。</p></div></li>
     <li className={naming?.pending?'current':source?'done':''} aria-current={naming?.pending?'step':undefined}><span className="step-number">2</span><div><strong>确认{profile.label}名称</strong><p>名称不合规时按弹窗修改，或使用 {profile.defaultName}。</p></div></li>
     <li className={source&&!completedOutput?'current':completedOutput?'done':''} aria-current={source&&!completedOutput?'step':undefined}><span className="step-number">3</span><div><strong>调整{profile.sceneLabel}效果</strong><p>拖动{profile.subject}调整位置，使用手柄缩放、旋转。</p></div></li>
     <li className={completedOutput?'current':''} aria-current={completedOutput?'step':undefined}><span className="step-number">4</span><div><strong>制作并获取工程</strong><p>点击“开始制作”，完成后打开输出目录。</p></div></li>
    </ol>
    {kind==='handheld'&&<div className="character-panel">
     <h3>预览人物</h3>
     <ThemedSelect ariaLabel="预览人物 build" value={characterId} disabled={busy||!loaded} onChange={setCharacterId} options={[
      ...(loaded?[{value:'wilson',label:'wilson / ZIP'}]:[]),
      ...(characters??[]).map(c=>({value:c.id,label:c.label})),
     ]}/>
     <button onClick={()=>void chooseCharacter()} disabled={busy||!loaded}>导入人物动画</button>
     <div className="character-dropzone" aria-label="人物动画拖入区" onDragOver={e=>e.preventDefault()} onDrop={e=>{
      e.preventDefault();e.stopPropagation()
      if(!isTauri()){const files=[...e.dataTransfer.files].filter(f=>/\.(zip|scml)$/i.test(f.name));if(!files.length)return;void importCharacterBrowser(files).catch(err=>setError(String(err)));return}
      const paths=[...e.dataTransfer.files].map(f=>(f as File&{path?:string}).path??'').filter(Boolean)
      if(paths.length)void importCharacter(paths)
     }}>拖入人物 ZIP / SCML</div>
     <small>切换仅改变预览外观；武器调整与导出不受影响。人物包不写入 resources。</small>
    </div>}
   </aside>
   <section className="stage">
    <div className="cooking-view-tools"><Tooltip content="恢复视图，不重置食物"><button onClick={()=>setViewport(defaultViewport)}>重置视图</button></Tooltip><span>{Math.round(viewport.zoom*100)}%</span><small>空格＋左键 / 中键平移 · 滚轮缩放 · Shift 等比缩放 · Ctrl+Z 撤销</small></div>
    <div className="cooking-canvas-container">
     <canvas ref={canvas} width={900} height={660} aria-label={`${profile.label}交互画布`} style={{cursor:spaceHeld?'grab':cursor}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>pointerEnd()} onPointerCancel={()=>pointerEnd(true)} onLostPointerCapture={()=>pointerEnd()} onAuxClick={e=>e.preventDefault()}/>
     {!source&&<div className="cooking-import-overlay" aria-label={`${profile.label}图片导入引导`}><div><span className="cooking-import-icon" aria-hidden="true">＋</span><h2>{loaded?`拖入${profile.label}图片或导入${profile.label}图片`:busy?'正在加载预设…':'等待制作模板'}</h2>{!loaded&&!busy&&<p>{profile.missingTemplate}</p>}<button disabled={busy||!loaded} onClick={choose}>{busy?'正在准备…':`导入${profile.label}图片`}</button></div></div>}
    </div>
    {status&&<p role="status">{status}</p>}
   </section>
   <aside data-revision={revision}>{kind==='cooking'?<><h3>料理显示高度</h3><p>固定使用低层 · <code>swap_low</code></p><small>请在游戏料理配方中设置 <code>potlevel = "low"</code>，使实际效果与预览一致。</small></>:<><h3>人物手持预览</h3><p>Wilson · 持物站姿</p><small>显示 ARM_carry，隐藏 ARM_normal；只调整 swap_object 的替换图片，人物和红点保持不变。</small></>}<h3>图片变换</h3>{(['x','y','scale','scaleY','rotation'] as const).map(key=><label key={key}>{{x:'水平位置（像素）',y:'垂直位置（像素）',scale:'水平缩放',scaleY:'垂直缩放',rotation:'旋转（度）'}[key]}<input aria-label={`${profile.label}${key}`} type="number" disabled={!source} value={Number((placement[key]??placement.scale).toFixed(4))} step={key==='scale'||key==='scaleY'?0.01:1} min={key==='scale'||key==='scaleY'?0.001:undefined} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&((key!=='scale'&&key!=='scaleY')||n>0))setEdit({...placement,scaleY:placement.scaleY??placement.scale,[key]:n})}}/></label>)}<button disabled={!source} onClick={()=>setEdit(defaultPlacement)}>重置图片变换</button><h3>制作工程</h3><label>工程内部名称<input value={name} onChange={e=>setName(e.target.value)}/></label><button className="cooking-primary-action" disabled={!rendered||busy||!outputJob} onClick={()=>void exportProject()}>{busy?'处理中…':'开始制作'}</button>{completedOutput&&<Tooltip content={completedOutput.path}><button className="cooking-open-output" disabled={openingOutput||busy} onClick={()=>void openCompletedOutput()}>{openingOutput?'正在打开…':'打开输出目录'}</button></Tooltip>}<p>输出目录保留原图片名；模板内部占位符替换为工程内部名称。原模板不覆盖。</p></aside>
  </div>
 </main>
}
