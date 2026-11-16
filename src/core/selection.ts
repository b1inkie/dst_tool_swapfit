import type {AssetPackage} from './model'
export type WorkspaceSelection = Readonly<{packageId:string;animationId:string;buildPackageId:string;buildId:string}>
// Resolve animation and build independently. Preserve unresolved saved references
// while their source packages are being reimported in either order.
export function selectSources(packages:readonly AssetPackage[], current:WorkspaceSelection):WorkspaceSelection {
  const animationPackage=current.packageId ? packages.find(p=>p.id===current.packageId) : packages.find(p=>p.animations.length)
  const packageId=current.packageId||animationPackage?.id||''
  const animationId=current.animationId||animationPackage?.animations[0]?.id||''
  const buildPackage=current.buildPackageId ? packages.find(p=>p.id===current.buildPackageId) : animationPackage?.builds.length ? animationPackage : packages.find(p=>p.builds.length)
  return {packageId,animationId,buildPackageId:current.buildPackageId||buildPackage?.id||'',buildId:current.buildId||buildPackage?.builds[0]?.id||''}
}
