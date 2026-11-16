import {readFile} from 'node:fs/promises'
import {importZip} from '../src/importers/zip'
const path=process.argv[2]
if(!path)throw Error('Usage: npx tsx scripts/check-zip.ts file.zip')
const p=await importZip(path.split(/[\\/]/).at(-1)!,new Uint8Array(await readFile(path)))
console.log(JSON.stringify({id:p.id,name:p.name,builds:p.builds.map(b=>({name:b.name,symbols:b.symbols.length})),animations:p.animations.map(a=>({name:a.name,facing:a.facing,frames:a.frames.length})),textures:p.textures.map(t=>({id:t.id,width:t.width,height:t.height}))},null,2))
