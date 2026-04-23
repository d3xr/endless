/**
 * PIN-protected token vault using Web Crypto API.
 *
 * Token is encrypted with AES-GCM. The key is derived from the user's PIN
 * via PBKDF2 (200k iterations, SHA-256). Auth tag ensures wrong PIN fails
 * cryptographically, not just "looks different".
 *
 * Storage layout (base64 blob):
 *   [16 bytes salt][12 bytes IV][encrypted token + 16-byte auth tag]
 *
 * Dev shortcut: REACT_APP_DEV_TOKEN still works in localhost DEV mode.
 * Production: only REACT_APP_ENCRYPTED_TOKEN works, PIN required.
 */

const PBKDF2_ITERATIONS = 200_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_LEN_BITS = 256

// --- base64 helpers ---
function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function b64decode(str: string): Uint8Array {
  const s = atob(str)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

// --- key derivation ---
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
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
    { name: 'AES-GCM', length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Encrypt a token with a PIN. Returns base64-encoded [salt|iv|ciphertext+tag]. */
export async function encryptToken(token: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(pin, salt)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(token)
  )
  // Pack: salt | iv | ciphertext(with tag)
  const ct = new Uint8Array(ciphertext)
  const blob = new Uint8Array(SALT_BYTES + IV_BYTES + ct.length)
  blob.set(salt, 0)
  blob.set(iv, SALT_BYTES)
  blob.set(ct, SALT_BYTES + IV_BYTES)
  return b64encode(blob)
}

/** Decrypt a token with a PIN. Returns null on wrong PIN or tampered blob. */
export async function decryptToken(blob: string, pin: string): Promise<string | null> {
  try {
    const bytes = b64decode(blob)
    if (bytes.length < SALT_BYTES + IV_BYTES + 16) return null
    const salt = bytes.slice(0, SALT_BYTES)
    const iv = bytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)
    const ct = bytes.slice(SALT_BYTES + IV_BYTES)
    const key = await deriveKey(pin, salt)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    return null // auth tag mismatch or any other error
  }
}

// --- Rate limiting (client-side — attacker with devtools can bypass,
//     but slows down casual brute force) ---
const ATTEMPTS_KEY = 'endless_pin_attempts'
const LOCKED_UNTIL_KEY = 'endless_pin_locked_until'
const MAX_ATTEMPTS = 5
const LOCKOUT_SEC = 60

export function getLockoutRemaining(): number {
  const until = parseInt(localStorage.getItem(LOCKED_UNTIL_KEY) || '0', 10)
  const now = Date.now()
  if (until > now) return Math.ceil((until - now) / 1000)
  return 0
}

export function recordFailedAttempt(): number {
  const count = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1
  if (count >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKED_UNTIL_KEY, String(Date.now() + LOCKOUT_SEC * 1000))
    localStorage.setItem(ATTEMPTS_KEY, '0')
    return MAX_ATTEMPTS
  }
  localStorage.setItem(ATTEMPTS_KEY, String(count))
  return count
}

export function resetAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY)
  localStorage.removeItem(LOCKED_UNTIL_KEY)
}

export function getFailedAttempts(): number {
  return parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10)
}

// --- Entry point for app boot ---
/**
 * Public ("demo-only") deployments never get a real token — the bundle ships
 * no secrets. This flag lets every auth path short-circuit without consulting
 * env vars that aren't there.
 */
function isDemoOnly(): boolean {
  return import.meta.env.REACT_APP_DEMO_ONLY === 'true'
}

export function hasEncryptedToken(): boolean {
  if (isDemoOnly()) return false
  return !!(import.meta.env.REACT_APP_ENCRYPTED_TOKEN as string | undefined)
}

export function getEncryptedBlob(): string | null {
  if (isDemoOnly()) return null
  return (import.meta.env.REACT_APP_ENCRYPTED_TOKEN as string | undefined) || null
}

/** Dev-mode plain token (only works in development build). */
export function getDevToken(): string | null {
  if (isDemoOnly()) return null
  if (!import.meta.env.DEV) return null
  return (import.meta.env.REACT_APP_DEV_TOKEN as string | undefined) || null
}
