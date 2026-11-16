import {test} from 'node:test'
import assert from 'node:assert/strict'
import {textureToScreen,hitsFood,gizmo,updateGesture,type Gesture} from '../src/cooking/interaction'
import type {DrawItem} from '../src/core/resolve'
import type {Mat} from '../src/core/model'
import {transform} from '../src/core/matrix'
const texture={id:'food',width:2,height:2,rgba:new Uint8ClampedArray([255,0,0,255,255,0,0,0,255,0,0,255,255,0,0,255])}
const item:DrawItem={element:{symbol:1,layer:2,frame:0,matrix:[1,0,0,1,0,0],z:0},source:{packageId:'a',buildId:'b',symbol:1},image:{index:0,duration:1,parts:[{textureId:'food',triangles:[{x:-1,y:-1,u:0,v:0},{x:1,y:-1,u:1,v:0},{x:1,y:1,u:1,v:1},{x:-1,y:-1,u:0,v:0},{x:1,y:1,u:1,v:1},{x:-1,y:1,u:0,v:1}]}]},textures:[texture],matrix:[2,0,0,3,100,200],pivotMatrix:[2,0,0,3,100,200],offset:{x:0,y:0},ruleId:'cooking'}
const identity:Mat=[1,0,0,1,0,0]
test('template pixels map through UV/mesh and animation matrix, not a guessed screen scale',()=>{
 const base=textureToScreen(item,'food',[2,0,0,2,10,20])
 assert.deepEqual(transform(base,{x:0,y:0}),{x:206,y:414})
 assert.deepEqual(transform(base,{x:1,y:1}),{x:210,y:420})
})
test('food hit ignores transparent pixels and passes through any pot in front',()=>{
 assert.equal(hitsFood([item],identity,{x:99,y:199}),true)
 assert.equal(hitsFood([item],identity,{x:101,y:199}),false)
 assert.equal(hitsFood([item],identity,{x:0,y:0}),false)
 assert.equal(hitsFood([item,{...item,ruleId:undefined}],identity,{x:99,y:199}),true)
 assert.equal(hitsFood([{...item,ruleId:undefined},item],identity,{x:99,y:199}),true)
})
test('screen dragging converts through nonuniform rotated and mirrored attachment matrices',()=>{
 const base:Mat=[0,-2,-3,0,400,500],placement={x:7,y:9,scale:1,rotation:15}
 const g:Gesture={mode:'move',base,start:transform(base,{x:10,y:20}),placement,center:{x:50,y:60}}
 assert.deepEqual(updateGesture(g,transform(base,{x:30,y:15})),{...placement,x:27,y:4})
})
test('scale and rotation are calculated in template coordinates, keeping image center',()=>{
 const base:Mat=[2,0,0,0.5,400,500],placement={x:7,y:9,scale:1,rotation:15},center={x:50,y:60}
 const g:Gesture={mode:'scale',base,start:transform(base,{x:70,y:60}),placement,center}
 assert.equal(updateGesture(g,transform(base,{x:90,y:60})).scale,2)
 const rotated=updateGesture({...g,mode:'rotate'},transform(base,{x:50,y:80}))
 assert.ok(Math.abs(rotated.rotation-105)<1e-8);assert.equal(rotated.x,7);assert.equal(rotated.y,9)
})
test('gizmo rotates/scales with pixels while rotation handle stays outside image bounds',()=>{
 const shape=gizmo(identity,100,80,20,10,{x:0,y:0,scale:2,rotation:0})
 assert.deepEqual(shape.center,{x:50,y:40});assert.deepEqual(shape.corners[0],{x:30,y:30})
 assert.deepEqual(shape.rotation,{x:50,y:2})
})
test('free scaling changes axes separately while Shift keeps their current ratio',()=>{
 const g:Gesture={mode:'scale',base:identity,start:{x:10,y:10},placement:{x:0,y:0,scale:2,scaleY:1,rotation:0},center:{x:0,y:0}}
 const free=updateGesture(g,{x:20,y:30},false);assert.equal(free.scale,4);assert.equal(free.scaleY,3)
 const locked=updateGesture(g,{x:20,y:30},true);assert.equal(locked.scale/locked.scaleY!,2)
})
