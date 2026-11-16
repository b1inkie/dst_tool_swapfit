import {XMLParser,XMLValidator} from 'fast-xml-parser'
import type {AssetPackage,Element,Mat,SymbolAsset,Texture} from '../core/model'
import {kleiHash} from './binary'
import {contentId,safePath} from './zip'
import {multiply} from '../core/matrix'
type Node=Record<string,any>
const array=(v:any):Node[]=>v===undefined?[]:Array.isArray(v)?v:[v]
const number=(v:any,fallback=0)=>{const n=v===undefined?fallback:Number(v);if(!Number.isFinite(n))throw Error('SCML 数值无效');return n}
export async function importScml(name:string,bytes:Uint8Array,loadTexture:(path:string)=>Promise<Texture>):Promise<AssetPackage>{
  if(bytes.length>16*1024*1024)throw Error('SCML 文件过大')
  const xml=new TextDecoder().decode(bytes)
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('SCML XML 无效或包含不支持的声明')
  const root=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseAttributeValue:false}).parse(xml).spriter_data
  if(!root)throw Error('不是 Spriter SCML')
  const textures:Texture[]=[],symbols:SymbolAsset[]=[],names:Record<number,string>={},files=new Map<string,{symbol:number;frame:number;pivotX:number;pivotY:number;texture:Texture}>()
  for(const folder of array(root.folder)){
    const symbol=kleiHash(String(folder.name??folder.id)),frames=[]
    if(symbols.some(s=>s.hash===symbol))throw Error('SCML folder 名称/哈希重复')
    names[symbol]=String(folder.name??folder.id)
    for(const f of array(folder.file)){
      const path=safePath(String(f.name)),texture=await loadTexture(path),frame=number(f.id),pivotX=number(f.pivot_x,0),pivotY=number(f.pivot_y,1)
      if(!Number.isInteger(frame)||frame<0)throw Error('SCML 图片编号无效')
      const key=`${folder.id}:${f.id}`;if(files.has(key))throw Error('SCML 图片引用重复')
      const entry={symbol,frame,pivotX,pivotY,texture};files.set(key,entry);textures.push(texture)
      const w=texture.width,h=texture.height,x=-pivotX*w,y=-(1-pivotY)*h
      frames.push({index:frame,duration:1,parts:[{textureId:texture.id,triangles:[{x,y,u:0,v:0},{x:x+w,y,u:1,v:0},{x:x+w,y:y+h,u:1,v:1},{x,y,u:0,v:0},{x:x+w,y:y+h,u:1,v:1},{x,y:y+h,u:0,v:1}]}]})
    }
    symbols.push({hash:symbol,name:names[symbol],frames})
  }
  const animations:AssetPackage['animations'][number][]=[], buildName=name.replace(/\.scml$/i,'')
  let frameBudget=0
  for(const entity of array(root.entity))for(const anim of array(entity.animation)){
    const length=number(anim.length),step=number(anim.interval,1000/30)
    if(length<0||step<=0||step>10000)throw Error('SCML 长度或间隔无效')
    const count=Math.max(1,Math.ceil(length/step));frameBudget+=count;if(frameBudget>100000)throw Error('SCML 总帧数超过限制')
    const timelines=new Map(array(anim.timeline).map(t=>[String(t.id),t])),main=array(anim.mainline?.key).sort((a,b)=>number(a.time)-number(b.time)),frames:Element[][]=[]
    if(!main.length)throw Error('SCML 动画缺少 mainline')
    for(let i=0;i<count;i++){
      const time=i*step,m=main.filter(k=>number(k.time)<=time).at(-1)??main[0],bones=new Map(array(m.bone_ref).map(r=>[String(r.id),r])),cache=new Map<string,Mat>()
      const sample=(ref:Node)=>{
        const timeline=timelines.get(String(ref.timeline));if(!timeline)throw Error('SCML timeline 引用不存在')
        const keys=array(timeline.key),key=keys.find(k=>String(k.id)===String(ref.key));if(!key)throw Error('SCML key 引用不存在')
        if(key.curve_type && !['linear','instant'].includes(key.curve_type))throw Error(`暂不支持 SCML 曲线 ${key.curve_type}，避免错误预览`)
        const current=key.object??key.bone;if(!current)throw Error('SCML key 缺少 object/bone')
        const sorted=[...keys].sort((a,b)=>number(a.time)-number(b.time)),idx=sorted.indexOf(key),next=sorted[idx+1]??(anim.looping==='false'?key:sorted[0]),nextValue=next.object??next.bone
        let nextTime=number(next.time);if(nextTime<=number(key.time))nextTime+=length
        let alpha=nextTime>number(key.time)?Math.max(0,Math.min(1,(time-number(key.time))/(nextTime-number(key.time)))):0
        if(key.curve_type==='instant')alpha=0
        const lerp=(field:string,fallback=0)=>number(current[field],fallback)+(number(nextValue[field],fallback)-number(current[field],fallback))*alpha
        let angle=number(current.angle),other=number(nextValue.angle),spin=number(key.spin,1)
        if(spin>0&&other<angle)other+=360;if(spin<0&&other>angle)other-=360
        angle=(angle+(spin===0?0:(other-angle)*alpha))*-Math.PI/180
        const sx=lerp('scale_x',1),sy=lerp('scale_y',1)
        const local:Mat=[Math.cos(angle)*sx,Math.sin(angle)*sx,-Math.sin(angle)*sy,Math.cos(angle)*sy,lerp('x'),-lerp('y')]
        return {local,current,timeline}
      }
      const bone=(id:string,visited=new Set<string>()):Mat=>{
        if(cache.has(id))return cache.get(id)!
        if(visited.has(id))throw Error('SCML 骨骼循环引用');visited.add(id)
        const ref=bones.get(id);if(!ref)throw Error('SCML 父骨骼不存在')
        const {local}=sample(ref),matrix=ref.parent===undefined?local:multiply(bone(String(ref.parent),visited),local);cache.set(id,matrix);return matrix
      }
      const elements:Element[]=[]
      for(const ref of array(m.object_ref)){
        const {current,local,timeline}=sample(ref),file=files.get(`${current.folder}:${current.file}`)
        if(!file)throw Error('SCML 图片引用不存在')
        const px=number(current.pivot_x,file.pivotX),py=number(current.pivot_y,file.pivotY)
        // Per-key pivots are meaningful animation data; currently reject instead of silently moving the red point.
        if(px!==file.pivotX||py!==file.pivotY)throw Error('暂不支持逐关键帧修改 pivot 的 SCML')
        const layer=kleiHash(String(timeline.name??timeline.id));names[layer]=String(timeline.name??timeline.id)
        elements.push({symbol:file.symbol,layer,frame:file.frame,matrix:ref.parent===undefined?local:multiply(bone(String(ref.parent)),local),z:number(ref.z_index)})
      }
      frames.push(elements)
    }
    animations.push({id:`${entity.id}:${anim.id}`,name:String(anim.name),facing:255,fps:1000/step,frames})
  }
  // Include texture bytes in content identity: changing a PNG invalidates the package ID.
  const chunks=[bytes,...textures.map(t=>new Uint8Array(t.rgba.buffer,t.rgba.byteOffset,t.rgba.byteLength))],total=chunks.reduce((n,c)=>n+c.length,0),combined=new Uint8Array(total);let offset=0
  for(const c of chunks){combined.set(c,offset);offset+=c.length}
  return {id:await contentId(combined),name,builds:[{id:'scml:build',name:buildName,symbols}],animations,textures,names}
}
