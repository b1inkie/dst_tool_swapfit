import type {Mat} from '../core/model'
import {multiply,translate} from '../core/matrix'
export type ImagePlacement=Readonly<{x:number;y:number;scale:number;scaleY?:number;rotation:number}>
export type Bounds=Readonly<{x:number;y:number;width:number;height:number}>
export const defaultPlacement:ImagePlacement={x:0,y:0,scale:1,rotation:0}
export function alphaBounds(rgba:Uint8ClampedArray,width:number,height:number):Bounds|null {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||rgba.length!==width*height*4)throw Error('图片像素长度与尺寸不符')
 let left=width,top=height,right=-1,bottom=-1
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
 return right<0?null:{x:left,y:top,width:right-left+1,height:bottom-top+1}
}
// Coordinates are template canvas pixels. The original source is centered at
// the template center; translation/rotation never change the canvas or pivot.
export function placementMatrix(width:number,height:number,sourceWidth:number,sourceHeight:number,p:ImagePlacement):Mat {
 const sy=p.scaleY??p.scale
 if(![width,height,sourceWidth,sourceHeight,p.x,p.y,p.scale,sy,p.rotation].every(Number.isFinite)||Math.min(width,height,sourceWidth,sourceHeight,p.scale,sy)<=0)throw Error('图片变换参数无效')
 const angle=p.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle)
 return multiply(multiply(translate(width/2+p.x,height/2+p.y),[c*p.scale,s*p.scale,-s*sy,c*sy,0,0]),translate(-sourceWidth/2,-sourceHeight/2))
}
export function rasterize(source:CanvasImageSource,sourceWidth:number,sourceHeight:number,width:number,height:number,p:ImagePlacement):HTMLCanvasElement {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width*height>16*1024*1024)throw Error('模板画布尺寸超出限制')
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
 const ctx=canvas.getContext('2d')!;ctx.setTransform(...placementMatrix(width,height,sourceWidth,sourceHeight,p));ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0);return canvas
}
export async function decodeImage(bytes:Uint8Array):Promise<HTMLCanvasElement>{
 if(bytes.length>64*1024*1024)throw Error('图片超过64MiB')
 const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)]))
 try{if(bitmap.width*bitmap.height>32*1024*1024)throw Error('图片像素数过大');const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d')!.drawImage(bitmap,0,0);return canvas}finally{bitmap.close()}
}
export function trimTransparent(source:HTMLCanvasElement):HTMLCanvasElement {
 const bounds=alphaBounds(source.getContext('2d')!.getImageData(0,0,source.width,source.height).data,source.width,source.height)
 if(!bounds)throw Error('图片完全透明')
 const canvas=document.createElement('canvas');canvas.width=bounds.width;canvas.height=bounds.height;canvas.getContext('2d')!.drawImage(source,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);return canvas
}
export async function pngBytes(canvas:HTMLCanvasElement):Promise<number[]>{
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG编码失败')),'image/png'))
 return [...new Uint8Array(await blob.arrayBuffer())]
}
