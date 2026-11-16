import {useEffect,useRef,useState} from 'react'
import {defaultDishName,dishNameRule,validDishName} from './naming'
export default function DishNameDialog({initial,onConfirm,onCancel,label='料理',defaultName=defaultDishName}:{initial:string;onConfirm:(name:string)=>void;onCancel:()=>void;label?:string;defaultName?:string}){
 const dialog=useRef<HTMLDialogElement>(null),[value,setValue]=useState(initial)
 useEffect(()=>{const d=dialog.current!;d.showModal();return()=>d.close()},[])
 return <dialog ref={dialog} className="dish-name-dialog" aria-labelledby="dish-name-title" onCancel={e=>{e.preventDefault();onCancel()}}>
  <form onSubmit={e=>{e.preventDefault();if(validDishName(value))onConfirm(value)}}>
   <h2 id="dish-name-title">请设置合规的{label}名称</h2><p>名称“{initial}”不符合规则，请修改或选择默认名称。</p><p id="dish-name-rule">{dishNameRule}</p>
   <label>{label}名称<input autoFocus aria-label={`合规${label}名称`} aria-describedby="dish-name-rule" aria-invalid={!validDishName(value)} value={value} onChange={e=>setValue(e.target.value)}/></label>
   <div className="dish-name-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" onClick={()=>onConfirm(defaultName)}>使用默认名 {defaultName}</button><button type="submit" disabled={!validDishName(value)}>确认名称</button></div>
  </form>
 </dialog>
}
