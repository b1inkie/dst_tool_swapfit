export type Mat = readonly [number, number, number, number, number, number]
export type Vec = Readonly<{x:number; y:number}>
export type Vertex = Readonly<{x:number; y:number; u:number; v:number}>
export type MeshPart = Readonly<{triangles:readonly Vertex[]; textureId:string}>
export type ImageFrame = Readonly<{index:number; duration:number; parts:readonly MeshPart[]}>
export type SymbolAsset = Readonly<{hash:number; name:string; frames:readonly ImageFrame[]}>
export type Build = Readonly<{id:string; name:string; symbols:readonly SymbolAsset[]}>
export type Element = Readonly<{symbol:number; layer:number; frame:number; matrix:Mat; z:number}>
export type Animation = Readonly<{id:string; name:string; facing:number; fps:number; frames:readonly (readonly Element[])[]}>
export type Texture = Readonly<{id:string; width:number; height:number; rgba:Uint8ClampedArray}>
export type AssetPackage = Readonly<{id:string; name:string; builds:readonly Build[]; animations:readonly Animation[]; textures:readonly Texture[]; names:Readonly<Record<number,string>>}>
export type SymbolRef = Readonly<{packageId:string; buildId:string; symbol:number}>
export type OverrideRule = Readonly<{id:string; targetSymbol:number; targetLayer?:number; source:SymbolRef; fixedFrame?:number; enabled:boolean}>
export type OffsetEdit = Readonly<{scope:'asset'|'override'; key:string; x:number; y:number}>
export type Project = Readonly<{schemaVersion:1; packages:readonly {id:string; name:string}[]; selection?:{packageId:string; buildPackageId?:string; buildId:string; animationId:string}; overrides:readonly OverrideRule[]; offsets:readonly OffsetEdit[]}>
export const emptyProject = ():Project => ({schemaVersion:1,packages:[],overrides:[],offsets:[]})
export const imageKey = (ref:SymbolRef, frame:number) => JSON.stringify([ref.packageId,ref.buildId,ref.symbol,frame])
export const ruleFrameKey = (rule:string, frame:number) => JSON.stringify([rule,frame])
