import assert from 'node:assert/strict'
import { readdir, readFile, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import asar from '@electron/asar'

const legal = /^(licen[cs]e|copying|notice|copyright)/i

/** Fail packaging if duplicate JS dependencies, source trees or foreign native binaries return. */
export async function afterPack(context) {
  const platform = context.electronPlatformName
  // The documented scripts produce native x64 packages on Linux and Windows.
  assert.ok(['linux', 'win32'].includes(platform), 'Unsupported package audit platform')
  assert.equal(context.arch, 1, 'Package audit currently supports x64 only')
  const resources = context.packager.getResourcesDir(context.appOutDir)
  // The real app.asar replaces Electron's stock sample application.
  await rm(join(resources, 'default_app.asar'), { force: true })
  const archive = join(resources, 'app.asar')
  const files = asar.listPackage(archive).map(file => file.replace(/\\/g, '/').replace(/^\//, '')).filter(file => !asar.statFile(archive, file).files)
  const native = `node_modules/better-sqlite3/prebuilds/${platform}-x64.node`
  assert.deepEqual(files.filter(file => file.endsWith('.node')), [native], 'Only the target SQLite binary may ship')
  assert.equal(asar.statFile(archive, native).unpacked, true, 'SQLite must be unpacked for native loading')
  for (const file of files) {
    assert.ok(file === 'package.json' || file.startsWith('out/') ||
      (file.startsWith('node_modules/') && (basename(file) === 'package.json' || legal.test(basename(file)))) ||
      /^node_modules\/better-sqlite3\/lib\/.+\.js$/.test(file) || file === native,
    `Unexpected packaged runtime file: ${file}`)
  }
  const main = asar.extractFile(archive, 'out/main/index.js').toString()
  for (const bundled of ['zod', 'form-data-encoder']) {
    assert.ok(!main.includes(`require("${bundled}")`) && !main.includes(`require('${bundled}')`), `${bundled} must be bundled into main`)
  }
  const locales = await readdir(join(context.appOutDir, 'locales'))
  assert.deepEqual(locales.filter(file => file.endsWith('.pak')), ['en-US.pak'], 'Unexpected Chromium locale payload')
  const binary = await readFile(join(resources, 'app.asar.unpacked', native))
  if (platform === 'linux') {
    assert.equal(binary.subarray(0, 4).toString('hex'), '7f454c46')
    assert.equal(binary.readUInt16LE(18), 62, 'SQLite binary must be ELF x64')
  } else {
    assert.equal(binary.subarray(0, 2).toString(), 'MZ')
    assert.equal(binary.readUInt16LE(binary.readUInt32LE(60) + 4), 0x8664, 'SQLite binary must be PE x64')
  }
}
