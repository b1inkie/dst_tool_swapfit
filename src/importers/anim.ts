import {BinaryReader,readNames} from './binary'
import type {Animation,Element} from '../core/model'
export function readAnim(data:Uint8Array):{animations:readonly Animation[];names:Readonly<Record<number,string>>} {
  const r=new BinaryReader(data);r.magic('ANIM')
  if(r.u32()!==4)throw Error('仅支持 ANIM v4')
  const expectedElements=r.u32(), expectedFrames=r.u32(), expectedEvents=r.u32()
  const count=r.count(17,100000), animations:Animation[]=[]
  let elements=0, frames=0, events=0
  for(let i=0;i<count;i++){
    const name=r.string(), facing=r.u8(),root=r.u32(),fps=r.f32()
    if(fps<=0||fps>1000)throw Error('动画帧率无效')
    const total=r.count(24), timeline:Element[][]=[]
    for(let f=0;f<total;f++){
      // Bounds and events remain source metadata, not geometry offsets.
      for(let k=0;k<4;k++)r.f32()
      const ev=r.count(4);for(let k=0;k<ev;k++)r.u32();events+=ev
      const n=r.count(40), list:Element[]=[]
      // Klei depth grows toward the back; normalize to painter order (back first).
      for(let k=0;k<n;k++)list.push({symbol:r.u32(),frame:r.u32(),layer:r.u32(),matrix:[r.f32(),r.f32(),r.f32(),r.f32(),r.f32(),r.f32()],z:0-r.f32()})
      elements+=n;timeline.push(list)
    }
    frames+=total
    // Same-name animations may have different facing or root identifiers.
    animations.push({id:`${root}:${i}`,name,facing,fps,frames:timeline})
  }
  if(elements!==expectedElements||frames!==expectedFrames||events!==expectedEvents)throw Error('ANIM 汇总计数与内容不一致')
  return {animations,names:readNames(r)}
}
