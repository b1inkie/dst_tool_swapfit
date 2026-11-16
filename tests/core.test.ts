import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyProject,imageKey,ruleFrameKey} from '../src/core/model'
import type {AssetPackage,Element,Mat,Project,SymbolRef} from '../src/core/model'
import {identity,inverse,localDrag,multiply,transform,translate} from '../src/core/matrix'
import {resolveElement} from '../src/core/resolve'
import {History,parseProject} from '../src/core/project'
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)
const base:SymbolRef={packageId:'a',buildId:'same',symbol:11}
const makePackage=(id:string):AssetPackage=>({id,name:'same.zip',builds:[{id:'same',name:'same',symbols:[{hash:11,name:'arm',frames:[{index:3,duration:2,parts:[{textureId:'tex',triangles:[]}]}]}]}],animations:[],textures:[{id:'tex',width:1,height:1,rgba:new Uint8ClampedArray(4)}],names:{}})
const packages=new Map(['a','b'].map(id=>[id,makePackage(id)]))
const element:Element={symbol:11,layer:12,frame:4,matrix:[0,2,-3,0,100,200],z:0}
const project:Project={...emptyProject(),packages:[{id:'a',name:'same.zip'},{id:'b',name:'same.zip'}]}
test('matrix inverse retains rotation, reflection, shear and translation',()=>{
 const m:Mat=[-2,3,4,5,12,8], result=multiply(m,inverse(m))
 result.forEach((v,i)=>close(v,identity[i]))
})
test('drag screen delta converts to local delta at arbitrary zoom and rotation',()=>{
 const view:Mat=[2,0,0,2,50,70], delta={x:20,y:12}
 const local=localDrag(view,element.matrix,delta), m=multiply(view,element.matrix)
 const p=transform(m,{x:0,y:0}), q=transform(m,local)
 close(q.x-p.x,delta.x);close(q.y-p.y,delta.y)
})
test('singular matrix rejects dragging',()=>assert.throws(()=>localDrag(identity,[0,0,0,0,0,0],{x:1,y:1}),/不可逆/))
test('duplicate build names remain isolated across packages; duration frame resolves',()=>{
 const result=resolveElement(packages,project,base,element)
 assert.equal(result.source.packageId,'a');assert.equal(result.image.index,3)
})
test('override uses other package and preserves frame selection',()=>{
 const p={...project,overrides:[{id:'r',enabled:true,targetSymbol:11,source:{...base,packageId:'b'}}]}
 const result=resolveElement(packages,p,base,element)
 assert.equal(result.source.packageId,'b');assert.equal(result.image.index,3)
 assert.throws(()=>resolveElement(packages,p,base,{...element,frame:8}),/缺少素材/)
})
test('offset moves image while red pivot and source element stay unchanged',()=>{
 const p={...project,offsets:[{scope:'asset' as const,key:imageKey(base,3),x:10,y:20}]}
 const result=resolveElement(packages,p,base,element)
 assert.deepEqual(result.pivotMatrix,element.matrix)
 assert.deepEqual(transform(result.pivotMatrix,{x:0,y:0}),{x:100,y:200})
 assert.deepEqual(result.matrix,multiply(element.matrix,translate(10,20)))
 assert.deepEqual(element.matrix,[0,2,-3,0,100,200])
})
test('asset and override offsets compose without editing other references',()=>{
 const source={...base,packageId:'b'}
 const p:Project={...project,overrides:[{id:'r',enabled:true,targetSymbol:11,source}],offsets:[{scope:'asset',key:imageKey(source,3),x:2,y:3},{scope:'override',key:ruleFrameKey('r',3),x:5,y:7}]}
 assert.deepEqual(resolveElement(packages,p,base,element).offset,{x:7,y:10})
 assert.deepEqual(resolveElement(packages,{...p,overrides:[]},source,element).offset,{x:2,y:3})
})
test('ambiguous overrides fail instead of silently replacing',()=>{
 const rule={id:'r',enabled:true,targetSymbol:11,source:base}
 assert.throws(()=>resolveElement(packages,{...project,overrides:[rule,{...rule,id:'other'}]},base,element),/多个 override/)
})
test('history undo/redo and branch; snapshots do not leak mutable state',()=>{
 const h=new History(project), edit={scope:'asset' as const,key:imageKey(base,3),x:1,y:2}
 h.commit({type:'offset',edit});assert.equal(h.current.offsets.length,1)
 h.undo();assert.equal(h.current.offsets.length,0)
 h.redo();assert.equal(h.current.offsets[0].x,1)
 const snapshot=h.current;(snapshot.offsets as unknown[]).push({});assert.equal(h.current.offsets.length,1)
 h.undo();h.commit({type:'offset',edit:{...edit,x:9}});h.redo();assert.equal(h.current.offsets[0].x,9)
})
test('project serialization and validation',()=>{
 assert.deepEqual(parseProject(JSON.stringify(project)),project)
 assert.throws(()=>parseProject('{"schemaVersion":2}'),/版本/)
 assert.throws(()=>parseProject(JSON.stringify({...project,offsets:[{scope:'asset',key:'x',x:'oops',y:2}]})),/偏移/)
 assert.throws(()=>parseProject(JSON.stringify({...project,packages:[...project.packages,project.packages[0]]})),/重复/)
})
