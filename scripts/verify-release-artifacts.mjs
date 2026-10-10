import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import process from 'node:process'
import console from 'node:console'

const [input, output, version] = process.argv.slice(2)
if (!input || !output || !version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Usage: node scripts/verify-release-artifacts.mjs <download-dir> <asset-dir> <version>')
}
const expected = new Set([
  `offline-api-client-${version}-amd64.deb`,
  `offline-api-client-${version}-x86_64.AppImage`,
  `offline-api-client-${version}-x64-setup.exe`,
])
async function checksumFiles(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Release artifacts must not contain symbolic links')
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await checksumFiles(path))
    else if (entry.name === 'SHA256SUMS.txt') result.push(path)
  }
  return result
}
const verified = new Map()
for (const path of await checksumFiles(input)) {
  for (const line of (await readFile(path, 'utf8')).trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line)
    if (!match) throw new Error('Invalid release checksum line')
    const [, digest, name] = match
    // Linux sha256sum records a repository-relative dist/linux prefix.
    const fileName = basename(name)
    if (!expected.has(fileName) || verified.has(fileName) || name.includes('..') || name.includes('\\')) {
      throw new Error('Unexpected or duplicate release asset')
    }
    const source = join(path, '..', fileName)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(source)) hash.update(chunk)
    if (hash.digest('hex') !== digest.toLowerCase()) throw new Error(`Checksum mismatch: ${fileName}`)
    verified.set(fileName, { source, digest: digest.toLowerCase() })
  }
}
if (verified.size !== expected.size) throw new Error('Both native platform artifacts and all three installers are required')
await mkdir(output, { recursive: true })
const lines = []
for (const [name, { source, digest }] of [...verified].sort(([a], [b]) => a.localeCompare(b))) {
  await copyFile(source, join(output, name))
  lines.push(`${digest}  ${name}`)
}
await writeFile(join(output, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`)
console.log(`Verified ${verified.size} installer checksums`)
console.log(lines.join('\n'))
