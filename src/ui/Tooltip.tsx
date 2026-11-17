import {cloneElement,useEffect,useId,useLayoutEffect,useRef,useState,type HTMLAttributes,type ReactElement} from 'react'
import {createPortal} from 'react-dom'
import {tooltipPosition,type TooltipSide} from './tooltip-position'
import './tooltip.css'
type TriggerProps=HTMLAttributes<HTMLElement>&{disabled?:boolean}
/** Non-interactive hint: no wrapper, no focus target, and no pointer interception. */
export default function Tooltip({content,side='top',children}:{content:string;side?:TooltipSide;children:ReactElement<TriggerProps>}){
 const id=useId(),anchor=useRef<HTMLElement|null>(null),popup=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>>()
 const [open,setOpen]=useState(false),[position,setPosition]=useState<{left:number;top:number}>()
 const clear=()=>{clearTimeout(timer.current);timer.current=undefined}
 const dismiss=()=>{clear();setOpen(false);setPosition(undefined)}
 const show=(element:HTMLElement,immediate=false)=>{
  clear();anchor.current=element
  if(children.props.disabled||!content.trim())return
  if(immediate){setOpen(true);return}
  timer.current=setTimeout(()=>{timer.current=undefined;if(element.isConnected)setOpen(true)},350)
 }
 useEffect(()=>clear,[])
 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')dismiss()}
  document.addEventListener('keydown',escape);window.addEventListener('blur',dismiss);window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true)
  return()=>{document.removeEventListener('keydown',escape);window.removeEventListener('blur',dismiss);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true)}
 },[])
 useEffect(()=>{if(children.props.disabled)dismiss()},[children.props.disabled])
 useLayoutEffect(()=>{
  if(!open||!popup.current||!anchor.current)return
  setPosition(tooltipPosition(anchor.current.getBoundingClientRect(),popup.current.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight},side))
 },[open,content,side])
 const props=children.props
 return <>{cloneElement(children,{
  title:undefined,
  'aria-describedby':[props['aria-describedby'],open?id:undefined].filter(Boolean).join(' ')||undefined,
  onMouseEnter:event=>{props.onMouseEnter?.(event);show(event.currentTarget)},
  onMouseLeave:event=>{props.onMouseLeave?.(event);dismiss()},
  onFocus:event=>{props.onFocus?.(event);show(event.currentTarget,true)},
  onBlur:event=>{props.onBlur?.(event);dismiss()},
  onPointerDown:event=>{props.onPointerDown?.(event);dismiss()},
  onClick:event=>{props.onClick?.(event);dismiss()},
 })}{open&&createPortal(<div ref={popup} id={id} role="tooltip" className="themed-tooltip" style={{left:position?.left??0,top:position?.top??0,visibility:position?'visible':'hidden'}}>{content}</div>,document.body)}</>
}
