import test from 'node:test'
import assert from 'node:assert/strict'
import { localHost, localOrigin } from '../bridge/plus-security.mjs'

test('HTTP Host headers must resolve to loopback', () => {
  assert.equal(localHost('localhost:8787'), true)
  assert.equal(localHost('127.0.0.1:8787'), true)
  assert.equal(localHost('[::1]:8787'), true)
  assert.equal(localHost('example.com:8787'), false)
  assert.equal(localHost('attacker.example@localhost:8787'), false)
  assert.equal(localHost('localhost:8787/secret'), false)
  assert.equal(localHost(''), false)
})

test('WebSocket only accepts expected local Vite origins', () => {
  assert.equal(localOrigin('http://localhost:5173'), true)
  assert.equal(localOrigin('http://127.0.0.1:5173'), true)
  assert.equal(localOrigin('http://localhost:4173'), true)
  assert.equal(localOrigin('http://localhost:5188'), true)
  assert.equal(localOrigin('https://localhost:5173'), false)
  assert.equal(localOrigin('http://evil.example:5173'), false)
  assert.equal(localOrigin('http://localhost:6000'), false)
  assert.equal(localOrigin(''), false)
})

test('Extra trusted origins must remain on loopback', () => {
  assert.equal(localOrigin('http://localhost:6000', 'http://localhost:6000'), true)
  assert.equal(localOrigin('http://evil.example:6000', 'http://evil.example:6000'), false)
  assert.equal(localOrigin('http://127.0.0.1:6000', 'http://localhost:6000'), false)
})
