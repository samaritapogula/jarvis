/**
 * Non-mutating preflight for the experimental ChatGPT Plus bridge.
 * The original npm run setup is an advisory Claude check; this version
 * validates the prerequisites for Codex instead.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

let blockers = 0
const ok = (value) => console.log('  OK  ' + value)
const fix = (value) => { blockers += 1; console.error('  FIX ' + value) }
const command = (name, args) => spawnSync(name, args, { encoding: 'utf8', timeout: 10000 })

console.log('\nJARVIS + ChatGPT Plus preflight (does not install or change anything)\n')

if (Number(process.versions.node.split('.')[0]) >= 20) ok('Node.js ' + process.versions.node)
else fix('Node.js 20+ is required. Ask before installing/upgrading system-wide.')

const git = command('git', ['--version'])
if (git.status === 0) ok((git.stdout || '').trim())
else fix('Git is missing. Ask before installing it.')

const npm = command('npm', ['--version'])
if (npm.status === 0) ok('npm ' + (npm.stdout || '').trim())
else fix('npm is missing. Ask before installing it.')

if (process.platform === 'darwin') {
  const locations = ['/Applications', join(homedir(), 'Applications')]
  if (locations.some((folder) =>
    existsSync(join(folder, 'Google Chrome.app')) || existsSync(join(folder, 'Microsoft Edge.app')))) {
    ok('Chrome or Edge found')
  } else fix('Chrome or Edge is required for microphone support. Ask before installing.')
} else {
  console.log('  NOTE Browser check skipped; this preflight only checks macOS apps.')
}

if (process.env.OPENAI_API_KEY?.trim() || process.env.CODEX_API_KEY?.trim()) {
  fix('An API-key environment variable is set. Unset it to avoid separately billed API usage.')
} else ok('No OpenAI API-key environment variables')

try {
  await import('@openai/codex-sdk')
  ok('Codex SDK dependency')
} catch {
  fix('Codex SDK is missing. Run npm install in this project.')
}

const cli = resolve('node_modules/.bin/codex')
if (!existsSync(cli)) fix('Local Codex CLI not found. Run npm install in this project.')
else {
  const status = command(cli, ['login', 'status'])
  const report = String(status.stdout || '') + '\n' + String(status.stderr || '')
  if (status.status === 0 && /logged in using chatgpt/i.test(report)) {
    ok('Codex signed in through ChatGPT')
  } else {
    fix('Sign in: ./node_modules/.bin/codex login (choose ChatGPT, NOT API key)')
  }
}

console.log('\n' + (blockers ? 'NOT READY: ' + blockers + ' issue(s).' : 'READY to launch the ChatGPT Plus bridge.'))
console.log('This cannot enforce a cutoff before any existing purchased credits are consumed.')
console.log('Review ChatGPT Settings > Usage and any automatic top-up/credit settings.\n')
process.exitCode = blockers ? 1 : 0
