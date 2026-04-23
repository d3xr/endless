import React, { useMemo } from 'react'
import {
  Box,
  Paper,
  Stack,
  Typography,
  Divider,
  Chip,
  Tooltip,
} from '@mui/material'
import { useAppTheme } from '6-shared/ui/theme'
import { formatMoney } from '6-shared/helpers/money'
import {
  useRecurrenceRules,
  useProjectedEvents,
  usePlannedHeadline,
  RecurrenceRule,
  ProjectedEvent,
} from '5-entities/recurrence'

const CADENCE_LABEL: Record<string, string> = {
  daily: 'ежедневно',
  weekly: 'еженедельно',
  biweekly: 'раз в 2 недели',
  monthly: 'ежемесячно',
  bimonthly: 'раз в 2 мес',
  quarterly: 'раз в квартал',
  semiannual: 'раз в полгода',
  yearly: 'раз в год',
  custom: 'нерегулярно',
}

function ruleIcon(r: RecurrenceRule | ProjectedEvent): string {
  if (r.isSalary) return '💰'
  if (r.isCredit) return '🏦'
  if (!r.category) return r.type === 'income' ? '↑' : '↓'
  const c = r.category
  if (/дом|ремонт|квартплат|ипотек/i.test(c)) return '🏠'
  if (/кафе|ресторан|кофе|еда/i.test(c)) return '🍽'
  if (/авто|топлив|транспорт|такси/i.test(c)) return '🚗'
  if (/здоров|фитнес|спорт/i.test(c)) return '💪'
  if (/дети|школа/i.test(c)) return '⚽'
  if (/подписк|развлеч|сайты/i.test(c)) return '🤖'
  if (/счета|связь|интернет/i.test(c)) return '💡'
  return r.type === 'income' ? '↑' : '↓'
}

function confidenceColor(c: number, theme: any): string {
  if (c >= 0.9) return theme.palette.success.main
  if (c >= 0.7) return theme.palette.warning.main
  return theme.palette.error.main
}

function confidenceLabel(c: number): string {
  if (c >= 0.9) return 'Высокая уверенность'
  if (c >= 0.7) return 'Средняя уверенность'
  return 'Низкая уверенность'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })
}

function weekGroupLabel(date: string, now: Date): string {
  const d = new Date(date)
  const today = new Date(now.toISOString().slice(0, 10))
  const days = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (days < 0) return 'Прошло'
  if (days < 7) return 'Эта неделя'
  if (days < 14) return 'Следующая неделя'
  if (days < 21) return 'Через 2 недели'
  if (days < 28) return 'Через 3 недели'
  return 'Позже'
}

export default function PlannedPage() {
  const theme = useAppTheme()
  const headline = usePlannedHeadline()
  const rules = useRecurrenceRules()
  const events = useProjectedEvents(30)
  const now = useMemo(() => new Date(), [])

  // Group events by "week bucket" label
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ProjectedEvent[]>()
    for (const ev of events) {
      const key = weekGroupLabel(ev.date, now)
      const arr = groups.get(key) || []
      arr.push(ev)
      groups.set(key, arr)
    }
    // Preserve insertion order from events (already date-sorted)
    const order = ['Прошло', 'Эта неделя', 'Следующая неделя', 'Через 2 недели', 'Через 3 недели', 'Позже']
    return order.filter(k => groups.has(k)).map(k => ({ label: k, events: groups.get(k)! }))
  }, [events, now])

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
        📅 Запланировано
      </Typography>

      {/* Hero: cash until salary */}
      <Hero headline={headline} />

      {/* Month strip: Income / Credits only */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        <MetricCard
          label="Зарплата / мес"
          value={`+${formatMoney(headline.monthlyIncome, undefined, 0)}`}
          color={theme.palette.success.main}
          hint={`${rules.filter(r => r.isSalary).length} прихода`}
        />
        <MetricCard
          label="Кредиты / мес"
          value={`−${formatMoney(headline.monthlyCredits, undefined, 0)}`}
          color={theme.palette.error.main}
          hint={`${headline.creditsCount} ${headline.creditsCount === 1 ? 'кредит' : 'кредита'}`}
        />
      </Box>

      {/* Timeline — only salary + credits */}
      {groupedEvents.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Не нашли регулярных зарплат или кредитов в истории.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {groupedEvents.map(g => (
            <Paper key={g.label} sx={{ p: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ fontWeight: 700, display: 'block', mb: 1 }}
              >
                {g.label}
              </Typography>
              <Stack divider={<Divider flexItem />} spacing={0}>
                {g.events.map(ev => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 3, textAlign: 'center' }}
      >
        Прогноз собран автоматически по последним 12 месяцам истории. Правила
        с низкой уверенностью могут оказаться нерегулярными — проверяй по подсказкам.
      </Typography>
    </Box>
  )
}

function Hero({ headline }: { headline: ReturnType<typeof usePlannedHeadline> }) {
  const theme = useAppTheme()
  const { cashOnHand, cashAfterCredits, nextSalary, creditsTillSalary } = headline
  const cashColor = cashOnHand > 0 ? theme.palette.success.main : theme.palette.error.main

  return (
    <Paper
      sx={{
        p: { xs: 3, md: 4 },
        mb: 3,
        bgcolor: 'action.hover',
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ fontWeight: 700, letterSpacing: 1 }}
      >
        До зарплаты осталось
      </Typography>
      <Typography
        variant="h2"
        sx={{
          fontWeight: 700,
          color: cashColor,
          mt: 1,
          fontSize: { xs: '2.5rem', md: '3.5rem' },
          fontFeatureSettings: '"tnum"',
        }}
      >
        {formatMoney(cashOnHand, undefined, 0)}
      </Typography>
      {nextSalary ? (
        <>
          <Typography variant="body1" sx={{ mt: 1.5, fontWeight: 500 }}>
            Следующая ЗП —{' '}
            <strong>{formatLongDate(nextSalary.date)}</strong>{' '}
            <span style={{ color: '#888', fontWeight: 400 }}>({daysUntil(nextSalary.date)})</span>
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.3, fontFeatureSettings: '"tnum"' }}
          >
            +{formatMoney(nextSalary.amount, undefined, 0)} ₽
          </Typography>
          {creditsTillSalary > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, opacity: 0.7 }}
            >
              ─ с учётом кредитов до ЗП (−{formatMoney(creditsTillSalary, undefined, 0)}):{' '}
              <strong>{formatMoney(cashAfterCredits, undefined, 0)}</strong>
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Регулярная зарплата пока не обнаружена
        </Typography>
      )}
    </Paper>
  )
}

function daysUntil(iso: string): string {
  const d = new Date(iso)
  const today = new Date(new Date().toISOString().slice(0, 10))
  const days = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'завтра'
  if (days < 5) return `через ${days} дня`
  return `через ${days} дней`
}

function formatLongDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function MetricCard(props: { label: string; value: string; hint?: string; color?: string }) {
  const { label, value, hint, color } = props
  return (
    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          mt: 0.3,
          color: color || 'text.primary',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.3, fontSize: '0.7rem' }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  )
}

function EventRow({ ev }: { ev: ProjectedEvent }) {
  const theme = useAppTheme()
  const sign = ev.type === 'income' ? '+' : '−'
  const amtColor = ev.type === 'income' ? theme.palette.success.main : theme.palette.error.main
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 1.2,
        opacity: ev.realized ? 0.5 : 1,
      }}
    >
      <Box sx={{ fontSize: '1.4rem', width: 32, textAlign: 'center' }}>{ruleIcon(ev)}</Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            textDecoration: ev.realized ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ev.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDate(ev.date)}
          {ev.category && ` · ${ev.category}`}
          {ev.realized && ' · ✓ прошло'}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 700,
            color: amtColor,
            fontFeatureSettings: '"tnum"',
          }}
        >
          {sign}
          {formatMoney(ev.amount, undefined, 0)}
        </Typography>
        <Tooltip title={confidenceLabel(ev.confidence)}>
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: confidenceColor(ev.confidence, theme),
            }}
          />
        </Tooltip>
      </Box>
    </Box>
  )
}

function RuleRow({ rule }: { rule: RecurrenceRule }) {
  const theme = useAppTheme()
  const sign = rule.type === 'income' ? '+' : '−'
  const amtColor =
    rule.type === 'income' ? theme.palette.success.main : theme.palette.error.main
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
      <Box sx={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{ruleIcon(rule)}</Box>
      <Typography
        variant="body2"
        sx={{ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {rule.name}
      </Typography>
      <Chip
        size="small"
        label={CADENCE_LABEL[rule.cadence] || rule.cadence}
        sx={{ height: 18, fontSize: '0.65rem' }}
      />
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: amtColor,
          minWidth: 100,
          textAlign: 'right',
          fontFeatureSettings: '"tnum"',
        }}
      >
        {sign}
        {formatMoney(rule.amount, undefined, 0)}
      </Typography>
      <Tooltip title={`${confidenceLabel(rule.confidence)} · ${rule.occurrences}×`}>
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: confidenceColor(rule.confidence, theme),
          }}
        />
      </Tooltip>
    </Box>
  )
}
