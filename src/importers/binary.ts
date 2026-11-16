const decoder=new TextDecoder('utf-8',{fatal:true})
export class BinaryReader {
  private offset=0
  private view:DataView
  constructor(private data:Uint8Array) {this.view=new DataView(data.buffer,data.byteOffset,data.byteLength)}
  get remaining(){return this.data.length-this.offset}
  private require(bytes:number) {
    if(!Number.isSafeInteger(bytes)||bytes<0||bytes>this.remaining) throw Error(`二进制文件截断或长度非法（offset=${this.offset}, need=${bytes}, remaining=${this.remaining}）`)
  }
  u8(){this.require(1);return this.view.getUint8(this.offset++)}
  u32(){this.require(4);const v=this.view.getUint32(this.offset,true);this.offset+=4;return v}
  f32(){this.require(4);const v=this.view.getFloat32(this.offset,true);this.offset+=4;if(!Number.isFinite(v))throw Error('二进制浮点值不是有限数');return v}
  raw(n:number){this.require(n);const v=this.data.subarray(this.offset,this.offset+n);this.offset+=n;return v}
  string(){const n=this.u32();if(n>1024*1024)throw Error('字符串长度超过限制');return decoder.decode(this.raw(n))}
  magic(expected:string){const actual=decoder.decode(this.raw(4));if(actual!==expected)throw Error(`文件签名错误：期望 ${expected}`)}
  count(minimumItemBytes:number,maximum=1_000_000){const n=this.u32();if(n>maximum||n*minimumItemBytes>this.remaining)throw Error('二进制计数超出文件边界或安全限制');return n}
  finish(){if(this.remaining)throw Error(`文件尾有 ${this.remaining} 字节未解析`)}
}
export function readNames(r:BinaryReader):Readonly<Record<number,string>> {
  const names:Record<number,string>={}
  if(!r.remaining)return names
  const count=r.count(8)
  for(let i=0;i<count;i++){
    const hash=r.u32(), name=r.string()
    if(names[hash]!==undefined && names[hash]!==name)throw Error(`名称表哈希冲突 ${hash}`)
    names[hash]=name
  }
  r.finish();return names
}
export function kleiHash(text:string):number {
  // Klei identifiers are generally ASCII; encode strings explicitly rather than
  // treating JS UTF-16 code units as file bytes.
  let h=0
  for(const byte of new TextEncoder().encode(text.toLowerCase()))h=(Math.imul(h,65599)+byte)>>>0
  return h
}
