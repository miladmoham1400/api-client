import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import asar from '@electron/asar'
import configTools from 'app-builder-lib/out/util/config/config.js'
import matchers from 'app-builder-lib/out/fileMatcher.js'
import { afterPack } from '../../scripts/check-package.mjs'

const root = resolve(import.meta.dirname, '../..'), directories = []
after(async () => { for (const directory of directories) await rm(directory, { recursive: true, force: true }) })
for (const [platform, configFile, option] of [['linux', 'electron-builder.json', 'linux'], ['win32', 'electron-builder.windows.json', 'win']]) {
  test(`${platform} resolved package filters exclude project/private/build files and select only target runtime`, async () => {
    const config = await configTools.getConfig(root, configFile, null)
    const info = { config, projectDir: root, appDir: root, buildResourcesDir: 'build', isPrepackedAppAsar: false, debugLogger: { isEnabled: false } }
    const expand = value => value.replaceAll('${arch}', 'x64')
    const files = matchers.getMainFileMatchers(root, '/tmp/app', expand, config[option], { info }, '/tmp/output', false)
    const accepts = name => files.some(m => m.createFilter()(join(root, name), { isDirectory: () => false }))
    for (const name of ['.env', '.tools/graphify/bin/python', '.aws/credentials', 'src/main/index.ts', 'docs/product.md', 'dist/old.deb', 'node_modules/zod/index.js']) assert.equal(accepts(name), false, name)
    for (const name of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html', 'package.json']) assert.equal(accepts(name), true, name)
    const node = matchers.getNodeModuleFileMatcher(root, '/tmp/app', expand, config[option], info).createFilter()
    const moduleAccepts = name => node(join(root, name), { moduleFullFilePath: name, isDirectory: () => false })
    for (const name of ['node_modules/react/LICENSE', 'node_modules/zod/package.json', 'node_modules/better-sqlite3/lib/database.js', `node_modules/better-sqlite3/prebuilds/${platform}-x64.node`]) assert.equal(moduleAccepts(name), true, name)
    for (const name of ['node_modules/react/index.js', 'node_modules/zod/index.js', 'node_modules/node-addon-api/napi.h', 'node_modules/better-sqlite3/deps/sqlite3/sqlite3.c', 'node_modules/better-sqlite3/prebuilds/darwin-arm64.node', `node_modules/better-sqlite3/prebuilds/${platform}-arm64.node`]) assert.equal(moduleAccepts(name), false, name)
  })
}
async function fixture(platform, extra = {}, unpack = true) {
  const directory = await mkdtemp(join(tmpdir(), 'package-audit-')); directories.push(directory)
  const app = join(directory, 'app'), resources = join(directory, 'resources')
  const entries = { 'package.json': '{}', 'out/main/index.js': 'require("better-sqlite3")', 'out/renderer/index.html': '<html></html>', 'node_modules/react/LICENSE': 'Synthetic license notice', 'node_modules/better-sqlite3/lib/index.js': 'module.exports = {}', ...extra }
  for (const [name, text] of Object.entries(entries)) { await mkdir(resolve(app, name, '..'), { recursive: true }); await writeFile(join(app, name), text) }
  const native = `node_modules/better-sqlite3/prebuilds/${platform}-x64.node`
  await mkdir(resolve(app, native, '..'), { recursive: true })
  await copyFile(join(root, native), join(app, native))
  await mkdir(resources, { recursive: true }); await mkdir(join(directory, 'locales'))
  await writeFile(join(directory, 'locales/en-US.pak'), '')
  await asar.createPackageWithOptions(app, join(resources, 'app.asar'), unpack ? { unpack: '**/*.node' } : {})
  return { electronPlatformName: platform, arch: 1, appOutDir: directory, packager: { getResourcesDir: () => resources } }
}
for (const platform of ['linux', 'win32']) test(`${platform} audit accepts its actual native binary format and runtime/legal payload`, async () => { await afterPack(await fixture(platform)) })
test('audit rejects accidentally reintroduced dependency code and private project files', async () => {
  for (const extra of [{ 'node_modules/zod/index.js': 'duplicate' }, { '.env': 'synthetic-fixture' }]) await assert.rejects(afterPack(await fixture('linux', extra)), /Unexpected packaged runtime file/)
})
test('audit rejects foreign native binaries and packed rather than unpacked SQLite', async () => {
  await assert.rejects(afterPack(await fixture('linux', { 'node_modules/better-sqlite3/prebuilds/darwin-x64.node': 'foreign' })), /Only the target SQLite binary/)
  await assert.rejects(afterPack(await fixture('linux', {}, false)), /SQLite must be unpacked/)
})
test('audit rejects external main JS dependencies and extra Chromium locales', async () => {
  await assert.rejects(afterPack(await fixture('linux', { 'out/main/index.js': 'require("zod")' })), /zod must be bundled/)
  const context = await fixture('linux'); await writeFile(join(context.appOutDir, 'locales/fr.pak'), '')
  await assert.rejects(afterPack(context), /Unexpected Chromium locale payload/)
})
