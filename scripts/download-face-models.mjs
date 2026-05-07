// scripts/download-face-models.mjs
// Descarga los modelos TinyFaceDetector de face-api desde el CDN oficial.
// Ejecutar UNA SOLA VEZ: node scripts/download-face-models.mjs

import { createWriteStream, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TARGET    = join(__dirname, '..', 'public', 'models', 'face-api')

// Modelos mínimos para TinyFaceDetector (~180 KB en total)
const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
]

const BASE_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model'

mkdirSync(TARGET, { recursive: true })

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        return reject(new Error(`HTTP ${res.statusCode} para ${url}`))
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', err => { file.close(); reject(err) })
  })
}

console.log(`Descargando modelos face-api en: ${TARGET}\n`)

for (const f of FILES) {
  const url  = `${BASE_URL}/${f}`
  const dest = join(TARGET, f)
  process.stdout.write(`  ${f} ... `)
  try {
    await download(url, dest)
    console.log('✓')
  } catch (err) {
    console.log(`✗ Error: ${err.message}`)
    process.exit(1)
  }
}

console.log('\n✓ Modelos descargados correctamente.')
console.log('  Reinicia el servidor: npm run dev\n')
