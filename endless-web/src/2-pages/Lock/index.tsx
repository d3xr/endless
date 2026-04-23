/**
 * Banking-style PIN lock screen. 4-digit keypad.
 * On successful decrypt, calls onUnlock(token) — token stays in Redux/memory,
 * never touches localStorage in plain form.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Box, Typography, keyframes } from '@mui/material'
import { useAppTheme } from '6-shared/ui/theme'
import {
  decryptToken,
  getEncryptedBlob,
  getLockoutRemaining,
  recordFailedAttempt,
  resetAttempts,
} from '6-shared/api/tokenVault'

const PIN_LEN = 4

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-10px); }
  40%, 80% { transform: translateX(10px); }
`

export function PinLockScreen({ onUnlock }: { onUnlock: (token: string) => void }) {
  const theme = useAppTheme()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [lockoutSec, setLockoutSec] = useState(getLockoutRemaining())

  // Tick lockout countdown
  useEffect(() => {
    if (lockoutSec <= 0) return
    const t = setInterval(() => {
      const rem = getLockoutRemaining()
      setLockoutSec(rem)
      if (rem <= 0) clearInterval(t)
    }, 500)
    return () => clearInterval(t)
  }, [lockoutSec])

  const tryDecrypt = useCallback(
    async (pinStr: string) => {
      setChecking(true)
      const blob = getEncryptedBlob()
      if (!blob) {
        setChecking(false)
        return
      }
      const token = await decryptToken(blob, pinStr)
      if (token) {
        resetAttempts()
        onUnlock(token)
      } else {
        const attempts = recordFailedAttempt()
        setError(true)
        setPin('')
        setLockoutSec(getLockoutRemaining())
        setTimeout(() => setError(false), 500)
      }
      setChecking(false)
    },
    [onUnlock]
  )

  // Auto-submit when PIN is full
  useEffect(() => {
    if (pin.length === PIN_LEN && !checking) {
      tryDecrypt(pin)
    }
  }, [pin, checking, tryDecrypt])

  const addDigit = (d: string) => {
    if (lockoutSec > 0 || checking || pin.length >= PIN_LEN) return
    setPin(p => p + d)
  }
  const backspace = () => {
    if (lockoutSec > 0 || checking) return
    setPin(p => p.slice(0, -1))
  }

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') addDigit(e.key)
      else if (e.key === 'Backspace') backspace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Typography
        variant="h3"
        sx={{
          fontWeight: 800,
          color: theme.palette.primary.main,
          mb: 6,
        }}
      >
        Endless
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {lockoutSec > 0
          ? `Заблокировано. Попробуй через ${lockoutSec} сек.`
          : 'Введи PIN'}
      </Typography>

      {/* PIN dots */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 6,
          animation: error ? `${shake} 0.4s` : 'none',
        }}
      >
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <Box
            key={i}
            sx={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: `2px solid ${theme.palette.text.secondary}`,
              bgcolor:
                i < pin.length
                  ? error
                    ? theme.palette.error.main
                    : theme.palette.primary.main
                  : 'transparent',
              borderColor:
                i < pin.length && error
                  ? theme.palette.error.main
                  : theme.palette.text.secondary,
              transition: 'all 0.15s',
            }}
          />
        ))}
      </Box>

      {/* Keypad */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 80px)',
          gap: 2,
          opacity: lockoutSec > 0 ? 0.3 : 1,
          pointerEvents: lockoutSec > 0 ? 'none' : 'auto',
        }}
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <KeypadButton key={d} label={d} onClick={() => addDigit(d)} />
        ))}
        <Box />
        <KeypadButton label="0" onClick={() => addDigit('0')} />
        <KeypadButton label="⌫" onClick={backspace} muted />
      </Box>

    </Box>
  )
}

function KeypadButton({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  const theme = useAppTheme()
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        border: 'none',
        bgcolor: 'action.hover',
        color: muted ? theme.palette.text.secondary : theme.palette.text.primary,
        fontSize: '1.8rem',
        fontWeight: 400,
        cursor: 'pointer',
        transition: 'all 0.1s',
        userSelect: 'none',
        '&:hover': { bgcolor: 'action.selected' },
        '&:active': { transform: 'scale(0.92)' },
      }}
    >
      {label}
    </Box>
  )
}
