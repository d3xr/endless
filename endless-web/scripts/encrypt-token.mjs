#!/usr/bin/env node
/**
 * Encrypt your ZenMoney token with a PIN for production deployment.
 *
 * Usage:
 *   node scripts/encrypt-token.mjs
 *
 * Outputs: REACT_APP_ENCRYPTED_TOKEN=<base64> line to paste into .env.production
 *
 * After deployment: user enters PIN on lock screen → token decrypted in memory.
 * Without PIN, the encrypted blob is useless.
 */
import { webcrypto as crypto } from 'node:crypto'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const PBKDF2_ITERATIONS = 200_000
const SALT_BYTES = 16
const IV_BYTES = 12

function b64encode(buf) {
  return Buffer.from(buf).toString('base64')
}

async function deriveKey(pin, salt) {
  const enc = new TextEncoder()
  const pinKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    pinKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
}

async function encryptToken(token, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(pin, salt)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(token)
  )
  const ct = new Uint8Array(ciphertext)
  const blob = new Uint8Array(SALT_BYTES + IV_BYTES + ct.length)
  blob.set(salt, 0)
  blob.set(iv, SALT_BYTES)
  blob.set(ct, SALT_BYTES + IV_BYTES)
  return b64encode(blob)
}

// --- Interactive prompts ---
const rl = readline.createInterface({ input: stdin, output: stdout })

console.log('\n🔐 Endless Token Vault\n')
console.log('This will encrypt your ZenMoney token with a PIN for production deployment.')
console.log('The encrypted blob is SAFE to put in .env.production — it cannot be decrypted without the PIN.\n')

const token = (await rl.question('ZenMoney token: ')).trim()
if (!token) {
  console.error('Token cannot be empty')
  process.exit(1)
}

const pin = (await rl.question('PIN (4 digits recommended): ')).trim()
if (!/^\d{4,}$/.test(pin)) {
  console.error('PIN must be 4+ digits')
  process.exit(1)
}

const pin2 = (await rl.question('Confirm PIN: ')).trim()
if (pin !== pin2) {
  console.error('PINs do not match')
  process.exit(1)
}

console.log('\nEncrypting with PBKDF2 (200k iterations)...')
const blob = await encryptToken(token, pin)

// Verify by decrypting
const { webcrypto: c2 } = await import('node:crypto')
const testBytes = Buffer.from(blob, 'base64')
const testSalt = testBytes.slice(0, SALT_BYTES)
const testIv = testBytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)
const testCt = testBytes.slice(SALT_BYTES + IV_BYTES)
const pinKey = await c2.subtle.importKey('raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey'])
const testKey = await c2.subtle.deriveKey(
  { name: 'PBKDF2', salt: testSalt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
  pinKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['decrypt']
)
const verified = await c2.subtle.decrypt({ name: 'AES-GCM', iv: testIv }, testKey, testCt)
const verifiedText = new TextDecoder().decode(verified)
if (verifiedText !== token) {
  console.error('❌ Verification failed')
  process.exit(1)
}

console.log('✅ Verified: decryption with PIN returns original token\n')
console.log('━'.repeat(60))
console.log('Copy this line to .env.production (or .env.local):\n')
console.log(`REACT_APP_ENCRYPTED_TOKEN=${blob}`)
console.log('\n━'.repeat(60))
console.log(`\nPIN: ${pin}  (remember it — there's no recovery)`)
console.log('Blob length:', blob.length, 'chars\n')

rl.close()
