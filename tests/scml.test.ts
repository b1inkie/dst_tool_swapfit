import {test} from 'node:test'
import assert from 'node:assert/strict'
import {importScml} from '../src/importers/scml'
const texture=async(path:string)=>({id:path,width:20,height:10,rgba:new Uint8ClampedArray(800)})
const encode=(text:string)=>new TextEncoder().encode(text)
const scml=(extra='')=>`<spriter_data><folder id="0" name="arm"><file id="0" name="arm.png" pivot_x="0.5" pivot_y="0.5"/></folder><entity id="0"><animation id="0" name="idle" length="100" interval="50" looping="false"><mainline><key id="0"><object_ref id="0" timeline="0" key="0" z_index="0"/></key></mainline><timeline id="0" name="arm_layer"><key id="0" time="0" ${extra}><object folder="0" file="0" x="0" y="10"/></key><key id="1" time="100"><object folder="0" file="0" x="20" y="10"/></key></timeline></animation></entity></spriter_data>`
test('SCML samples linear interpolation and changes axis at import boundary',async()=>{
 const p=await importScml('a.scml',encode(scml()),texture),a=p.animations[0]
 assert.equal(a.frames.length,2);assert.equal(a.frames[0][0].matrix[5],-10);assert.equal(a.frames[1][0].matrix[4],10)
 const vertex=p.builds[0].symbols[0].frames[0].parts[0].triangles[0]
 assert.deepEqual(vertex,{x:-10,y:-5,u:0,v:0})
})
test('SCML instant curve holds previous pose',async()=>{
 const p=await importScml('a.scml',encode(scml('curve_type="instant"')),texture)
 assert.equal(p.animations[0].frames[1][0].matrix[4],0)
})
test('unsupported curves fail explicitly instead of displaying wrong motion',async()=>{
 await assert.rejects(()=>importScml('a.scml',encode(scml('curve_type="bezier"')),texture),/曲线/)
})
test('SCML rejects entities and missing pictures',async()=>{
 await assert.rejects(()=>importScml('a.scml',encode('<!DOCTYPE x><spriter_data/>'),texture),/声明/)
 await assert.rejects(()=>importScml('a.scml',encode(scml()),async()=>{throw Error('missing')}),/missing/)
})
