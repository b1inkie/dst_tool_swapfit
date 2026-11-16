import type {Texture} from '../core/model'
// Independent BC1/2/3 decoder. Output uses top-down, straight-alpha RGBA.
export function readTexture(id:string,data:Uint8Array):Texture {
  const v=new DataView(data.buffer,data.byteOffset,data.byteLength)
  if(data.length<18||String.fromCharCode(...data.subarray(0,4))!=='KTEX')throw Error('无效 KTEX')
  const spec=v.getUint32(4,true),format=(spec>>>4)&31,mips=(spec>>>13)&31
  if(!mips||mips>20)throw Error('不支持的 KTEX mip 表')
  const offset=8+10*mips,width=v.getUint16(8,true),height=v.getUint16(10,true),length=v.getUint32(14,true)
  if(!width||!height||width*height>32*1024*1024||offset+length>data.length)throw Error('KTEX 尺寸或长度越界')
  const rgba=new Uint8ClampedArray(width*height*4),payload=data.subarray(offset,offset+length)
  const put=(x:number,y:number,c:readonly number[])=>{if(x<width&&y<height)rgba.set(c,((height-1-y)*width+x)*4)}
  if(format===4||format===5){
    const bpp=format===4?4:3;if(payload.length!==width*height*bpp)throw Error('未压缩纹理长度错误')
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*bpp;put(x,y,[payload[i],payload[i+1],payload[i+2],bpp===4?payload[i+3]:255])}
  }else if(format<=2){
    const blockBytes=format===0?8:16,bw=Math.ceil(width/4),bh=Math.ceil(height/4)
    if(payload.length!==bw*bh*blockBytes)throw Error('DXT 块长度错误')
    const p=new DataView(payload.buffer,payload.byteOffset,payload.byteLength)
    const rgb=(n:number)=>{const r=n>>>11,g=(n>>>5)&63,b=n&31;return [(r<<3)|(r>>>2),(g<<2)|(g>>>4),(b<<3)|(b>>>2),255]}
    for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){
      const start=(by*bw+bx)*blockBytes,cpos=start+(format===0?0:8),c0=p.getUint16(cpos,true),c1=p.getUint16(cpos+2,true),colors=[rgb(c0),rgb(c1)]
      for(let k=2;k<4;k++)colors[k]=[0,0,0,255]
      if(c0>c1||format!==0){for(let c=0;c<3;c++){colors[2][c]=Math.floor((2*colors[0][c]+colors[1][c])/3);colors[3][c]=Math.floor((colors[0][c]+2*colors[1][c])/3)}}
      else{for(let c=0;c<3;c++)colors[2][c]=Math.floor((colors[0][c]+colors[1][c])/2);colors[3]=[0,0,0,0]}
      const indices=p.getUint32(cpos+4,true),alphas=[payload[start],payload[start+1]]
      if(format===2){if(alphas[0]>alphas[1])for(let i=1;i<=6;i++)alphas[i+1]=Math.floor(((7-i)*alphas[0]+i*alphas[1])/7);else{for(let i=1;i<=4;i++)alphas[i+1]=Math.floor(((5-i)*alphas[0]+i*alphas[1])/5);alphas[6]=0;alphas[7]=255}}
      for(let i=0;i<16;i++){
        const color=[...colors[(indices>>>(i*2))&3]]
        if(format===1)color[3]=((payload[start+(i>>>1)]>>>((i%2)*4))&15)*17
        if(format===2){const bit=i*3,byte=start+2+(bit>>>3),shift=bit%8;const bits=payload[byte]|((payload[byte+1]??0)<<8);color[3]=alphas[(bits>>>shift)&7]}
        if(format!==0&&color[3]>0)for(let c=0;c<3;c++)color[c]=Math.min(255,Math.floor(color[c]*255/color[3]))
        put(bx*4+i%4,by*4+(i>>>2),color)
      }
    }
  }else throw Error(`暂不支持 KTEX 像素格式 ${format}`)
  return {id,width,height,rgba}
}
