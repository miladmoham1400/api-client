import { test, expect, _electron } from '@playwright/test'

test('built local Electron window renders Chakra without remote resources', async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== 'ELECTRON_RUN_AS_NODE'))
  const electron = await _electron.launch({ args: ['.'], chromiumSandbox: true, env })
  try {
    const page = await electron.firstWindow()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await expect(page.getByRole('button', { name: 'Check local UI' })).toBeVisible()
    expect(page.url()).toMatch(/^file:/)
    await page.getByRole('button', { name: 'Check local UI' }).click()
    await expect(page.getByRole('status')).toHaveText('Local UI ready')
    expect(await page.evaluate(() => typeof Reflect.get(window, 'process'))).toBe('undefined')
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name))
    expect(resources.every(url => url.startsWith('file:') || url.startsWith('data:'))).toBe(true)
    expect(errors).toEqual([])
    console.log('Embedded runtime:', await electron.evaluate(() => process.versions))
  } finally {
    await electron.close()
  }
})
