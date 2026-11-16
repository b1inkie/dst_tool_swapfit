import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readTexture} from '../src/importers/texture'
import {safePath} from '../src/importers/zip'
function tex(format:number,w:number,h:number,payload:number[]){
 const a=new Uint8Array(18+payload.length),v=new DataView(a.buffer)
 a.set([75,84,69,88]);v.setUint32(4,(1<<13)|(1<<9)|(format<<4),true)
 v.setUint16(8,w,true);v.setUint16(10,h,true);v.setUint32(14,payload.length,true);a.set(payload,18);return a
}
test('RGBA texture is top-down after reading bottom-up payload',()=>{
 const t=readTexture('x',tex(4,1,2,[255,0,0,255,0,255,0,255]))
 assert.deepEqual([...t.rgba],[0,255,0,255,255,0,0,255])
})
test('BC1 decodes red endpoint, clipped non-block-aligned dimensions',()=>{
 const t=readTexture('x',tex(0,1,1,[0,248,0,0,0,0,0,0]))
 assert.deepEqual([...t.rgba],[255,0,0,255])
})
test('BC1 transparent palette entry retains transparency',()=>{
 const t=readTexture('x',tex(0,1,1,[0,0,255,255,255,255,255,255]))
 assert.deepEqual([...t.rgba],[0,0,0,0])
})
test('BC2 alpha nibbles are unpremultiplied',()=>{
 const t=readTexture('x',tex(1,1,1,[0x88,0,0,0,0,0,0,0,0,128,0,0,0,0,0,0]))
 assert.equal(t.rgba[3],136);assert.ok(t.rgba[0]>240)
})
test('BC3 opaque red uses first alpha index',()=>{
 const t=readTexture('x',tex(2,1,1,[255,0,0,0,0,0,0,0,0,248,0,0,0,0,0,0]))
 assert.deepEqual([...t.rgba],[255,0,0,255])
})
test('malformed texture lengths and unsafe archive paths reject',()=>{
 assert.throws(()=>readTexture('x',tex(2,4,4,[])),/长度/)
 for(const path of ['../x','D:/x','/etc/x','dir/../../x','a\0b'])assert.throws(()=>safePath(path),/安全/)
 assert.equal(safePath('a\\b/./c'),'a/b/c')
})
