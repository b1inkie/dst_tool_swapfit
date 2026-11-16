import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectSources,type WorkspaceSelection} from '../src/core/selection'
import type {AssetPackage} from '../src/core/model'
import {emptyProject} from '../src/core/model'
import {parseProject} from '../src/core/project'
const animation:AssetPackage={id:'anim',name:'player.zip',builds:[],textures:[],names:{},animations:[{id:'idle',name:'idle',facing:255,fps:30,frames:[]}]}
const build:AssetPackage={id:'build',name:'wilson.zip',builds:[{id:'wilson',name:'wilson',symbols:[]}],textures:[],names:{},animations:[]}
const empty:WorkspaceSelection={packageId:'',animationId:'',buildPackageId:'',buildId:''}
const expected={packageId:'anim',animationId:'idle',buildPackageId:'build',buildId:'wilson'}
test('separate animation/build packages select independently in a single import',()=>{
 assert.deepEqual(selectSources([animation,build],empty),expected)
 assert.deepEqual(selectSources([build,animation],empty),expected)
})
test('sequential imports work in either order',()=>{
 assert.deepEqual(selectSources([animation,build],selectSources([animation],empty)),expected)
 assert.deepEqual(selectSources([build,animation],selectSources([build],empty)),expected)
})
test('reimporting saved references does not replace missing sources with unrelated packages',()=>{
 assert.deepEqual(selectSources([build],expected),expected)
 assert.deepEqual(selectSources([animation],expected),expected)
})
test('combined package retains original simple default',()=>{
 const combined={...animation,builds:build.builds}
 assert.deepEqual(selectSources([combined,build],empty),{...expected,buildPackageId:'anim'})
})
test('project persists separate build package and validates its reference; legacy remains supported',()=>{
 const p={...emptyProject(),packages:[{id:'anim',name:'player.zip'},{id:'build',name:'wilson.zip'}],selection:expected}
 assert.deepEqual(parseProject(JSON.stringify(p)),p)
 assert.throws(()=>parseProject(JSON.stringify({...p,selection:{...expected,buildPackageId:'missing'}})),/选择无效/)
 const {buildPackageId,...legacy}=expected
 assert.deepEqual(parseProject(JSON.stringify({...p,selection:legacy})).selection,legacy)
})
