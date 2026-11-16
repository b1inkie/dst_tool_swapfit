import type {Mat,Vec} from './model'
export const identity:Mat = [1,0,0,1,0,0]
export function multiply(m:Mat,n:Mat):Mat {
  const [a,b,c,d,x,y]=m, [e,f,g,h,u,v]=n
  return [a*e+c*f,b*e+d*f,a*g+c*h,b*g+d*h,a*u+c*v+x,b*u+d*v+y]
}
export const translate = (x:number,y:number):Mat => [1,0,0,1,x,y]
export function transform(m:Mat,p:Vec):Vec { return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]} }
export function inverse(m:Mat):Mat {
  if(!m.every(Number.isFinite)) throw Error('矩阵包含非有限数值')
  const [a,b,c,d,x,y]=m, det=a*d-b*c
  if(Math.abs(det)<1e-12) throw Error('矩阵不可逆，无法拖动此素材')
  return [d/det,-b/det,-c/det,a/det,(c*y-d*x)/det,(b*x-a*y)/det]
}
export function localDrag(view:Mat, element:Mat, screenDelta:Vec):Vec {
  const m=inverse(multiply(view,element))
  return {x:m[0]*screenDelta.x+m[2]*screenDelta.y,y:m[1]*screenDelta.x+m[3]*screenDelta.y}
}
