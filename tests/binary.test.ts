import {test} from 'node:test'
import assert from 'node:assert/strict'
import {BinaryReader,kleiHash} from '../src/importers/binary'
import {readAnim} from '../src/importers/anim'
import {readBuild} from '../src/importers/build'
class Writer {
  values:number[]=[]
  raw(s:string){this.values.push(...new TextEncoder().encode(s));return this}
  u8(n:number){this.values.push(n);return this}
  u32(n:number){const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,n,true);this.values.push(...a);return this}
  f32(n:number){const a=new Uint8Array(4);new DataView(a.buffer).setFloat32(0,n,true);this.values.push(...a);return this}
  string(s:string){return this.u32(new TextEncoder().encode(s).length).raw(s)}
  bytes(){return Uint8Array.from(this.values)}
}
function anim(){
 const w=new Writer().raw('ANIM').u32(4).u32(1).u32(1).u32(0).u32(1).string('idle').u8(5).u32(9).f32(30).u32(1)
 for(const v of [0,0,20,20])w.f32(v)
 w.u32(0).u32(1).u32(11).u32(3).u32(12)
 for(const v of [1,0,0,1,100,200,0])w.f32(v)
 return w.u32(1).u32(11).string('arm').bytes()
}
function build(){
 const w=new Writer().raw('BILD').u32(6).u32(1).u32(1).string('demo').u32(1).string('atlas-0.tex')
 w.u32(11).u32(1).u32(3).u32(2)
 for(const v of [0,0,10,10])w.f32(v)
 w.u32(0).u32(3).u32(3)
 for(const vertex of [[0,0,0,0,0,0],[10,0,0,1,0,0],[0,10,0,0,1,0]])for(const v of vertex)w.f32(v)
 return w.u32(1).u32(11).string('arm').bytes()
}
test('ANIM v4 decodes timeline matrices, direction, symbol and layer independently',()=>{
 const a=readAnim(anim());assert.equal(a.animations[0].facing,5)
 assert.deepEqual(a.animations[0].frames[0][0],{symbol:11,frame:3,layer:12,matrix:[1,0,0,1,100,200],z:0})
 assert.equal(a.names[11],'arm')
})
test('BILD v6 preserves symbol frame duration, mesh and material references',()=>{
 const b=readBuild(build());assert.equal(b.name,'demo');assert.equal(b.symbols[0].frames[0].duration,2)
 assert.equal(b.vertices.length,3);assert.equal(b.names[11],'arm')
})
test('every truncated ANIM/BILD prefix is rejected',()=>{
 // Name tables are optional; the exact offset before a table is a valid file.
 for(const [data,parse] of [[anim(),readAnim],[build(),readBuild]] as const){
  const withoutTable=data.length-15
  for(let n=0;n<data.length;n++)if(n!==withoutTable)assert.throws(()=>parse(data.subarray(0,n)),`prefix ${n}`)
 }
})
test('versions, trailing bytes and invalid counts reject rather than silently recovering',()=>{
 for(const [data,parse] of [[anim(),readAnim],[build(),readBuild]] as const){
  const version=data.slice();new DataView(version.buffer).setUint32(4,999,true);assert.throws(()=>parse(version),/支持/)
  const extra=new Uint8Array(data.length+1);extra.set(data);assert.throws(()=>parse(extra),/未解析/)
 }
 const huge=anim();new DataView(huge.buffer).setUint32(20,0xffffffff,true);assert.throws(()=>readAnim(huge),/计数/)
})
test('non-finite floats and unbounded strings reject',()=>{
 assert.throws(()=>new BinaryReader(new Writer().f32(Infinity).bytes()).f32(),/有限/)
 assert.throws(()=>new BinaryReader(new Writer().u32(0xffffffff).bytes()).string(),/限制/)
})
test('Klei hash is case insensitive for ASCII identifiers',()=>{
 assert.equal(kleiHash('ARM'),kleiHash('arm'));assert.equal(kleiHash(''),0)
})
