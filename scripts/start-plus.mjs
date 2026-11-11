/**
 * The ChatGPT Plus launcher always runs preflight BEFORE opening the app.
 * It neither installs software nor starts the original Claude bridge.
 */
import { spawnSync } from 'node:child_process'

if (process.argv.includes('--writes')) {
  console.error('The ChatGPT Plus prototype does not support write/action mode.')
  process.exit(1)
}
const check = spawnSync(process.execPath, ['scripts/setup-plus.mjs'], {
  stdio: 'inherit',
})
if (check.error || check.status !== 0) {
  console.error('JARVIS Plus did not start because the setup check did not pass.')
  process.exit(1)
}
process.argv.push('--plus')
await import('./start.mjs')
