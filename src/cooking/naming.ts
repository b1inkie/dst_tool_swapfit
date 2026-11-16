export const defaultDishName='defaultdish'
export const dishNameRule='名称须为 1～80 个英文字母、数字或下划线，且不能以数字开头；不允许中文、空格、减号。'
export function validDishName(name:string):boolean{return /^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(name)}
export function imageStem(fileName:string):string{return fileName.split(/[\\/]/).at(-1)!.replace(/\.[^.]+$/,'')}
