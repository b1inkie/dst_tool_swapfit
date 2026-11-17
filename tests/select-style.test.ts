import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const workflow=readFileSync(new URL('../src/workbench.css',import.meta.url),'utf8')
const select=readFileSync(new URL('../src/ui/themed-select.css',import.meta.url),'utf8')
// The select's listbox is nested inside .cooking-workflow. Broad li rules
// previously added step padding and connector lines to every dropdown option.
test('workflow step layout and connectors only target the direct ordered list',()=>{
 assert.doesNotMatch(workflow,/\.cooking-workflow\s+li\b/)
 assert.match(workflow,/\.cooking-workflow>ol>li\{/)
 assert.match(workflow,/\.cooking-workflow>ol>li:not\(:last-child\):before\{/)
})
test('select rows have bounded height and symmetric centered text areas',()=>{
 assert.match(select,/\.themed-select>\.themed-select-header\{[^}]*height:36px;[^}]*margin:0;[^}]*padding:0 28px;/)
 assert.match(select,/\.themed-select-list>\.themed-select-option\{[^}]*height:34px;[^}]*padding:0 26px;/)
 for(const name of ['themed-select-value','themed-select-option-label'])assert.match(select,new RegExp('\\.'+name+'\\{[^}]*text-align:center'))
 assert.match(select,/\.themed-select-check\{position:absolute;/)
})
