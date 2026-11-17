import {test} from 'node:test'
import assert from 'node:assert/strict'
import {tooltipPosition} from '../src/ui/tooltip-position'
import {readFileSync} from 'node:fs'
test('tooltip centers above trigger and flips below near top window edge',()=>{
 assert.deepEqual(tooltipPosition({left:100,top:100,width:40,height:30},{width:80,height:28},{width:800,height:600},'top'),{left:80,top:64})
 assert.deepEqual(tooltipPosition({left:100,top:4,width:40,height:30},{width:80,height:28},{width:800,height:600},'top'),{left:80,top:42})
})
test('tooltip flips from right to left and bottom to top at edges',()=>{
 const anchor={left:760,top:550,width:30,height:30},hint={width:100,height:40},viewport={width:800,height:600}
 assert.deepEqual(tooltipPosition(anchor,hint,viewport,'right'),{left:652,top:545})
 assert.deepEqual(tooltipPosition(anchor,hint,viewport,'bottom'),{left:692,top:502})
})
test('long tooltip remains within viewport safe margin',()=>{
 const p=tooltipPosition({left:0,top:500,width:40,height:30},{width:280,height:70},{width:300,height:550},'left')
 assert.ok(p.left>=8&&p.left+280<=292);assert.equal(p.top,472)
})
test('tooltip itself cannot intercept pointer or gain keyboard focus',()=>{
 const css=readFileSync(new URL('../src/ui/tooltip.css',import.meta.url),'utf8')
 const source=readFileSync(new URL('../src/ui/Tooltip.tsx',import.meta.url),'utf8')
 assert.match(css,/pointer-events:none/);assert.match(css,/user-select:none/)
 assert.doesNotMatch(source,/tabIndex|autoFocus|contentEditable/)
 assert.match(source,/role="tooltip"/);assert.match(source,/createPortal/)
})
