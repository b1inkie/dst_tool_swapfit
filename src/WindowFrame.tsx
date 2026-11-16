import {useEffect,useState,type ReactNode} from 'react'
import {isTauri} from '@tauri-apps/api/core'
import {getCurrentWindow} from '@tauri-apps/api/window'
import './window-frame.css'

export default function WindowFrame({children}:{children:ReactNode}){
 const desktop=isTauri(),[maximized,setMaximized]=useState(false),[error,setError]=useState('')
 useEffect(()=>{
  if(!desktop)return
  const win=getCurrentWindow();let disposed=false
  const sync=()=>{void win.isMaximized().then(value=>{if(!disposed)setMaximized(value)}).catch(e=>{if(!disposed)setError(String(e))})}
  sync();const subscription=win.onResized(sync)
  return()=>{disposed=true;void subscription.then(unlisten=>unlisten()).catch(()=>{})}
 },[desktop])
 async function action(operation:'minimize'|'maximize'|'close'){
  if(!desktop)return
  try{
   const win=getCurrentWindow();setError('')
   if(operation==='minimize')await win.minimize()
   else if(operation==='close')await win.close()
   else{await win.toggleMaximize();setMaximized(await win.isMaximized())}
  }catch(e){setError(`窗口操作失败：${String(e)}`)}
 }
 return <div className="window-shell" data-maximized={maximized}>
  <div className="windowbar">
   <div className="window-drag-area" data-tauri-drag-region>
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 2 8 4-8 4-8-4 8-4Zm-8 8 8 4 8-4M2 14l8 4 8-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
    <span>DST SwapFit</span><span className="window-subtitle">贴图对位器</span>
   </div>
   <div className="window-controls">
    <button disabled={!desktop} aria-label="最小化窗口" title="最小化" onClick={()=>void action('minimize')}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor"/></svg></button>
    <button disabled={!desktop} aria-label={maximized?'还原窗口':'最大化窗口'} title={maximized?'还原':'最大化'} onClick={()=>void action('maximize')}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">{maximized?<path d="M5 5V3h8v8h-2M3 5h8v8H3z" stroke="currentColor"/>:<rect x="3.5" y="3.5" width="9" height="9" stroke="currentColor"/>}</svg></button>
    <button disabled={!desktop} className="window-close" aria-label="关闭窗口" title="关闭" onClick={()=>void action('close')}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3"/></svg></button>
   </div>
  </div>
  {error&&<div className="window-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="关闭窗口错误提示">×</button></div>}
  <div className="window-content">{children}</div>
 </div>
}
