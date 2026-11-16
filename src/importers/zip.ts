import {unzipSync} from 'fflate'
import type {AssetPackage,MeshPart,SymbolAsset} from '../core/model'
import {readAnim} from './anim'
import {readBuild} from './build'
import {readTexture} from './texture'
export function safePath(value:string):string {
  const path=value.replaceAll('\\','/')
  if(path.startsWith('/')||/^[A-Za-z]:/.test(path)||path.split('/').some(p=>p==='..')||path.includes('\0'))throw Error('资源路径不安全')
  return path.split('/').filter(p=>p&&p!=='.').join('/')
}
export async function contentId(bytes:Uint8Array):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer)
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')
}
export async function importZip(name:string,bytes:Uint8Array):Promise<AssetPackage>{
  if(bytes.length>256*1024*1024)throw Error('ZIP 超过 256 MiB 限制')
  let total=0,count=0
  const archive=unzipSync(bytes,{filter(entry){
    safePath(entry.name);total+=entry.originalSize;count++
    if(total>512*1024*1024||entry.originalSize>256*1024*1024||count>20000)throw Error('ZIP 解压大小或条目数超过限制')
    return true
  }})
  const files=new Map<string,Uint8Array>()
  for(const [path,data] of Object.entries(archive)){const safe=safePath(path);if(files.has(safe))throw Error('ZIP 资源路径重复');files.set(safe,data)}
  const find=(leaf:string)=>[...files.keys()].filter(p=>p.split('/').pop()===leaf)
  const builds=find('build.bin'),anims=find('anim.bin')
  if(builds.length>1||anims.length>1)throw Error('一个 ZIP 中有多套 build/anim，请分别导入')
  if(!builds.length&&!anims.length)throw Error('ZIP 中没有 build.bin 或 anim.bin；SCML 工程请导入 .scml 文件')
  const id=await contentId(bytes),parsed=builds[0]?readBuild(files.get(builds[0])!):undefined
  const anim=anims[0]?readAnim(files.get(anims[0])!):undefined
  const textures=parsed?.materials.map(material=>{
    const folder=builds[0].slice(0,builds[0].lastIndexOf('/')+1),path=safePath(folder+material)
    const data=files.get(path);if(!data)throw Error(`缺少图集 ${material}`)
    return readTexture(material,data)
  })??[]
  const symbols:SymbolAsset[]=parsed?.symbols.map(symbol=>({hash:symbol.hash,name:parsed.names[symbol.hash]??String(symbol.hash),frames:symbol.frames.map(frame=>{
    const parts:MeshPart[]=[]
    for(let i=frame.start;i<frame.start+frame.count;i+=3){
      const vertices=parsed.vertices.slice(i,i+3),textureId=parsed.materials[vertices[0].material]
      const triangle=vertices.map(v=>({x:v.x,y:v.y,u:v.u,v:1-v.v}))
      const last=parts.at(-1)
      if(last?.textureId===textureId)parts[parts.length-1]={textureId,triangles:[...last.triangles,...triangle]}
      else parts.push({textureId,triangles:triangle})
    }
    return {index:frame.index,duration:frame.duration,parts}
  })}))??[]
  return {id,name,builds:parsed?[{id:parsed.name,name:parsed.name,symbols}]:[],animations:anim?.animations??[],textures,names:{...anim?.names,...parsed?.names}}
}
