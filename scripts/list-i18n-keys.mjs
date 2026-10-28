// Lists every translate('<key>', '<fallback>') call under a directory as a sorted JSON table.
// Usage: node scripts/list-i18n-keys.mjs [dir] [--out <file>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CALL = /translate\(\s*'([^']+)'\s*,\s*(['"])((?:\\.|(?!\2).)*)\2/g

function parseArgs(argv) {
  let dir = 'src/renderer'
  let out = null
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') {
      out = argv[i + 1] ?? null
      i += 1
    } else {
      dir = argv[i]
    }
  }
  return { dir, out }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(path)
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.[^.]+$/.test(entry.name)) {
      yield path
    }
  }
}

// Resolves the escapes a quoted source literal can carry into the string it denotes.
function unescapeLiteral(raw) {
  return raw.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, esc) => {
    if (esc.length > 1) {
      return String.fromCharCode(parseInt(esc.slice(1), 16))
    }
    const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }
    return simple[esc] ?? esc
  })
}

const { dir, out } = parseArgs(process.argv.slice(2))
const table = new Map()
let conflict = false

for (const file of [...walk(dir)].sort()) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(CALL)) {
    const key = match[1]
    const fallback = unescapeLiteral(match[3])
    if (table.has(key) && table.get(key) !== fallback) {
      process.stderr.write(`conflicting fallback for key ${key}\n`)
      conflict = true
    } else {
      table.set(key, fallback)
    }
  }
}

if (conflict) {
  process.exit(1)
}

const sorted = Object.fromEntries([...table].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
const json = `${JSON.stringify(sorted, null, 2)}\n`
if (out) {
  writeFileSync(out, json, 'utf8')
} else {
  process.stdout.write(json)
}
