import {test} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {importZip} from '../src/importers/zip'
import {kleiHash} from '../src/importers/binary'
import {visibleSceneElements,workspaceProfiles,chooseSceneAnimation} from '../src/workspaces/profile'
import {collectChannels} from '../src/core/channels'
import {emptyProject} from '../src/core/model'
import type {AssetPackage} from '../src/core/model'
test('workspace output and default identifiers are separate',()=>{
 assert.equal(workspaceProfiles.cooking.defaultName,'defaultdish');assert.equal(workspaceProfiles.handheld.defaultName,'defaultitem')
 assert.equal(workspaceProfiles.handheld.outputPrefix,'手持动画-')
})
// Real Wilson fixtures live outside the public repo; skip when absent (CI).
test('real Wilson hand-carry pose reads resources animation and independent build',{skip:!(existsSync('data/resources/player_idles.zip')&&existsSync('data/resources/wilson.zip'))},async()=>{
 const scene=await importZip('player_idles.zip',new Uint8Array(readFileSync('data/resources/player_idles.zip'))),build=await importZip('wilson.zip',new Uint8Array(readFileSync('data/resources/wilson.zip')))
 const anim=chooseSceneAnimation(scene,'idle_loop_nofaced',255),elements=visibleSceneElements(anim.frames[0],'handheld')
 assert.ok(elements.some(e=>e.layer===kleiHash('ARM_carry')&&e.symbol===kleiHash('swap_object')))
 assert.ok(!elements.some(e=>e.layer===kleiHash('ARM_normal')))
 for(const e of elements)assert.ok(anim.frames[0].includes(e))
 const texture={id:'test',width:1,height:1,rgba:new Uint8ClampedArray([255,255,255,255])}
 const tool:AssetPackage={id:'tool',name:'synthetic-only',names:{},animations:[],textures:[texture],builds:[{id:'tool',name:'tool',symbols:[{hash:kleiHash('swap_tool'),name:'swap_tool',frames:[{index:0,duration:1,parts:[{textureId:'test',triangles:[]}]}]}]}]}
 const p={...emptyProject(),overrides:[{id:'cooking',enabled:true,targetSymbol:kleiHash('swap_object'),source:{packageId:tool.id,buildId:'tool',symbol:kleiHash('swap_tool')},fixedFrame:0}]}
 const channels=collectChannels(new Map([[build.id,build],[tool.id,tool]]),p,{packageId:build.id,buildId:'wilson',symbol:0},elements)
 const held=channels.find(c=>c.element.symbol===kleiHash('swap_object'))!
 assert.ok(held.item);assert.deepEqual(held.item.pivotMatrix,held.element.matrix)
 assert.ok(channels.filter(c=>c.item&&!c.item.ruleId).length>5)
 assert.throws(()=>chooseSceneAnimation(scene,'not_found'),/不存在/)
})
