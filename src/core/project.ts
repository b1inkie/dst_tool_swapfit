import type {OffsetEdit,OverrideRule,Project} from './model'
export type Command = {type:'offset'; edit:OffsetEdit} | {type:'override'; rule:OverrideRule} | {type:'removeOverride'; id:string}
export function apply(project:Project,command:Command):Project {
  switch(command.type) {
    case 'offset': {
      const e=command.edit
      if(!Number.isFinite(e.x)||!Number.isFinite(e.y)) throw Error('偏移必须是有限数值')
      return {...project,offsets:[...project.offsets.filter(o=>o.scope!==e.scope||o.key!==e.key),{...e}]}
    }
    case 'override': return {...project,overrides:[...project.overrides.filter(r=>r.id!==command.rule.id),structuredClone(command.rule)]}
    case 'removeOverride': return {...project,overrides:project.overrides.filter(r=>r.id!==command.id)}
  }
}
export class History {
  private past:Project[]=[]
  private future:Project[]=[]
  private value:Project
  constructor(project:Project) { this.value=structuredClone(project) }
  get current():Project { return structuredClone(this.value) }
  commit(command:Command) {
    const next=apply(this.value,command)
    this.past.push(this.value); this.value=next; this.future=[]
  }
  undo() { const prev=this.past.pop(); if(prev){this.future.push(this.value);this.value=prev} }
  redo() { const next=this.future.pop(); if(next){this.past.push(this.value);this.value=next} }
}
const object=(v:unknown):v is Record<string,unknown> => typeof v==='object'&&v!==null&&!Array.isArray(v)
const text=(v:unknown):v is string => typeof v==='string' && v.length>0
const uint=(v:unknown):v is number => typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=0xffffffff
export function parseProject(json:string):Project {
  const p:unknown=JSON.parse(json)
  if(!object(p)||p.schemaVersion!==1) throw Error('不支持的工程版本')
  if(!Array.isArray(p.packages)||!Array.isArray(p.overrides)||!Array.isArray(p.offsets)) throw Error('工程结构无效')
  const ids=new Set<string>(), rules=new Set<string>(), offsets=new Set<string>()
  for(const pkg of p.packages) {
    if(!object(pkg)||!text(pkg.id)||!text(pkg.name)||ids.has(pkg.id)) throw Error('包引用无效或重复')
    ids.add(pkg.id)
  }
  for(const rule of p.overrides) {
    if(!object(rule)||!text(rule.id)||rules.has(rule.id)||!uint(rule.targetSymbol)||typeof rule.enabled!=='boolean'||!object(rule.source)||!text(rule.source.packageId)||!text(rule.source.buildId)||!uint(rule.source.symbol)||!ids.has(rule.source.packageId)||(rule.targetLayer!==undefined&&!uint(rule.targetLayer))||(rule.fixedFrame!==undefined&&!uint(rule.fixedFrame))) throw Error('替换规则无效')
    rules.add(rule.id)
  }
  for(const edit of p.offsets) {
    if(!object(edit)||(edit.scope!=='asset'&&edit.scope!=='override')||!text(edit.key)||typeof edit.x!=='number'||typeof edit.y!=='number'||!Number.isFinite(edit.x)||!Number.isFinite(edit.y)) throw Error('图片偏移无效')
    const key=JSON.stringify([edit.scope,edit.key]); if(offsets.has(key)) throw Error('图片偏移重复');offsets.add(key)
  }
  if(p.selection!==undefined && (!object(p.selection)||!text(p.selection.packageId)||!ids.has(p.selection.packageId)||!text(p.selection.buildId)||!text(p.selection.animationId)||(p.selection.buildPackageId!==undefined&&(!text(p.selection.buildPackageId)||!ids.has(p.selection.buildPackageId))))) throw Error('动画选择无效')
  return p as Project
}
