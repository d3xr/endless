import { TToken } from '6-shared/types'
import { getDevToken, hasEncryptedToken } from './tokenVault'

const TOKEN_KEY = 'zm_token'
const LOGOUT_KEY = 'zm_logged_out'

/**
 * Token resolution priority:
 * 1. Session token (in-memory via sessionStorage — cleared on tab close)
 *    — set after successful PIN unlock in production
 * 2. Explicit login via Zenmoney OAuth → localStorage
 * 3. DEV-mode fallback: REACT_APP_DEV_TOKEN (only works in `npm run dev`)
 *
 * Production builds (DEV=false) do NOT fall back to env token — they require
 * PIN unlock via the vault (see tokenVault.ts + Lock page).
 */
export const tokenStorage = {
  get: (): TToken => {
    // Session-only (from PIN unlock, cleared on tab close)
    const session = sessionStorage.getItem(TOKEN_KEY)
    if (session) return session as TToken

    // Persistent (from OAuth login)
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored) return stored as TToken

    if (localStorage.getItem(LOGOUT_KEY)) return null

    // Dev-only plain env token
    const dev = getDevToken()
    if (dev) {
      localStorage.setItem(TOKEN_KEY, dev)
      return dev as TToken
    }

    return null
  },

  /** Set token persistently (from OAuth login or demo mode). */
  set: (token: TToken) => {
    if (token) {
      localStorage.removeItem(LOGOUT_KEY)
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  },

  /** Set token for this session only (from PIN unlock). Not persisted. */
  setSession: (token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token)
  },

  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.setItem(LOGOUT_KEY, '1')
  },
}

/** True if this deployment needs PIN unlock (production with encrypted token). */
export function needsPinUnlock(): boolean {
  // Already have token (session or localStorage) → no lock needed
  if (sessionStorage.getItem(TOKEN_KEY)) return false
  if (localStorage.getItem(TOKEN_KEY)) return false
  // Dev mode with plain token → no lock
  if (getDevToken()) return false
  // Production with encrypted token → require PIN
  return hasEncryptedToken()
}
