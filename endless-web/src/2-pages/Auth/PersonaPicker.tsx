import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { PERSONAS, type Persona, type PersonaId } from 'demoData'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (id: PersonaId) => void
  loadingId?: PersonaId | null
}

const TIER_COLOR: Record<Persona['bio']['wealthTier'], string> = {
  low: '#E57373',
  'middle-low': '#FFB74D',
  middle: '#4FC3F7',
  'upper-middle': '#81C784',
  high: '#BA68C8',
}

export function PersonaPicker({ open, onClose, onPick, loadingId }: Props) {
  const [expandedId, setExpandedId] = useState<PersonaId | null>(null)
  const isMobile = useMediaQuery<Theme>(theme => theme.breakpoints.down('md'))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: { bgcolor: 'background.default' } }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Выберите героя для демо
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Пять вымышленных людей. Для каждого сгенерирована реалистичная история за 5 лет.
            </Typography>
          </Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={1.5}>
          {PERSONAS.map(p => {
            const expanded = expandedId === p.bio.id
            const loading = loadingId === p.bio.id
            return (
              <Card
                key={p.bio.id}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  borderColor: expanded ? 'primary.main' : undefined,
                  transition: 'border-color 160ms, box-shadow 160ms',
                  boxShadow: expanded ? 3 : 0,
                }}
              >
                <CardActionArea
                  onClick={() => setExpandedId(expanded ? null : p.bio.id)}
                  sx={{ p: 2.5 }}
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Typography sx={{ fontSize: 42, lineHeight: 1 }}>{p.bio.emoji}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={{ xs: 0.5, sm: 1 }}
                        alignItems={{ xs: 'flex-start', sm: 'baseline' }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {p.bio.firstName} {p.bio.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {p.bio.age} лет · {p.bio.city}
                        </Typography>
                      </Stack>
                      <Typography variant="body1" sx={{ mt: 0.25 }}>
                        {p.bio.headline}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={p.bio.wealthTierLabel}
                          sx={{
                            bgcolor: TIER_COLOR[p.bio.wealthTier] + '22',
                            color: TIER_COLOR[p.bio.wealthTier],
                            fontWeight: 600,
                          }}
                        />
                        {p.bio.family.kids.length > 0 && (
                          <Chip size="small" label={`Дети: ${p.bio.family.kids.length}`} />
                        )}
                        {p.bio.family.status === 'married' && (
                          <Chip size="small" label="В браке" variant="outlined" />
                        )}
                        {p.bio.family.status === 'single' && (
                          <Chip size="small" label="Одиночка" variant="outlined" />
                        )}
                        {p.bio.family.status === 'relationship' && (
                          <Chip size="small" label="В отношениях" variant="outlined" />
                        )}
                      </Stack>
                    </Box>
                  </Stack>

                  {expanded && (
                    <Box sx={{ mt: 2.5 }}>
                      <Divider sx={{ mb: 2 }} />
                      <Stack spacing={1.5}>
                        <Line label="Работа">
                          {p.bio.occupation.title} · {p.bio.occupation.employer} ({p.bio.occupation.yearsInRole} г. в роли)
                        </Line>
                        <Line label="Семья">{p.bio.family.livesWith}</Line>
                        <Line label="Характер">{p.bio.personality}</Line>
                        <Line label="Хобби">{p.bio.hobbies.join(', ')}</Line>
                        <Line label="Выходные">{p.bio.weekend}</Line>
                        <Line label="Развлечения">{p.bio.entertainment}</Line>
                        <Line label="Деньги">{p.bio.financialHabits}</Line>
                        <Line label="Больные места">{p.bio.painPoints}</Line>
                        <Line label="История">{p.bio.backstory}</Line>
                      </Stack>
                    </Box>
                  )}
                </CardActionArea>

                {expanded && (
                  <Box sx={{ px: 2.5, pb: 2.5 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={loading}
                      onClick={e => {
                        e.stopPropagation()
                        onPick(p.bio.id)
                      }}
                      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
                    >
                      {loading
                        ? 'Генерирую 5 лет истории…'
                        : `Войти как ${p.bio.firstName}`}
                    </Button>
                  </Box>
                )}
              </Card>
            )
          })}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
          Все данные синтетические. Транзакции, счета, премии, отпуска — сгенерированы по биографии.
          Ничего не уходит на сервер — всё живёт в вашем браузере.
        </Typography>
      </DialogContent>
    </Dialog>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>
        {children}
      </Typography>
    </Box>
  )
}
