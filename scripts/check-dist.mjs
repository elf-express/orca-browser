import { execFileSync } from 'node:child_process'

const repoDir = process.argv[2] ?? process.cwd()

function git(...args) {
  return execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8' })
}

if (git('ls-files', '--', 'dist').trim() === '') {
  console.error('dist is not tracked; run pnpm build and commit dist')
  process.exit(1)
}

// --name-status lists modified/deleted tracked files; --others lists untracked ones.
let changed = ''
try {
  git('diff', '--exit-code', '--name-status', '--', 'dist')
} catch (error) {
  changed = String(error.stdout ?? '')
  if (changed.trim() === '') changed = 'dist (git diff failed)\n'
}
const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'dist')

if (changed.trim() !== '' || untracked.trim() !== '') {
  console.error('dist/ is out of date with source; run pnpm build and commit dist')
  if (changed.trim() !== '') console.error(changed.trimEnd())
  if (untracked.trim() !== '') console.error(untracked.trimEnd())
  process.exit(1)
}

console.log('dist matches source')
