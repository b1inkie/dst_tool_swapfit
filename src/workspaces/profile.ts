import type {AssetPackage,Element} from '../core/model'
import {kleiHash} from '../importers/binary'
import {visiblePotElements} from '../cooking/potlevel'
export type WorkspaceKind='cooking'|'handheld'
export const workspaceProfiles={
 cooking:{label:'料理',title:'料理贴图对齐',subject:'食物',sceneLabel:'锅内',defaultName:'defaultdish',outputPrefix:'料理动画-',missingTemplate:'请将料理 SCML 模板及关联 PNG 放入 resources，并配置料理预设。'},
 handheld:{label:'手持',title:'手持贴图对齐',subject:'手持图片',sceneLabel:'人物手持',defaultName:'defaultitem',outputPrefix:'手持动画-',missingTemplate:'请将完整手持 SCML 模板及关联 PNG 放入 resources，再配置手持预设。不会套用料理模板。'},
} as const
// Hand-carry visibility is a game-side condition, independent of the supplied
// image build. Preserve animation transforms and all unrelated channels.
export function visibleSceneElements(elements:readonly Element[],kind:WorkspaceKind):readonly Element[]{
 if(kind==='cooking')return visiblePotElements(elements)
 const normal=kleiHash('ARM_normal')
 return elements.filter(element=>element.layer!==normal)
}
export function chooseSceneAnimation(scene:AssetPackage,name?:string,facing?:number){
 const animation=scene.animations.find(a=>(!name||a.name===name)&&(facing===undefined||a.facing===facing))
 if(!animation||!animation.frames.length)throw Error('预设动画或方向不存在，或动画没有帧')
 return animation
}
