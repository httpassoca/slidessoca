// The Docker image builds from a filtered context (.dockerignore). Any file src/ imports from
// outside src/ must survive that filter, or `pnpm build` passes in CI and fails in the image.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function ignored(path: string, rules: string[]): boolean {
  let out = false
  for (const raw of rules) {
    const neg = raw.startsWith('!')
    const pat = neg ? raw.slice(1) : raw
    const re = new RegExp(
      '^' +
        pat
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*\//g, '(?:.*/)?')
          .replace(/\*/g, '[^/]*') +
        '(?:/.*)?$',
    )
    if (re.test(path)) out = !neg
  }
  return out
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

describe('.dockerignore', () => {
  const rules = readFileSync(join(root, '.dockerignore'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  it('keeps every file that src/ imports from outside src/', () => {
    const outside = new Set<string>()
    for (const f of files(join(root, 'src'))) {
      if (!/\.(ts|js|svelte)$/.test(f)) continue
      for (const m of readFileSync(f, 'utf8').matchAll(/from\s+'(\.[^']+)'/g)) {
        const target = relative(root, resolve(join(f, '..'), m[1].replace(/\?.*$/, '')))
        if (!target.startsWith('src/') && !target.startsWith('..')) outside.add(target)
      }
    }
    expect(outside.size).toBeGreaterThan(0)
    for (const t of outside) expect(ignored(t, rules), t).toBe(false)
  })

  it('still drops the rest of docs/', () => {
    expect(ignored('docs/adr/0001-storage-on-the-vps.md', rules)).toBe(true)
  })
})
