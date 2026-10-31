// Downloads only public, version-pinned OCR assets. No environment configuration is read.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../public/ocr/', import.meta.url))
const files = [
  ['tesseract.esm.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js'],
  ['worker.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js'],
  ['LICENSE-tesseract.txt', 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/LICENSE.md'],
  ['LICENSE-core.txt', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/LICENSE'],
  ...['tesseract-core','tesseract-core-simd','tesseract-core-lstm','tesseract-core-simd-lstm','tesseract-core-relaxedsimd','tesseract-core-relaxedsimd-lstm'].flatMap(name =>
    ['wasm.js','wasm'].map(ext=>[`core/${name}.${ext}`, `https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/${name}.${ext}`])),
  ...['eng','kor'].map(lang=>[`lang/${lang}.traineddata.gz`,`https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}@1.0.0/4.0.0_best_int/${lang}.traineddata.gz`]),
]
async function prepare() {
let previous = {}
try { previous = JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8')) } catch(error) {if(error.code!=='ENOENT') throw error}
const manifest = {}
for(const [name,url] of files) {
  const dest=path.join(root,name)
  let body
  try { await access(dest); body=await readFile(dest) } catch(error) {
    if(error.code!=='ENOENT') throw error
    const response=await fetch(url,{signal:AbortSignal.timeout(120000)})
    if(!response.ok) throw new Error(`OCR asset download failed: ${name} (${response.status})`)
    body=Buffer.from(await response.arrayBuffer())
  }
  if (!body.length) throw new Error(`Empty OCR asset: ${name}`)
  if (name.endsWith('.wasm') && !body.subarray(0,4).equals(Buffer.from([0,97,115,109]))) throw new Error(`Invalid WASM asset: ${name}`)
  if (name.endsWith('.gz') && (body[0]!==31 || body[1]!==139)) throw new Error(`Invalid language data: ${name}`)
  const sha256=createHash('sha256').update(body).digest('hex')
  if(previous[name] && previous[name].sha256!==sha256) throw new Error(`OCR asset checksum mismatch: ${name}`)
  await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,body)
  manifest[name]={url,sha256}
  console.log(`Prepared ${name}`)
}
await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')

}

prepare().catch(error => {
  console.error(`OCR asset preparation failed: ${error.message}`)
  if (process.argv.includes('--optional')) console.warn('Development continues with direct ticket entry; retry npm run prepare:lotto-ocr when online.')
  else process.exitCode = 1
})
