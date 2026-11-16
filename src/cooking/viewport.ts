import type {Mat,Vec} from '../core/model'
export type Viewport=Readonly<{zoom:number;x:number;y:number}>
export const defaultViewport:Viewport={zoom:1,x:0,y:0}
export function zoomAt(view:Viewport,point:Vec,delta:number):Viewport{
 const zoom=Math.max(0.1,Math.min(8,view.zoom*Math.exp(-delta*0.0015))),ratio=zoom/view.zoom
 return {zoom,x:point.x-(point.x-view.x)*ratio,y:point.y-(point.y-view.y)*ratio}
}
export const viewMatrix=(view:Viewport):Mat=>[view.zoom,0,0,view.zoom,view.x,view.y]
export function editingTarget(target:EventTarget|null):boolean{
 return target instanceof HTMLElement&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')
}
