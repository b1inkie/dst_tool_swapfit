import {useEffect,useRef,useState} from 'react'
import {invoke,isTauri} from '@tauri-apps/api/core'
import {check,type Update} from '@tauri-apps/plugin-updater'
import {relaunch} from '@tauri-apps/plugin-process'
import './settings.css'
type Status={version:string;enabled:boolean;reason?:string}
type Phase='idle'|'checking'|'latest'|'available'|'downloading'|'ready'|'installing'|'installed'
export default function SettingsWorkspace(){
 const [status,setStatus]=useState<Status>(),[phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState(''),[release,setRelease]=useState<{version:string;body?:string}>(),[bytes,setBytes]=useState(0),[total,setTotal]=useState<number>(),[checked,setChecked]=useState<string>(),[confirmed,setConfirmed]=useState(false)
 const update=useRef<Update|null>(null),lock=useRef(false),alive=useRef(true)
 useEffect(()=>{alive.current=true;if(isTauri())void invoke<Status>('update_status').then(s=>{if(alive.current)setStatus(s)}).catch(e=>{if(alive.current)setError(`无法读取版本信息：${String(e)}`)});else setStatus({version:'—',enabled:false,reason:'请在桌面应用中检查更新。'});return()=>{alive.current=false;void update.current?.close().catch(()=>{})}},[])
 async function checkNow(){
  if(lock.current||!status?.enabled)return;lock.current=true;setError('');setPhase('checking');setConfirmed(false)
  try{
   await update.current?.close();update.current=null;setRelease(undefined)
   const next=await check({timeout:20000});if(!alive.current){await next?.close();return}
   update.current=next;setChecked(new Date().toLocaleString());setRelease(next?{version:next.version,body:next.body}:undefined);setPhase(next?'available':'latest')
  }catch(e){setError(`检查更新失败，请检查网络后重试。${String(e)}`);setPhase('idle')}finally{lock.current=false}
 }
 async function download(){
  if(lock.current||!update.current)return;lock.current=true;setPhase('downloading');setError('');setBytes(0);setTotal(undefined)
  try{await update.current.download(event=>{
   if(event.event==='Started'){setTotal(event.data.contentLength);setBytes(0)}
   else if(event.event==='Progress')setBytes(n=>n+event.data.chunkLength)
  },{timeout:120000});setPhase('ready')}catch(e){setError(`下载或签名校验失败，可重新下载。${String(e)}`);setPhase('available')}finally{lock.current=false}
 }
 async function install(){
  if(lock.current||!update.current||!confirmed)return;lock.current=true;setPhase('installing');setError('')
  try{await update.current.install({restartAfterInstall:true});setPhase('installed');await restart()}catch(e){setError(`安装未完成，请重试。${String(e)}`);setPhase('ready')}finally{lock.current=false}
 }
 async function restart(){try{await relaunch()}catch(e){setError(`更新已安装，请关闭并重新打开应用。${String(e)}`)}}
 const busy=['checking','downloading','installing'].includes(phase)
 const titles:Record<Phase,string>={idle:'检查新版本',checking:'正在检查更新…',latest:'当前已是最新版本',available:'发现新版本',downloading:'正在下载更新…',ready:'更新已准备就绪',installing:'正在启动安装程序…',installed:'更新已安装，等待重启'}
 return <main className="settings-workspace"><header><strong>设置</strong><span>版本与更新</span></header><div className="settings-body">
 <section className="settings-card"><div className="settings-brand"><div className="settings-mark" aria-hidden="true">SF</div><div><h2>DST SwapFit</h2><p>贴图对位器</p></div><span className="settings-version">v{status?.version??'…'}</span></div></section>
 <section className="settings-card" aria-labelledby="update-title"><h3 id="update-title">软件更新</h3><p className="update-status" role="status">{status?.enabled?titles[phase]:status?.reason??'正在读取版本信息…'}</p>{checked&&<small>上次检查：{checked}</small>}
 {error&&<p className="settings-error" role="alert">{error}</p>}
 {release&&<div className="release-notes"><strong>新版本 v{release.version}</strong><p>{release.body?.trim()||'此版本未提供更新说明。'}</p></div>}
 {phase==='downloading'&&<div className="update-progress"><progress aria-label="更新下载进度" max={total||1} value={total?Math.min(bytes,total):undefined}/><small>{(bytes/1048576).toFixed(1)} MB{total?` / ${(total/1048576).toFixed(1)} MB · ${Math.min(100,Math.floor(bytes/total*100))}%`:''}</small></div>}
 {phase==='ready'&&<label className="install-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>我已保存或制作完成当前工程，可以关闭应用并安装更新。</label>}
 <div className="settings-actions"><button disabled={!status?.enabled||busy||phase==='ready'||phase==='installed'} onClick={()=>void checkNow()}>{phase==='checking'?'正在检查…':'检查更新'}</button>
 {phase==='available'&&<button className="settings-primary" onClick={()=>void download()}>下载更新</button>}
 {phase==='ready'&&<button className="settings-primary" disabled={!confirmed} onClick={()=>void install()}>安装并重启</button>}{phase==='installed'&&<button onClick={()=>void restart()}>重新启动</button>}</div>
 {phase==='ready'&&<small>安装会关闭应用。尚未制作的图片调整不会自动保存。</small>}
 </section></div></main>
}
