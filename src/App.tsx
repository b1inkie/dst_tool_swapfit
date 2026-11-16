import {useEffect,useRef,useState} from 'react'
import type {AssetPackage,Mat,OffsetEdit,Project,SymbolRef} from './core/model'
import {emptyProject,imageKey,ruleFrameKey} from './core/model'
import {History,parseProject} from './core/project'
import {localDrag,multiply,transform} from './core/matrix'
import type {DrawItem} from './core/resolve'
import {collectChannels} from './core/channels'
import {selectSources} from './core/selection'
import {drawItem,hitItem} from './renderer/canvas'
import {importZip} from './importers/zip'
import {importScml} from './importers/scml'
import {invoke,isTauri} from '@tauri-apps/api/core'
import {getCurrentWebviewWindow} from '@tauri-apps/api/webviewWindow'
import {open} from '@tauri-apps/plugin-dialog'
import './style.css'
type DesktopFile={path:string;bytes:number[]}
export default function App({active=true}:{active?:boolean}){
 const [packages,setPackages]=useState<AssetPackage[]>([]),[project,setProject]=useState<Project>(emptyProject),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [animationId,setAnimationId]=useState(''),[basePackage,setBasePackage]=useState(''),[buildId,setBuildId]=useState(''),[frame,setFrame]=useState(0),[playing,setPlaying]=useState(false),[zoom,setZoom]=useState(1)
 const [buildPackageId,setBuildPackageId]=useState('')
 const [selected,setSelected]=useState(-1),[scope,setScope]=useState<'asset'|'override'>('override'),[sourcePackage,setSourcePackage]=useState(''),[sourceBuild,setSourceBuild]=useState(''),[sourceSymbol,setSourceSymbol]=useState('')
 const canvas=useRef<HTMLCanvasElement>(null),history=useRef(new History(emptyProject())),drag=useRef<{start:{x:number;y:number};edit:OffsetEdit;item:DrawItem}|null>(null)
 const [preview,setPreview]=useState<OffsetEdit>(),[diagnostics,setDiagnostics]=useState<string[]>([])
 const input=useRef<HTMLInputElement>(null),projectInput=useRef<HTMLInputElement>(null)
 const pkg=packages.find(p=>p.id===basePackage),anim=pkg?.animations.find(a=>a.id===animationId)
 const buildPackage=packages.find(p=>p.id===buildPackageId),build=buildPackage?.builds.find(b=>b.id===buildId)
 const registry=new Map(packages.map(p=>[p.id,p])),view:Mat=[zoom,0,0,zoom,450,330]
 const effective=preview?{...project,offsets:[...project.offsets.filter(o=>o.scope!==preview.scope||o.key!==preview.key),preview]}:project
 const elements=anim?.frames[frame]??[]
 const channels=collectChannels(registry,effective,{packageId:buildPackageId,buildId,symbol:0},elements)
 const items=channels.flatMap(channel=>channel.item?[channel.item]:[])
 const issues=channels.flatMap(channel=>channel.error?[`${pkg?.names[channel.element.symbol]??buildPackage?.names[channel.element.symbol]??channel.element.symbol} / frame ${channel.element.frame}：${channel.error}`]:[])
 const selectedChannel=channels[selected],selectedElement=selectedChannel?.element,chosen=selectedChannel?.item
 const selectedRule=selectedElement&&project.overrides.find(r=>r.enabled&&r.targetSymbol===selectedElement.symbol&&(r.targetLayer===undefined||r.targetLayer===selectedElement.layer))
 const commit=(command:Parameters<History['commit']>[0])=>{history.current.commit(command);setProject(history.current.current)}
 const updateProject=(p:Project)=>{history.current=new History(p);setProject(p)}
 const notify=(e:unknown)=>setError(String(e))
 async function importFiles(files:{name:string;bytes:Uint8Array;path?:string}[]){
  setBusy(true);setError('')
  try{
   const loaded:AssetPackage[]=[]
   for(const file of files.filter(f=>/\.(zip|scml)$/i.test(f.name))){
    if(/\.zip$/i.test(file.name))loaded.push(await importZip(file.name,file.bytes))
    else loaded.push(await importScml(file.name,file.bytes,async relative=>{
     let bytes:Uint8Array
     if(file.path&&isTauri())bytes=new Uint8Array(await invoke<number[]>('read_related',{source:file.path,relative}))
     else {const match=files.find(f=>f.name.replaceAll('\\','/')===relative);if(!match)throw Error(`浏览器模式需同时选入关联图片：${relative}`);bytes=match.bytes}
     const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)])),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height
     const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close()
     return {id:relative,width:c.width,height:c.height,rgba:ctx.getImageData(0,0,c.width,c.height).data}
    }))
   }
   if(!loaded.length)throw Error('请选择 ZIP 或 SCML')
   const all=[...packages];for(const p of loaded)if(!all.some(v=>v.id===p.id))all.push(p)
   setPackages(all)
   const references=[...project.packages]
   for(const p of all)if(!references.some(ref=>ref.id===p.id))references.push({id:p.id,name:p.name})
   updateProject({...project,packages:references})
   const selection=selectSources(all,{packageId:basePackage,animationId,buildPackageId,buildId})
   setBasePackage(selection.packageId);setAnimationId(selection.animationId)
   setBuildPackageId(selection.buildPackageId);setBuildId(selection.buildId)
  }catch(e){notify(e)}finally{setBusy(false)}
 }
 const importPaths=async(paths:string[])=>{try{const files=await invoke<DesktopFile[]>('read_imports',{paths});await importFiles(files.map(f=>({name:f.path.split(/[\\/]/).pop()!,path:f.path,bytes:new Uint8Array(f.bytes)})))}catch(e){notify(e)}}
 useEffect(()=>{if(!isTauri()||!active)return;const unlisten=getCurrentWebviewWindow().onDragDropEvent(({payload})=>{if(payload.type==='drop')void importPaths(payload.paths)});return()=>{void unlisten.then(fn=>fn())}},[active,packages,project,basePackage,animationId,buildPackageId,buildId])
 useEffect(()=>{
  if(!active||!playing||!anim)return
  const timer=setInterval(()=>setFrame(f=>(f+1)%anim.frames.length),1000/anim.fps);return()=>clearInterval(timer)
 },[active,playing,anim])
 useEffect(()=>{
  const c=canvas.current;if(!c)return;const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height)
  ctx.strokeStyle='#3f3423';ctx.beginPath();ctx.moveTo(0,330);ctx.lineTo(900,330);ctx.moveTo(450,0);ctx.lineTo(450,660);ctx.stroke()
  for(const item of items)drawItem(ctx,item,view)
  if(selectedElement){const p=transform(multiply(view,selectedElement.matrix),{x:0,y:0});ctx.fillStyle='#ff536b';ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ff536b';ctx.beginPath();ctx.moveTo(p.x-12,p.y);ctx.lineTo(p.x+12,p.y);ctx.moveTo(p.x,p.y-12);ctx.lineTo(p.x,p.y+12);ctx.stroke()}
  setDiagnostics(prev=>JSON.stringify(prev)===JSON.stringify(issues)?prev:issues)
 },[packages,project,preview,animationId,basePackage,buildPackageId,buildId,frame,zoom,selected])
 const position=(e:React.PointerEvent)=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*900/r.width,y:(e.clientY-r.top)*660/r.height}}
 function offsetFor(item:DrawItem):OffsetEdit{
  const actualScope=scope==='override'&&item.ruleId?'override':'asset',key=actualScope==='override'?ruleFrameKey(item.ruleId!,item.image.index):imageKey(item.source,item.image.index)
  return project.offsets.find(o=>o.scope===actualScope&&o.key===key)??{scope:actualScope,key,x:0,y:0}
 }
 function applyOverride(){
  if(!selectedElement||!sourcePackage||!sourceBuild||!sourceSymbol)return
  const source:SymbolRef={packageId:sourcePackage,buildId:sourceBuild,symbol:Number(sourceSymbol)}
  commit({type:'override',rule:{id:`symbol:${selectedElement.symbol}:layer:${selectedElement.layer}`,enabled:true,targetSymbol:selectedElement.symbol,targetLayer:selectedElement.layer,source}})
 }
 const choose=async()=>{if(!isTauri()){input.current?.click();return}const paths=await open({multiple:true,filters:[{name:'动画',extensions:['zip','scml']}]});if(paths)void importPaths(Array.isArray(paths)?paths:[paths])}
 const downloadProject=()=>{const p={...project,selection:basePackage&&buildPackageId&&buildId&&animationId?{packageId:basePackage,buildPackageId,buildId,animationId}:undefined},url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='alignment.dst-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
 return <main onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!isTauri())void Promise.all([...e.dataTransfer.files].map(async f=>({name:f.webkitRelativePath||f.name,bytes:new Uint8Array(await f.arrayBuffer())}))).then(importFiles)}}>
 <header><strong>DST SwapFit</strong><span>贴图对位 · swap 通道对齐</span><button onClick={choose} disabled={busy}>{busy?'解析中…':'导入 ZIP / SCML'}</button><button onClick={downloadProject}>保存工程</button><button onClick={()=>projectInput.current?.click()}>打开工程</button><button onClick={()=>{history.current.undo();setProject(history.current.current)}}>撤销</button><button onClick={()=>{history.current.redo();setProject(history.current.current)}}>重做</button></header>
  <input hidden ref={input} type="file" multiple onChange={e=>{void Promise.all([...e.target.files??[]].map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())}))).then(importFiles)}}/>
  <input hidden ref={projectInput} type="file" accept=".json" onChange={async e=>{try{const f=e.target.files?.[0];if(!f)return;const p=parseProject(await f.text());updateProject(p);if(p.selection){setBasePackage(p.selection.packageId);setBuildPackageId(p.selection.buildPackageId??p.selection.packageId);setBuildId(p.selection.buildId);setAnimationId(p.selection.animationId);setFrame(0)}setError('工程已打开；请重新导入对应源文件，摘要相同会自动关联。')}catch(e){notify(e)}}}/>
  {error&&<div className="error">{error}<button onClick={()=>setError('')}>关闭</button></div>}
  <div className="layout"><aside><h3>动画来源</h3><select aria-label="动画包" value={basePackage} onChange={e=>{const p=packages.find(p=>p.id===e.target.value);setBasePackage(p?.id??'');setAnimationId(p?.animations[0]?.id??'');setFrame(0);setSelected(-1)}}><option value="">选择动画包</option>{packages.filter(p=>p.animations.length).map(p=><option key={p.id} value={p.id}>{p.name} · {p.id.slice(0,6)}</option>)}</select>
  <select aria-label="动画" value={animationId} onChange={e=>{setAnimationId(e.target.value);setFrame(0);setSelected(-1)}}>{pkg?.animations.map(a=><option key={a.id} value={a.id}>{a.name} · facing {a.facing}</option>)}</select>
  <h3>基础 Build 来源</h3><select aria-label="基础 Build 包" value={buildPackageId} onChange={e=>{const p=packages.find(p=>p.id===e.target.value);setBuildPackageId(p?.id??'');setBuildId(p?.builds[0]?.id??'');setSelected(-1)}}><option value="">选择 Build 包</option>{packages.filter(p=>p.builds.length).map(p=><option key={p.id} value={p.id}>{p.name} · {p.id.slice(0,6)}</option>)}</select>
  <select aria-label="基础 Build" value={buildId} onChange={e=>{setBuildId(e.target.value);setSelected(-1)}}>{buildPackage?.builds.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
  {anim&&!build&&<p>动画已加载，请再导入或选择包含 build 的资源包。</p>}
  <h3>当前帧通道（{channels.length}）</h3><small>symbol / layer / 图片编号（含无素材通道）</small>{channels.map((channel,i)=><button data-symbol={pkg?.names[channel.element.symbol]??channel.element.symbol} className={i===selected?'selected':'channel'} key={i} onClick={()=>{setSelected(i);setPlaying(false)}}>{pkg?.names[channel.element.symbol]??buildPackage?.names[channel.element.symbol]??channel.element.symbol}<small>{pkg?.names[channel.element.layer]??channel.element.layer} / {channel.element.frame}{channel.item?.ruleId?' · override':''}{!channel.item?' · 无素材':''}</small></button>)}
  {!packages.length&&<p>把 ZIP 或 SCML 拖入窗口。无需游戏目录。</p>}</aside>
  <section className="stage"><canvas width={900} height={660} ref={canvas} onPointerDown={e=>{setPlaying(false);const p=position(e),i=channels.findLastIndex(channel=>channel.item?hitItem(channel.item,view,p):false);setSelected(i);const item=channels[i]?.item;if(!item)return;drag.current={start:p,edit:offsetFor(item),item};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;try{const p=position(e),d=drag.current,delta=localDrag(view,d.item.element.matrix,{x:p.x-d.start.x,y:p.y-d.start.y});setPreview({...d.edit,x:d.edit.x+delta.x,y:d.edit.y+delta.y})}catch(e){notify(e);drag.current=null;setPreview(undefined)}}} onPointerUp={()=>{if(drag.current&&preview)commit({type:'offset',edit:preview});drag.current=null;setPreview(undefined)}} onPointerCancel={()=>{drag.current=null;setPreview(undefined)}}/>
  <footer><button disabled={!anim} onClick={()=>setPlaying(!playing)}>{playing?'暂停':'播放'}</button><button onClick={()=>{setPlaying(false);setFrame(f=>Math.max(0,f-1))}}>上一帧</button><input type="range" min={0} max={Math.max(0,(anim?.frames.length??1)-1)} value={frame} onChange={e=>{setPlaying(false);setFrame(Number(e.target.value))}}/><span>{frame+1}/{anim?.frames.length??0}</span><label>缩放<input type="number" min="0.05" max="10" step="0.1" value={zoom} onChange={e=>{const n=Number(e.target.value);if(n>=0.05&&n<=10)setZoom(n)}}/></label></footer>
  <small>点击图片选择，拖动仅改变图片局部偏移；红点与动画原矩阵不变。当前为核心验证原型。</small>{diagnostics.length>0&&<details className="diagnostics"><summary>当前帧有 {diagnostics.length} 个素材引用未能显示（其余部件正常绘制）</summary><p>动画可能包含当前 Build 没有的装备、装饰或素材帧。可更换基础 Build 或补充 override；不会自动使用错误的图片兜底。</p>{[...new Set(diagnostics)].map((d,i)=><p key={i}>{d}</p>)}</details>}</section>
  <aside><h3>跨包 Override</h3><p>选择动画通道，再指定其他包的素材。无素材通道也可替换。</p>{selectedElement&&<p data-testid="channel-pivot">{pkg?.names[selectedElement.symbol]??selectedElement.symbol}<br/>红点 X={selectedElement.matrix[4].toFixed(2)}，Y={selectedElement.matrix[5].toFixed(2)}<br/>素材编号 {selectedElement.frame}{!chosen?' · 尚无可绘制图片':''}</p>}<select aria-label="Override 包" value={sourcePackage} onChange={e=>{setSourcePackage(e.target.value);setSourceBuild('');setSourceSymbol('')}}><option value="">来源包</option>{packages.filter(p=>p.builds.length).map(p=><option key={p.id} value={p.id}>{p.name} · {p.id.slice(0,6)}</option>)}</select><select aria-label="Override Build" value={sourceBuild} onChange={e=>{setSourceBuild(e.target.value);setSourceSymbol('')}}><option value="">来源 build</option>{packages.find(p=>p.id===sourcePackage)?.builds.map(b=><option key={b.id}>{b.id}</option>)}</select><select aria-label="Override Symbol" value={sourceSymbol} onChange={e=>setSourceSymbol(e.target.value)}><option value="">来源 symbol</option>{packages.find(p=>p.id===sourcePackage)?.builds.find(b=>b.id===sourceBuild)?.symbols.map(s=><option value={s.hash} key={s.hash}>{s.name}</option>)}</select><button disabled={!selectedElement||!sourceSymbol} onClick={applyOverride}>替换选中通道</button>{selectedRule&&<button onClick={()=>commit({type:'removeOverride',id:selectedRule.id})}>移除替换</button>}
  <h3>图片局部偏移</h3><select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="override">当前替换规则（无替换时为素材）</option><option value="asset">当前素材帧（全部引用）</option></select>{chosen&&<>{(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()}<input type="number" step="1" value={offsetFor(chosen)[axis]} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n))commit({type:'offset',edit:{...offsetFor(chosen),[axis]:n}})}}/></label>)}<p>frame {chosen.image.index} · {chosen.source.packageId.slice(0,6)}</p></>}<p>工程仅保存替换与偏移，不覆盖原包。目前不生成游戏用 ZIP/SCML。</p></aside></div>
 </main>
}
