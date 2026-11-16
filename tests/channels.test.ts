import {test} from 'node:test'
import assert from 'node:assert/strict'
import {collectChannels} from '../src/core/channels'
import {emptyProject} from '../src/core/model'
import type {AssetPackage,Element} from '../src/core/model'
import {kleiHash} from '../src/importers/binary'
const hash=kleiHash('swap_object'),layer=kleiHash('ARM_carry')
const element:Element={symbol:hash,layer,frame:1,matrix:[1,0,0,1,105.45,-107.45],z:0}
const pkg:AssetPackage={id:'build',name:'tool.zip',animations:[],names:{},textures:[{id:'t',width:1,height:1,rgba:new Uint8ClampedArray(4)}],builds:[{id:'tool',name:'tool',symbols:[{hash:123,name:'handle',frames:[{index:1,duration:1,parts:[{textureId:'t',triangles:[]}]}]}]}]}
const registry=new Map([[pkg.id,pkg]]),base={packageId:'build',buildId:'tool',symbol:0}
test('channels remain available without any matching base image',()=>{
 const channels=collectChannels(registry,emptyProject(),base,[element])
 assert.equal(channels.length,1);assert.equal(channels[0].element.symbol,hash)
 assert.equal(channels[0].item,undefined);assert.match(channels[0].error!,/缺少素材/)
 assert.deepEqual(channels[0].element.matrix,[1,0,0,1,105.45,-107.45])
})
test('missing channel can be overridden and keeps original anchor matrix',()=>{
 const p={...emptyProject(),overrides:[{id:'held',enabled:true,targetSymbol:hash,targetLayer:layer,source:{packageId:'build',buildId:'tool',symbol:123}}]}
 const channels=collectChannels(registry,p,base,[element])
 assert.ok(channels[0].item);assert.equal(channels[0].error,undefined)
 assert.deepEqual(channels[0].item.pivotMatrix,element.matrix)
 assert.equal(channels[0].item.source.symbol,123)
})
test('animation channel list does not require even a base build to exist',()=>{
 const channels=collectChannels(new Map(),emptyProject(),{packageId:'',buildId:'',symbol:0},[element])
 assert.equal(channels.length,1);assert.equal(channels[0].element,element)
})
