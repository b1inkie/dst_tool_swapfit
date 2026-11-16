import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultDishName,imageStem,validDishName} from '../src/cooking/naming'
test('dish identifiers use ASCII variable naming, never silently sanitize',()=>{
 for(const name of ['defaultdish','dish_name','_dish2','Dish3'])assert.equal(validDishName(name),true,name)
 for(const name of ['','料理','dish name','dish-name','1dish','dish.png','dish/name',' dish','dish ','😀','a'.repeat(81)])assert.equal(validDishName(name),false,name)
 assert.equal(validDishName('a'.repeat(80)),true);assert.equal(defaultDishName,'defaultdish')
})
test('image filename stem preserves invalid characters for explicit user correction',()=>{
 assert.equal(imageStem('C:\\images\\料理 1-2.png'),'料理 1-2')
 assert.equal(imageStem('dish_name.PNG'),'dish_name')
 assert.equal(imageStem('dish.v2.png'),'dish.v2')
})
