import type {DrawItem} from '../core/resolve'
import type {Mat,Texture,Vec} from '../core/model'
import {multiply,transform,inverse} from '../core/matrix'
const sources=new WeakMap<Texture,HTMLCanvasElement>()
function source(texture:Texture){
 let canvas=sources.get(texture)
 if(!canvas){canvas=document.createElement('canvas');canvas.width=texture.width;canvas.height=texture.height;canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(texture.rgba),texture.width,texture.height),0,0);sources.set(texture,canvas)}
 return canvas
}
export function drawItem(ctx:CanvasRenderingContext2D,item:DrawItem,view:Mat){
 const matrix=multiply(view,item.matrix)
 item.image.parts.forEach((part,p)=>{
  const texture=item.textures[p],image=source(texture)
  const groups=new Map<string,{mapping:Mat;triangles:Vec[][]}>()
  for(let i=0;i<part.triangles.length;i+=3){
   const vertices=part.triangles.slice(i,i+3),dest=vertices.map(v=>transform(matrix,v)),uv=vertices.map(v=>({x:v.u*texture.width,y:v.v*texture.height}))
   const from:Mat=[uv[1].x-uv[0].x,uv[1].y-uv[0].y,uv[2].x-uv[0].x,uv[2].y-uv[0].y,uv[0].x,uv[0].y]
   const to:Mat=[dest[1].x-dest[0].x,dest[1].y-dest[0].y,dest[2].x-dest[0].x,dest[2].y-dest[0].y,dest[0].x,dest[0].y]
   let mapping:Mat;try{mapping=multiply(to,inverse(from))}catch{continue}
   const key=mapping.map(n=>n.toFixed(5)).join(',')
   const group=groups.get(key)
   if(group)group.triangles.push(dest);else groups.set(key,{mapping,triangles:[dest]})
  }
  // Shared-edge triangles with one UV mapping must be clipped together;
  // drawing them separately creates an antialiased diagonal alpha seam.
  for(const group of groups.values()){
   ctx.save();ctx.beginPath()
   for(const dest of group.triangles){ctx.moveTo(dest[0].x,dest[0].y);ctx.lineTo(dest[1].x,dest[1].y);ctx.lineTo(dest[2].x,dest[2].y);ctx.closePath()}
   ctx.clip();ctx.setTransform(...group.mapping);ctx.drawImage(image,0,0);ctx.restore()
  }
 })
}
export function hitItem(item:DrawItem,view:Mat,point:Vec):boolean{
 let p:Vec;try{p=transform(inverse(multiply(view,item.matrix)),point)}catch{return false}
 for(const part of item.image.parts)for(let i=0;i<part.triangles.length;i+=3){
  const [a,b,c]=part.triangles.slice(i,i+3),cross=(u:Vec,v:Vec,w:Vec)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x)
  const x=cross(a,b,p),y=cross(b,c,p),z=cross(c,a,p)
  if((x>=0&&y>=0&&z>=0)||(x<=0&&y<=0&&z<=0))return true
 }
 return false
}
