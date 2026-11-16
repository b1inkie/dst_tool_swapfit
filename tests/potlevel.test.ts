import {test} from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'
import {visiblePotElements,type PotLevel} from '../src/cooking/potlevel'
import {kleiHash} from '../src/importers/binary'
import {importZip} from '../src/importers/zip'
import type {Element} from '../src/core/model'
const element=(layer:string):Element=>({symbol:kleiHash('swap_cooked'),layer:kleiHash(layer),frame:0,matrix:[1,0,0,1,0,0],z:0})
const elements=['pot','swap_high','swap_mid','swap_low','wood'].map(element)
test('workbench defaults to low layer and preserves pot/wood elements',()=>{
 assert.deepEqual(visiblePotElements(elements),[elements[0],elements[3],elements[4]])
})
test('each potlevel shows exactly one food attachment without mutating animation',()=>{
 for(const level of ['high','mid','low'] as const){
  const filtered=visiblePotElements(elements,level)
  assert.equal(filtered.length,3);assert.equal(filtered[1],elements[['high','mid','low'].indexOf(level)+1])
 }
 assert.equal(elements.length,5)
})
// Real cook_pot fixture lives outside the public repo; skip when absent (CI).
test('real cook_pot food animations render one food attachment per frame',{skip:!existsSync('data/resources/cook_pot.zip')},async()=>{
 const p=await importZip('cook_pot.zip',new Uint8Array(readFileSync('data/resources/cook_pot.zip')))
 const hash=kleiHash('swap_cooked')
 for(const anim of p.animations)for(const frame of anim.frames){
  const original=frame.filter(e=>e.symbol===hash)
  if(!original.length)continue
  assert.equal(original.length,3,anim.name)
  for(const level of ['high','mid','low'] as PotLevel[]){
   const filtered=visiblePotElements(frame,level),food=filtered.filter(e=>e.symbol===hash)
   assert.equal(food.length,1,`${anim.name}/${level}`)
   assert.equal(food[0].layer,kleiHash('swap_'+level))
   assert.equal(filtered.filter(e=>e.symbol!==hash).length,frame.filter(e=>e.symbol!==hash).length)
  }
 }
})
