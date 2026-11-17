export type TooltipSide='top'|'bottom'|'right'|'left'
export type HintRect={left:number;top:number;width:number;height:number}
export function tooltipPosition(anchor:HintRect,hint:{width:number;height:number},viewport:{width:number;height:number},side:TooltipSide){
 const gap=8,edge=8
 const right=anchor.left+anchor.width,bottom=anchor.top+anchor.height
 let left=anchor.left+(anchor.width-hint.width)/2,top=anchor.top-hint.height-gap
 if(side==='bottom')top=bottom+gap
 if(side==='right'||side==='left'){
  left=side==='right'?right+gap:anchor.left-hint.width-gap
  top=anchor.top+(anchor.height-hint.height)/2
  if(side==='right'&&left+hint.width>viewport.width-edge)left=anchor.left-hint.width-gap
  if(side==='left'&&left<edge)left=right+gap
 }else{
  if(side==='top'&&top<edge)top=bottom+gap
  if(side==='bottom'&&top+hint.height>viewport.height-edge)top=anchor.top-hint.height-gap
 }
 return {left:Math.max(edge,Math.min(left,viewport.width-hint.width-edge)),top:Math.max(edge,Math.min(top,viewport.height-hint.height-edge))}
}
