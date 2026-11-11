/**
 * Experimental ChatGPT-sign-in bridge for JARVIS.
 *
 * Preserves the original JARVIS WebSocket protocol, while swapping its
 * Claude Agent SDK brain for the OpenAI Codex SDK. Basic Q&A works; Claude
 * MCP tools, browser control, image generation, UI authoring, and camera
 * analysis have not been ported. No API key or paid reset is requested.
 */
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { Codex } from '@openai/codex-sdk'
import { WebSocket, WebSocketServer } from 'ws'
import { localHost, localOrigin } from './plus-security.mjs'

const PORT = Number(process.env.JARVIS_BRIDGE_PORT || '8787')
const HOST = '127.0.0.1'
const WORKSPACE = resolve(process.env.JARVIS_WORKSPACE || join(homedir(), '.jarvis', 'plus-workspace'))
const CODEX = resolve('node_modules/.bin/codex')
const MAX_PROMPT = 6000

// Fail closed rather than silently using a separately billed API key.
function verifySignIn() {
  for (const name of ['OPENAI_API_KEY', 'CODEX_API_KEY']) {
    if (process.env[name]?.trim()) {
      throw new Error(name + ' is set. Unset it before using the ChatGPT-sign-in bridge.')
    }
  }
  if (!existsSync(CODEX)) {
    throw new Error('Local Codex CLI not found. Run npm install inside this project.')
  }
  const status = spawnSync(CODEX, ['login', 'status'], {
    encoding: 'utf8',
    timeout: 15000,
  })
  const output = String(status.stdout || '') + '\n' + String(status.stderr || '')
  if (status.error || status.status !== 0 || !/logged in using chatgpt/i.test(output)) {
    throw new Error('Codex is not signed in with ChatGPT. Run ./node_modules/.bin/codex login and choose ChatGPT, NOT API key.')
  }
}
try {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid JARVIS_BRIDGE_PORT')
  verifySignIn()
  mkdirSync(WORKSPACE, { recursive: true })
} catch (error) {
  console.error('[jarvis-plus] Startup check failed:', error?.message || error)
  process.exit(1)
}

const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key !== 'OPENAI_API_KEY' && key !== 'CODEX_API_KEY'),
)
const codex = new Codex({ env })

function thread() {
  return codex.startThread({
    // Explicitly select a ChatGPT Plus Codex-supported model.
    // Without this, Codex inherits ~/.codex/config.toml (which may specify
    // an API-only / unavailable model such as gpt-5.5).
    model: 'gpt-6-luna',
    modelReasoningEffort: 'low',
    workingDirectory: WORKSPACE,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  })
}

function reply(ws, frame) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame))
}

const SYSTEM_INSTRUCTIONS = [
  'You are JARVIS, an English voice assistant in an Iron Man-style local browser interface.',
  'Answer the users question concisely and in natural spoken English, usually in one or two sentences.',
  'Do not output Markdown headings or lists unless explicitly asked.',
  'You have no available JARVIS computer-control, account, image-generation, camera, or interface-drawing tools.',
  'Do not claim you performed any real-world action. Do not recommend API keys or purchases.',
].join(' ')

const server = createServer((req, res) => {
  if (!localHost(req.headers.host)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (req.url === '/health' && req.method === 'GET') {
    const origin = req.headers.origin
    const allowed = localOrigin(origin, process.env.JARVIS_ALLOWED_ORIGINS || '')
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    }
    if (allowed) headers['access-control-allow-origin'] = origin
    res.writeHead(200, headers)
    res.end(JSON.stringify({ ok: true, stt: false, tts: false, backend: 'codex-chatgpt' }))
    return
  }
  res.writeHead(404).end('Not found')
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
server.on('upgrade', (req, socket, head) => {
  if (!localHost(req.headers.host) ||
      !localOrigin(req.headers.origin, process.env.JARVIS_ALLOWED_ORIGINS || '')) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
})

wss.on('connection', (ws) => {
  let conversation = thread()
  let active = null
  let generation = 0
  reply(ws, { type: 'ready', servers: ['ChatGPT / Codex'] })

  ws.on('message', (raw) => {
    let request
    try {
      request = JSON.parse(String(raw))
    } catch {
      return
    }
    if (request.type === 'interrupt') {
      generation += 1
      active?.abort()
      active = null
      conversation = thread()
      return
    }
    if (request.type !== 'ask') return

    const ask = typeof request.id === 'string' ? request.id.slice(0, 100) : ''
    const text = typeof request.text === 'string' ? request.text.trim().slice(0, MAX_PROMPT) : ''
    if (!ask || !text) {
      reply(ws, { type: 'error', ask, message: 'Please ask a question.' })
      return
    }
    if (active) {
      active.abort()
      // Don't run two requests simultaneously on the same Codex thread.
      conversation = thread()
    }
    const mine = ++generation
    const controller = new AbortController()
    active = controller
    const currentThread = conversation

    ;(async () => {
      try {
        const result = await currentThread.run(SYSTEM_INSTRUCTIONS + '\n\nUser: ' + text, {
          signal: controller.signal,
        })
        if (generation !== mine || ws.readyState !== WebSocket.OPEN) return
        const answer = String(result.finalResponse || '').trim() ||
          'I did not receive an answer.'
        reply(ws, { type: 'text', ask, delta: answer })
        reply(ws, { type: 'done', ask, text: answer })
      } catch (error) {
        if (generation !== mine || controller.signal.aborted) return
        console.error('[jarvis-plus] Codex turn failed:', error?.message || error)
        const quota = /usage limit|rate limit|quota|credit|exhausted/i.test(String(error?.message))
        reply(ws, {
          type: 'error',
          ask,
          message: quota
            ? 'Your Codex allowance may be exhausted. Check ChatGPT usage and wait for the free reset.'
            : 'The Codex request failed. Check the terminal; no API key was used.',
        })
      } finally {
        if (generation === mine) active = null
      }
    })()
  })

  ws.on('close', () => {
    generation += 1
    active?.abort()
    active = null
  })
})

server.listen(PORT, HOST, () => {
  console.log('[jarvis-plus] Local ChatGPT-sign-in bridge listening on ' + HOST + ':' + PORT)
  console.log('[jarvis-plus] No API key, credit purchase, or reset mechanism configured.')
  console.log('[jarvis-plus] WARNING: Existing purchased credits may be consumed by Codex; verify account settings.')
})
