import {BinaryReader,readNames} from './binary'
export type BuildVertex=Readonly<{x:number;y:number;z:number;u:number;v:number;material:number}>
export type BuildFrame=Readonly<{index:number;duration:number;x:number;y:number;width:number;height:number;start:number;count:number}>
export type ParsedBuild=Readonly<{name:string;materials:readonly string[];symbols:readonly {hash:number;frames:readonly BuildFrame[]}[];vertices:readonly BuildVertex[];names:Readonly<Record<number,string>>}>
export function readBuild(data:Uint8Array):ParsedBuild {
  const r=new BinaryReader(data);r.magic('BILD');if(r.u32()!==6)throw Error('仅支持 BILD v6')
  const symbolCount=r.u32(),expectedFrames=r.u32(),name=r.string()
  if(symbolCount>100000||expectedFrames>1000000)throw Error('BILD 计数超过安全限制')
  const materials:string[]=[], materialCount=r.count(4,4096)
  for(let i=0;i<materialCount;i++)materials.push(r.string())
  const symbols:{hash:number;frames:BuildFrame[]}[]=[], hashes=new Set<number>()
  let frames=0
  for(let s=0;s<symbolCount;s++){
    const hash=r.u32(),n=r.count(32),list:BuildFrame[]=[]
    if(hashes.has(hash))throw Error('BILD symbol 哈希重复');hashes.add(hash)
    for(let f=0;f<n;f++){
      const item={index:r.u32(),duration:r.u32(),x:r.f32(),y:r.f32(),width:r.f32(),height:r.f32(),start:r.u32(),count:r.u32()}
      if(!item.duration||item.width<0||item.height<0||item.count%3!==0)throw Error('BILD 素材帧或三角形范围无效')
      if(list.some(prev=>item.index<prev.index+prev.duration && prev.index<item.index+item.duration))throw Error('BILD 素材帧区间重叠')
      list.push(item)
    }
    frames+=n;symbols.push({hash,frames:list})
  }
  if(frames!==expectedFrames)throw Error('BILD 帧计数不一致')
  const count=r.count(24),vertices:BuildVertex[]=[]
  for(let i=0;i<count;i++){
    const v={x:r.f32(),y:r.f32(),z:r.f32(),u:r.f32(),v:r.f32(),material:r.f32()}
    if(!Number.isInteger(v.material)||v.material<0||v.material>=materials.length)throw Error('BILD 顶点引用不存在的材质')
    vertices.push(v)
  }
  for(const sym of symbols)for(const f of sym.frames){
    if(f.start+f.count>vertices.length)throw Error('BILD 顶点范围越界')
    for(let i=f.start;i<f.start+f.count;i+=3){if(vertices[i].material!==vertices[i+1].material||vertices[i].material!==vertices[i+2].material)throw Error('同一三角形引用多个材质')}
  }
  return {name,materials,symbols,vertices,names:readNames(r)}
}
