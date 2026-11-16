import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultViewport,zoomAt,viewMatrix} from '../src/cooking/viewport'
import {inverse,transform} from '../src/core/matrix'
test('zoom stays centered at cursor and is bounded',()=>{
 const view={zoom:1.3,x:30,y:-70},point={x:241,y:138},before=transform(inverse(viewMatrix(view)),point),next=zoomAt(view,point,-300),after=transform(inverse(viewMatrix(next)),point)
 assert.ok(Math.abs(before.x-after.x)<1e-8&&Math.abs(before.y-after.y)<1e-8)
 assert.equal(zoomAt(defaultViewport,point,-1e7).zoom,8)
 assert.equal(zoomAt(defaultViewport,point,1e7).zoom,0.1)
})
test('viewport operations are independent of exported image placement',()=>{
 const placement={x:1,y:2,scale:3,rotation:4},snapshot=JSON.stringify(placement)
 zoomAt(defaultViewport,{x:50,y:80},200)
 assert.equal(JSON.stringify(placement),snapshot)
})
