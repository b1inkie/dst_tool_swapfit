import type {AssetPackage,Element,ImageFrame,Mat,Project,SymbolRef,Texture,Vec} from './model'
import {imageKey,ruleFrameKey} from './model'
import {multiply,translate} from './matrix'
export type DrawItem = Readonly<{element:Element; source:SymbolRef; image:ImageFrame; textures:readonly Texture[]; matrix:Mat; pivotMatrix:Mat; offset:Vec; ruleId?:string}>
export function resolveElement(packages:ReadonlyMap<string,AssetPackage>, project:Project, base:SymbolRef, element:Element):DrawItem {
  const rules=project.overrides.filter(r=>r.enabled && r.targetSymbol===element.symbol && (r.targetLayer===undefined || r.targetLayer===element.layer))
  if(rules.length>1) throw Error('多个 override 同时匹配此通道，请明确规则')
  const rule=rules[0], source=rule?.source ?? {...base,symbol:element.symbol}
  const pkg=packages.get(source.packageId)
  const build=pkg?.builds.find(b=>b.id===source.buildId)
  const symbol=build?.symbols.find(s=>s.hash===source.symbol)
  const index=rule?.fixedFrame ?? element.frame
  // BILD frame ranges are held for duration, not necessarily contiguous frames.
  const image=symbol?.frames.find(f=>index>=f.index && index<f.index+f.duration)
  if(!image) throw Error(`缺少素材 ${source.packageId}/${source.buildId}/${source.symbol}:${index}`)
  const textures=image.parts.map(part=> {
    const texture=pkg?.textures.find(t=>t.id===part.textureId)
    if(!texture) throw Error(`缺少纹理 ${part.textureId}`)
    return texture
  })
  const asset=project.offsets.find(o=>o.scope==='asset' && o.key===imageKey(source,image.index))
  const local=rule && project.offsets.find(o=>o.scope==='override' && o.key===ruleFrameKey(rule.id,image.index))
  const offset={x:(asset?.x??0)+(local?.x??0),y:(asset?.y??0)+(local?.y??0)}
  return {element,source,image,textures,offset,ruleId:rule?.id,pivotMatrix:element.matrix,matrix:multiply(element.matrix,translate(offset.x,offset.y))}
}
