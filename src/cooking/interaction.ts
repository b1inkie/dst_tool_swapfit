import type {Mat,Vec} from '../core/model'
import type {DrawItem} from '../core/resolve'
import {inverse,multiply,transform} from '../core/matrix'
import {placementMatrix,type ImagePlacement} from './image'
export function textureToScreen(item:DrawItem,textureId:string,view:Mat):Mat {
 for(let p=0;p<item.image.parts.length;p++){
  const part=item.image.parts[p],texture=item.textures[p];if(part.textureId!==textureId)continue
  for(let i=0;i<part.triangles.length;i+=3){
   const [a,b,c]=part.triangles.slice(i,i+3)
   const uv:Mat=[(b.u-a.u)*texture.width,(b.v-a.v)*texture.height,(c.u-a.u)*texture.width,(c.v-a.v)*texture.height,a.u*texture.width,a.v*texture.height]
   const xy:Mat=[b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y]
   try{return multiply(multiply(view,item.matrix),multiply(xy,inverse(uv)))}catch{continue}
  }
 }
 throw Error('食物没有可编辑的纹理映射')
}
export function itemAlpha(item:DrawItem,view:Mat,point:Vec):number{
 let local:Vec;try{local=transform(inverse(multiply(view,item.matrix)),point)}catch{return 0}
 for(let p=0;p<item.image.parts.length;p++){
  const part=item.image.parts[p],texture=item.textures[p]
  for(let i=0;i<part.triangles.length;i+=3){
   const [a,b,c]=part.triangles.slice(i,i+3);let uv:Vec
   try{uv=transform(inverse([b.x-a.x,b.y-a.y,c.x-a.x,c.y-a.y,a.x,a.y]),local)}catch{continue}
   if(uv.x<0||uv.y<0||uv.x+uv.y>1)continue
   const x=Math.floor((a.u+(b.u-a.u)*uv.x+(c.u-a.u)*uv.y)*texture.width),y=Math.floor((a.v+(b.v-a.v)*uv.x+(c.v-a.v)*uv.y)*texture.height)
   if(x>=0&&x<texture.width&&y>=0&&y<texture.height)return texture.rgba[(y*texture.width+x)*4+3]
  }
 }return 0
}
export function hitsFood(items:readonly DrawItem[],view:Mat,point:Vec):boolean{
 for(let i=items.length-1;i>=0;i--)if(items[i].ruleId==='cooking'&&itemAlpha(items[i],view,point)>16)return true
 return false
}
export type Gizmo={corners:Vec[];center:Vec;rotation:Vec}
export function gizmo(base:Mat,width:number,height:number,sourceWidth:number,sourceHeight:number,p:ImagePlacement):Gizmo{
 const m=multiply(base,placementMatrix(width,height,sourceWidth,sourceHeight,p))
 const corners=[{x:0,y:0},{x:sourceWidth,y:0},{x:sourceWidth,y:sourceHeight},{x:0,y:sourceHeight}].map(v=>transform(m,v))
 const center=transform(m,{x:sourceWidth/2,y:sourceHeight/2}),top=transform(m,{x:sourceWidth/2,y:0}),dx=top.x-center.x,dy=top.y-center.y,length=Math.hypot(dx,dy)||1
 return {corners,center,rotation:{x:top.x+dx/length*28,y:top.y+dy/length*28}}
}
export type Gesture={mode:'move'|'scale'|'rotate';base:Mat;start:Vec;placement:ImagePlacement;center:Vec}
export function updateGesture(g:Gesture,point:Vec,lockAspect=true):ImagePlacement{
 const inv=inverse(g.base),start=transform(inv,g.start),current=transform(inv,point),p=g.placement
 if(g.mode==='move')return {...p,x:p.x+current.x-start.x,y:p.y+current.y-start.y}
 const a={x:start.x-g.center.x,y:start.y-g.center.y},b={x:current.x-g.center.x,y:current.y-g.center.y}
 if(g.mode==='scale'){
  const clamp=(n:number)=>Math.max(0.001,Math.min(100,n)),sy=p.scaleY??p.scale
  if(lockAspect){const ratio=Math.hypot(b.x,b.y)/Math.max(0.001,Math.hypot(a.x,a.y));return {...p,scale:clamp(p.scale*ratio),...(p.scaleY===undefined?{}:{scaleY:clamp(sy*ratio)})}}
  const angle=-p.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),ax=a.x*c-a.y*s,ay=a.x*s+a.y*c,bx=b.x*c-b.y*s,by=b.x*s+b.y*c
  return {...p,scale:clamp(p.scale*(Math.abs(ax)<0.001?1:bx/ax)),scaleY:clamp(sy*(Math.abs(ay)<0.001?1:by/ay))}
 }
 const delta=Math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y)*180/Math.PI
 return {...p,rotation:p.rotation+delta}
}
