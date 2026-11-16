import {test} from 'node:test'
import assert from 'node:assert/strict'
import {alphaBounds,placementMatrix} from '../src/cooking/image'
import {transform} from '../src/core/matrix'
test('alpha crop excludes transparent border including partial alpha as visible',()=>{
 const pixels=new Uint8ClampedArray(5*4*4);pixels[(1*5+2)*4+3]=1;pixels[(2*5+3)*4+3]=255
 assert.deepEqual(alphaBounds(pixels,5,4),{x:2,y:1,width:2,height:2})
 assert.equal(alphaBounds(new Uint8ClampedArray(16),2,2),null)
})
test('placement centers input in fixed template without modifying template size',()=>{
 const matrix=placementMatrix(100,80,20,10,{x:0,y:0,scale:1,rotation:0})
 assert.deepEqual(transform(matrix,{x:0,y:0}),{x:40,y:35})
 assert.deepEqual(transform(matrix,{x:10,y:5}),{x:50,y:40})
})
test('rotation scale and offset apply to image about its center, not animation pivot',()=>{
 const matrix=placementMatrix(100,80,20,10,{x:4,y:-3,scale:2,rotation:90})
 const p=transform(matrix,{x:10,y:5});assert.ok(Math.abs(p.x-54)<1e-8);assert.ok(Math.abs(p.y-37)<1e-8)
 const q=transform(matrix,{x:20,y:5});assert.ok(Math.abs(q.x-54)<1e-8);assert.ok(Math.abs(q.y-57)<1e-8)
})
test('invalid source sizes scale or nonfinite transforms fail',()=>{
 assert.throws(()=>placementMatrix(100,80,0,10,{x:0,y:0,scale:1,rotation:0}))
 assert.throws(()=>placementMatrix(100,80,10,10,{x:0,y:0,scale:0,rotation:0}))
 assert.throws(()=>alphaBounds(new Uint8ClampedArray(1),1,1))
})
