import {useEffect,useRef,useState} from 'react'
import Tooltip from './Tooltip'
import './themed-select.css'
export type ThemedOption=Readonly<{value:string;label:string}>
// Native <select> popups cannot be themed on Windows WebView2; this component
// renders an accessible custom listbox styled entirely from theme tokens.
export default function ThemedSelect({value,onChange,options,ariaLabel,disabled}:{value:string;onChange:(value:string)=>void;options:readonly ThemedOption[];ariaLabel:string;disabled?:boolean}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),root=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  if(!open)return
  const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)}
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)}
  document.addEventListener('mousedown',outside);document.addEventListener('keydown',escape)
  return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',escape)}
 },[open])
 useEffect(()=>{setActive(Math.max(0,options.findIndex(option=>option.value===value)))},[value,options])
 if(disabled||!options.length)return <div className="themed-select themed-select-disabled" aria-label={ariaLabel}>{options.find(option=>option.value===value)?.label??'—'}</div>
 const selected=options.find(option=>option.value===value)??options[0]
 const commit=(index:number)=>{onChange(options[index].value);setOpen(false)}
 const keyDown=(event:React.KeyboardEvent)=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)commit(active);else setOpen(true)}
  else if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(i=>Math.min(options.length-1,(open?i:i)+1))}
  else if(event.key==='ArrowUp'){event.preventDefault();setActive(i=>Math.max(0,i-1))}
 }
 return <div className={'themed-select'+(open?' open':'')} ref={root} aria-label={ariaLabel}>
  <button type="button" className="themed-select-header" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={()=>setOpen(!open)} onKeyDown={keyDown}>
   <span className="themed-select-value">{selected.label}</span><span className="themed-select-arrow" aria-hidden="true"/>
  </button>
  {open&&<ul className="themed-select-list" role="listbox" aria-label={ariaLabel}>
   {options.map((option,index)=><Tooltip key={option.value} content={option.label} side="right"><li role="option" aria-selected={option.value===selected.value} className={'themed-select-option'+(index===active?' active':'')+(option.value===selected.value?' selected':'')} onMouseEnter={()=>setActive(index)} onMouseDown={event=>{event.preventDefault();commit(index)}}><span className="themed-select-option-label">{option.label}</span><span className="themed-select-check" aria-hidden="true">✓</span></li></Tooltip>)}
  </ul>}
 </div>
}
