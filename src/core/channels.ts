import type {AssetPackage,Element,Project,SymbolRef} from './model'
import {resolveElement,type DrawItem} from './resolve'
export type Channel = Readonly<{element:Element;item?:DrawItem;error?:string}>
// Animation channels exist independently of whether their image can be resolved.
export function collectChannels(packages:ReadonlyMap<string,AssetPackage>,project:Project,base:SymbolRef,elements:readonly Element[]):Channel[]{
 return elements.map(element=>{
  try{return {element,item:resolveElement(packages,project,base,element)}}
  catch(error){return {element,error:String(error)}}
 }).sort((a,b)=>a.element.z-b.element.z)
}
