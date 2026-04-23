import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Fade,
  Stack,
  Typography,
  ButtonBase,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useAppTheme } from '6-shared/ui/theme'
import { zenmoney } from '6-shared/api/zenmoney'
import { tokenStorage } from '6-shared/api/tokenStorage'

import { useAppDispatch } from 'store'
import { setToken } from 'store/token'
import { syncData } from '4-features/sync'
import { loadBackup, loadDemoData, logIn } from '4-features/authorization'
import type { PersonaId } from 'demoData'
import { PersonaPicker } from './PersonaPicker'

zenmoney.processAuthCode()

/**
 * When true, the app is deployed in "public / demo-only" mode (endless.vyroslo.ru).
 * We hide real-login UI and default to the persona picker so visitors never have
 * a way to authenticate against the ZenMoney API from this build.
 */
const demoOnly = import.meta.env.REACT_APP_DEMO_ONLY === 'true'

export default function Auth() {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const theme = useAppTheme()
  const [logoIn, setLogoIn] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [autoLogging, setAutoLogging] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(demoOnly)
  const [pickerLoadingId, setPickerLoadingId] = useState<PersonaId | null>(null)
  setTimeout(() => setLogoIn(true), 300)

  // Auto-login from env token: if REACT_APP_DEV_TOKEN is available
  // and user hasn't explicitly logged out, skip the auth screen entirely.
  useEffect(() => {
    const token = tokenStorage.get()
    if (token) {
      setAutoLogging(true)
      dispatch(setToken(token))
      dispatch(syncData())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const parseFiles = (fileList: FileList) => dispatch(loadBackup(fileList[0]))

  const handlePickPersona = (id: PersonaId) => {
    setPickerLoadingId(id)
    // Defer so the spinner renders before the (synchronous) 5-year
    // generation pass kicks off.
    setTimeout(() => {
      dispatch(loadDemoData(id))
    }, 50)
  }

  const dragOverStyle = {
    background: theme.palette.action.focus,
    transform: 'scale(1.1)',
    transition: `300ms ${theme.transitions.easing.easeInOut}`,
  }
  const defaultStyle = {
    transform: 'scale(1)',
    transition: `300ms ${theme.transitions.easing.easeInOut}`,
  }
  // When auto-logging, show a spinner instead of the login form
  if (autoLogging) {
    return (
      <Box sx={{ display: 'grid', placeContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      <Stack
        spacing={8}
        style={isDragging ? dragOverStyle : defaultStyle}
        onDragOver={e => {
          e.stopPropagation()
          e.preventDefault()
        }}
        onDragEnter={e => {
          e.stopPropagation()
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={e => {
          e.stopPropagation()
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={e => {
          e.stopPropagation()
          e.preventDefault()
          parseFiles(e?.dataTransfer?.files)
        }}
        sx={{
          p: 3,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800,
            color: theme.palette.primary.main,
            opacity: logoIn ? 1 : 0,
            transition: '600ms ease-in-out',
          }}
        >
          Endless
        </Typography>

        {demoOnly ? (
          <Stack spacing={3} sx={{ alignItems: 'center', maxWidth: 560 }}>
            <Typography
              variant="h6"
              align="center"
              sx={{ color: 'text.secondary', fontWeight: 400, lineHeight: 1.45 }}
            >
              AI-ассистент для финансов на базе ZenMoney.
              <br />
              Категоризация, бюджет по конвертам, ежедневный разбор трат — автоматически.
            </Typography>
            <Fade in timeout={1500}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => setPickerOpen(true)}
                sx={{ px: 4, py: 1.5, borderRadius: 3 }}
              >
                Попробовать демо
              </Button>
            </Fade>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
              Выберите одного из 5 вымышленных персонажей — увидите как Endless работает с реалистичной 5-летней историей их трат.
            </Typography>
            <Fade in timeout={2500}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 4 }}>
                Хотите со своим аккаунтом ZenMoney?{' '}
                <ButtonBase
                  onClick={() => {
                    window.location.href = 'https://github.com/d3xr/endless'
                  }}
                  sx={{
                    p: 1,
                    m: -1,
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    borderRadius: 1,
                    color: theme.palette.primary.main,
                    '&:hover': { color: theme.palette.secondary.main },
                  }}
                >
                  Поставьте self-hosted
                </ButtonBase>
              </Typography>
            </Fade>
          </Stack>
        ) : (
          <Stack spacing={3} sx={{ justifyContent: 'center', alignItems: 'center' }}>
            <Fade in timeout={1000}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => dispatch(logIn('ru'))}
                children={t('btnLogin')}
              />
            </Fade>

            <Fade in timeout={2000}>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                {t('haveTrouble')}{' '}
                <ButtonBase
                  onClick={() => dispatch(logIn('app'))}
                  sx={{
                    p: 1,
                    m: -1,
                    verticalAlign: 'baseline',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    lineHeight: 'inherit',
                    borderRadius: 1,
                    color: theme.palette.primary.main,
                    '&:hover': { color: theme.palette.secondary.main },
                    '&:focus': { color: theme.palette.secondary.main },
                  }}
                >
                  {t('btnAlternativeSignIn')}
                </ButtonBase>
              </Typography>
            </Fade>

            <Fade in timeout={3000}>
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="text"
                  color="primary"
                  size="large"
                  onClick={() => setPickerOpen(true)}
                >
                  {t('btnDemoMode')}
                </Button>
              </Box>
            </Fade>
          </Stack>
        )}
      </Stack>

      <PersonaPicker
        open={pickerOpen}
        onClose={() => {
          if (!pickerLoadingId) setPickerOpen(false)
        }}
        onPick={handlePickPersona}
        loadingId={pickerLoadingId}
      />
    </>
  )
}
