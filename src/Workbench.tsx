import {useState} from 'react'
import App from './App'
import CookingWorkspace from './cooking/CookingWorkspace'
import SettingsWorkspace from './settings/SettingsWorkspace'
import Tooltip from './ui/Tooltip'
import cookingIcon from './assets/icons/bonestew-normal.png'
import cookingIconActive from './assets/icons/bonestew-active.png'
import handheldIcon from './assets/icons/axe-normal.png'
import handheldIconActive from './assets/icons/axe-active.png'
import './workbench.css'
type Workspace='cooking'|'handheld'|'resources'|'projects'|'settings'
// 动画资源与工程暂未发布：功能保留，入口先隐藏（visible=false）。
const entries:{id:Workspace;label:string;icon:string;visible:boolean}[]=[{id:'cooking',label:'料理制作',icon:'◉',visible:true},{id:'handheld',label:'手持制作',icon:'⚒',visible:true},{id:'resources',label:'动画资源',icon:'▧',visible:false},{id:'projects',label:'工程',icon:'▤',visible:false},{id:'settings',label:'设置',icon:'⚙',visible:true}]
export default function Workbench(){
 const [active,setActive]=useState<Workspace>('cooking')
 // 若隐藏项被选中（如旧状态），回退到首个可见工作区。
 const current:Workspace=entries.find(e=>e.id===active&&e.visible!==false)?.id??'cooking'
 const icons:Partial<Record<Workspace,{normal:string;active:string}>>={cooking:{normal:cookingIcon,active:cookingIconActive},handheld:{normal:handheldIcon,active:handheldIconActive}}
 return <div className="workbench"><nav className="activity-bar" aria-label="活动栏">{entries.filter(e=>e.visible!==false).map(entry=><Tooltip key={entry.id} content={entry.label} side="right"><button className={current===entry.id?'active':''} aria-label={entry.label} aria-pressed={current===entry.id} onClick={()=>setActive(entry.id)}><span aria-hidden="true">{icons[entry.id]!==undefined?<img className="activity-image-icon" src={(current===entry.id?icons[entry.id]!.active:icons[entry.id]!.normal)} alt="" draggable={false}/>:entry.icon}</span><small>{entry.label}</small></button></Tooltip>)}</nav><div className="workspace-host">
 <div hidden={current!=='cooking'} className="workspace-view"><CookingWorkspace active={current==='cooking'}/></div>
 <div hidden={current!=='handheld'} className="workspace-view"><CookingWorkspace active={current==='handheld'} kind="handheld"/></div>
 <div hidden={current!=='resources'} className="workspace-view"><App active={current==='resources'}/></div>
 <div hidden={current!=='settings'} className="workspace-view"><SettingsWorkspace/></div>
 {current==='projects'&&<div className="placeholder-workspace"><aside><h3>工程</h3><p>料理制作可导出 Spriter 工程。</p></aside><section><h2>工程输出</h2><p>制作完成后可打开输出目录获取工程。</p><button onClick={()=>setActive('cooking')}>进入料理制作</button></section></div>}
 </div></div>
}
