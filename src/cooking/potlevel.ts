import type {Element} from '../core/model'
import {kleiHash} from '../importers/binary'
export type PotLevel='high'|'mid'|'low'
const layers={high:kleiHash('swap_high'),mid:kleiHash('swap_mid'),low:kleiHash('swap_low')}
const foodLayers=new Set(Object.values(layers))
// Mirrors cookpot.lua layer visibility; this tool defaults to low by design.
// This is scene visibility only; never alter template pixels, pivot or SCML.
export function visiblePotElements(elements:readonly Element[],level:PotLevel='low'):readonly Element[]{
 return elements.filter(element=>!foodLayers.has(element.layer)||element.layer===layers[level])
}
