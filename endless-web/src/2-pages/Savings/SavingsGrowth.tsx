import React, { useMemo, useState, useEffect } from 'react'
import {
  Paper,
  Box,
  Typography,
  useMediaQuery,
  Theme,
  Checkbox,
  Collapse,
  Button,
  Chip,
  Divider,
} from '@mui/material'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { useAppTheme } from '6-shared/ui/theme'
import { formatMoney } from '6-shared/helpers/money'
import { useAppSelector } from 'store/index'
import { accountModel, TAccountPopulated } from '5-entities/account'
import { accBalanceModel } from '5-entities/accBalances'
import { AccountType } from '6-shared/types'
import { toISOMonth } from '6-shared/helpers/date'
import { displayCurrency } from '5-entities/currency/displayCurrency'

const PERIOD_LABELS = {
  '6m': 'за полгода',
  '1y': 'за год',
  '3y': 'за 3 года',
  all: 'за всё время',
} as const
type Period = keyof typeof PERIOD_LABELS
const PERIOD_CYCLE: Period[] = ['1y', '6m', '3y', 'all']
const nextPeriod = (p: Period) =>
  PERIOD_CYCLE[(PERIOD_CYCLE.indexOf(p) + 1) % PERIOD_CYCLE.length]

/** Moving-average window (days) by period — гасит недельные всплески
 *  переводов между счетами, но сохраняет реальный тренд. */
const SMOOTH_WINDOW_DAYS: Record<Period, number> = {
  '6m': 14,
  '1y': 21,
  '3y': 45,
  all: 75,
}

function startDateFor(period: Period): string | null {
  if (period === 'all') return null
  const d = new Date()
  if (period === '6m') d.setMonth(d.getMonth() - 6)
  if (period === '1y') d.setFullYear(d.getFullYear() - 1)
  if (period === '3y') d.setFullYear(d.getFullYear() - 3)
  return d.toISOString().slice(0, 10)
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  const m = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  return `${m[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

const TYPE_LABEL: Record<string, string> = {
  cash: 'Наличные',
  ccard: 'Кредитка',
  checking: 'Дебетовая',
  loan: 'Кредит/ипотека',
  deposit: 'Вклад',
  emoney: 'Эл. деньги',
  debt: 'Долг',
}

// v6: Инвест копилка = основной фонд, всё остальное (WB wallet, вклады,
// накопительные счета, Saver) = буфер. Пользователь может переназначить
// чипом в списке счетов.
const STORAGE_KEY = 'endless_savings_v6'

// Ccard'ы в ZenMoney могут быть и кредитками, и "кошельками" с процентом
// (WB wallet, Депозит Локо). Распознаём по названию.
const SAVINGS_NAME_RE = /wallet|копилк|вклад|депозит|накоп|saver|broker|брокер|инвест/i
// По умолчанию в "Фонд" попадает только Инвест копилка — это долгосрочный
// запас пользователя. Остальные savings-кандидаты = буфер.
const CORE_NAME_RE = /инвест\s*копилк/i

interface StoredState {
  core: string[]
  buffer: string[]
}

/** true = этот счёт вообще может быть "накоплениями". */
function isSavingsCandidate(a: TAccountPopulated): boolean {
  if (a.type === AccountType.Loan) return false
  if (a.type === AccountType.Debt) return false
  if (a.title?.includes('Endless Data')) return false
  if (a.type === AccountType.Deposit) return true
  if (a.type === AccountType.Checking && !a.inBudget) return true
  if (a.type === AccountType.Cash && !a.inBudget) return true
  if (a.type === AccountType.Ccard && SAVINGS_NAME_RE.test(a.title || '')) return true
  return false
}

/** true = это "основной фонд". По умолчанию только Инвест копилка. */
function isCoreAccount(a: TAccountPopulated): boolean {
  return CORE_NAME_RE.test(a.title || '')
}

/** Дефолты: все неархивные savings-кандидаты, разделённые на core/buffer. */
function computeDefaults(accounts: TAccountPopulated[]): StoredState {
  const core: string[] = []
  const buffer: string[] = []
  for (const a of accounts) {
    if (a.archive) continue
    if (!isSavingsCandidate(a)) continue
    if (isCoreAccount(a)) core.push(a.id)
    else buffer.push(a.id)
  }
  return { core, buffer }
}

function loadState(defaults: StoredState): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as StoredState
    return { core: parsed.core ?? [], buffer: parsed.buffer ?? [] }
  } catch {
    return defaults
  }
}

function saveState(state: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

/** Скользящее среднее по полям fields. window — в точках (= в днях,
 *  т.к. balancesByDate даёт daily grid). */
function smoothSeries<T extends Record<string, any>>(
  points: T[],
  window: number,
  fields: (keyof T)[]
): T[] {
  if (window <= 1 || points.length <= 1) return points
  return points.map((p, i) => {
    const from = Math.max(0, i - window + 1)
    const n = i - from + 1
    const sums: Record<string, number> = {}
    for (const f of fields) sums[f as string] = 0
    for (let j = from; j <= i; j++) {
      for (const f of fields) sums[f as string] += points[j][f] as number
    }
    const out = { ...p }
    for (const f of fields) (out as any)[f] = Math.round(sums[f as string] / n)
    return out
  })
}

export function SavingsGrowth() {
  const theme = useAppTheme()
  const isSmall = useMediaQuery<Theme>(t => t.breakpoints.down('md'))
  const [period, setPeriod] = useState<Period>('1y')
  const [listOpen, setListOpen] = useState(false)

  // Все savings-кандидаты (включая in-budget WB wallet и архивные).
  const allAccounts = accountModel.useAccountList()
  const savingAccounts = useMemo(
    () => allAccounts.filter(isSavingsCandidate),
    [allAccounts]
  )
  const toDisplay = displayCurrency.useToDisplay(toISOMonth(new Date()))

  const defaults = useMemo(() => computeDefaults(savingAccounts), [savingAccounts])
  const [state, setState] = useState<StoredState>(() => loadState(defaults))

  // Если пользователь ещё не трогал настройки — синхронизируемся со свежими
  // дефолтами (savingAccounts может грузиться постепенно).
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setState(defaults)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.core.length + defaults.buffer.length])

  const coreSet = useMemo(() => new Set(state.core), [state.core])
  const bufferSet = useMemo(() => new Set(state.buffer), [state.buffer])

  /** Режим счёта: 'core' | 'buffer' | 'off'. */
  const modeOf = (id: string): 'core' | 'buffer' | 'off' =>
    coreSet.has(id) ? 'core' : bufferSet.has(id) ? 'buffer' : 'off'

  const setMode = (id: string, mode: 'core' | 'buffer' | 'off') => {
    const next: StoredState = {
      core: state.core.filter(x => x !== id),
      buffer: state.buffer.filter(x => x !== id),
    }
    if (mode === 'core') next.core.push(id)
    if (mode === 'buffer') next.buffer.push(id)
    setState(next)
    saveState(next)
  }

  const toggleSelected = (id: string, kind: 'core' | 'buffer') => {
    setMode(id, modeOf(id) === 'off' ? kind : 'off')
  }

  const flipCoreBuffer = (id: string) => {
    const m = modeOf(id)
    if (m === 'core') setMode(id, 'buffer')
    else if (m === 'buffer') setMode(id, 'core')
  }

  const resetToDefaults = () => {
    setState(defaults)
    saveState(defaults)
  }

  const balancesByDate = useAppSelector(accBalanceModel.getDisplayBalancesByDate)

  const { chartData, coreNow, bufferNow, totalNow, totalStart, peakTotal } = useMemo(() => {
    const startStr = startDateFor(period)
    const filtered = startStr
      ? balancesByDate.filter(n => n.date >= startStr)
      : balancesByDate

    // 1. Сырые daily points с разбивкой core/buffer
    const raw = filtered.map(node => {
      let core = 0
      let buffer = 0
      for (const accId of Object.keys(node.balances.accounts)) {
        const value = node.balances.accounts[accId] as unknown as number
        if (typeof value !== 'number') continue
        if (coreSet.has(accId)) core += value
        else if (bufferSet.has(accId)) buffer += value
      }
      return { date: node.date, core: Math.round(core), buffer: Math.round(buffer) }
    })

    // 2. Сглаживание moving average
    const smoothed = smoothSeries(raw, SMOOTH_WINDOW_DAYS[period], ['core', 'buffer'])

    // 2b. Последняя точка графика должна совпадать с "сейчас" в шапке.
    // Moving average отстаёт на window/2 дней, поэтому делаем короткий
    // "ре-anchor" к фактическому балансу: последние 5 точек переходят
    // линейно от сглаженной к raw, а самая последняя = raw.
    if (smoothed.length > 0 && raw.length > 0) {
      const tail = Math.min(5, smoothed.length)
      const lastIdx = smoothed.length - 1
      const last = raw[raw.length - 1]
      for (let k = 0; k < tail; k++) {
        const i = lastIdx - (tail - 1 - k)
        const t = (k + 1) / tail // 1/tail … 1
        smoothed[i] = {
          ...smoothed[i],
          core: Math.round(smoothed[i].core * (1 - t) + last.core * t),
          buffer: Math.round(smoothed[i].buffer * (1 - t) + last.buffer * t),
        }
      }
    }

    // 3. Прореживание до ~180 точек для recharts. Последнюю точку всегда
    // сохраняем, чтобы конец графика = фактический "сейчас".
    const maxPoints = 180
    const step = Math.max(1, Math.floor(smoothed.length / maxPoints))
    const sampled = smoothed.filter((_, i) => i % step === 0)
    if (smoothed.length > 0 && sampled[sampled.length - 1]?.date !== smoothed[smoothed.length - 1].date) {
      sampled.push(smoothed[smoothed.length - 1])
    }

    const last = raw[raw.length - 1]
    const first = raw[0]
    const peak = raw.reduce((m, p) => Math.max(m, p.core + p.buffer), 0)

    return {
      chartData: sampled,
      coreNow: last?.core ?? 0,
      bufferNow: last?.buffer ?? 0,
      totalNow: (last?.core ?? 0) + (last?.buffer ?? 0),
      totalStart: (first?.core ?? 0) + (first?.buffer ?? 0),
      peakTotal: peak,
    }
  }, [balancesByDate, coreSet, bufferSet, period])

  const delta = totalNow - totalStart
  const deltaPct = totalStart > 0 ? (delta / totalStart) * 100 : 0

  // Показываем и архивные (WB wallet 575K peak и т.п.), но уводим в конец.
  const activeAccounts = [...savingAccounts].sort((a, b) => {
    if (a.archive !== b.archive) return a.archive ? 1 : -1
    const aMode = modeOf(a.id)
    const bMode = modeOf(b.id)
    const rank = (m: string) => (m === 'core' ? 0 : m === 'buffer' ? 1 : 2)
    if (rank(aMode) !== rank(bMode)) return rank(aMode) - rank(bMode)
    return toDisplay({ [b.fxCode]: b.balance }) - toDisplay({ [a.fxCode]: a.balance })
  })

  const selectedCount = state.core.length + state.buffer.length

  const CORE_COLOR = theme.palette.success.main
  const BUFFER_COLOR = theme.palette.warning.main

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h5">
        Рост накоплений{' '}
        <span
          style={{
            color: theme.palette.secondary.main,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={() => setPeriod(nextPeriod(period))}
        >
          {PERIOD_LABELS[period]}
        </span>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Сумма по {selectedCount} счетам · сглажено на {SMOOTH_WINDOW_DAYS[period]} дн
      </Typography>

      {/* Summary */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 2, flexWrap: 'wrap' }}>
        <Typography
          variant="h3"
          sx={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}
        >
          {formatMoney(totalNow, undefined, 0)}
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: delta >= 0 ? theme.palette.success.main : theme.palette.error.main,
            fontFeatureSettings: '"tnum"',
          }}
        >
          {delta >= 0 ? '+' : ''}
          {formatMoney(delta, undefined, 0)}
          {totalStart > 0 && ` (${delta >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: CORE_COLOR, fontWeight: 600 }}>
          ● Фонд: {formatMoney(coreNow, undefined, 0)}
        </Typography>
        <Typography variant="caption" sx={{ color: BUFFER_COLOR, fontWeight: 600 }}>
          ● Буфер: {formatMoney(bufferNow, undefined, 0)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Старт: {formatMoney(totalStart, undefined, 0)} · Пик: {formatMoney(peakTotal, undefined, 0)}
        </Typography>
      </Box>

      {chartData.length === 0 || selectedCount === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {selectedCount === 0
              ? 'Выбери хотя бы один счёт ниже'
              : 'Нет истории балансов за выбранный период'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <ResponsiveContainer height={isSmall ? 240 : 320}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="coreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CORE_COLOR} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={CORE_COLOR} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="bufferFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BUFFER_COLOR} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={BUFFER_COLOR} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid opacity={0.3} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                axisLine={false}
                tickLine={false}
                stroke={theme.palette.text.disabled}
                style={{ fontSize: '11px' }}
                minTickGap={50}
              />
              <YAxis
                tickFormatter={v => formatMoney(v, undefined, 0)}
                axisLine={false}
                tickLine={false}
                stroke={theme.palette.text.disabled}
                style={{ fontSize: '11px' }}
                width={80}
              />
              <RechartsTooltip content={<GrowthTooltip coreColor={CORE_COLOR} bufferColor={BUFFER_COLOR} />} />
              <ReferenceLine
                y={totalStart}
                stroke={theme.palette.text.disabled}
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="core"
                name="Фонд"
                stackId="1"
                stroke={CORE_COLOR}
                strokeWidth={2}
                fill="url(#coreFill)"
              />
              <Area
                type="monotone"
                dataKey="buffer"
                name="Буфер"
                stackId="1"
                stroke={BUFFER_COLOR}
                strokeWidth={1.5}
                fill="url(#bufferFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* Accounts list toggle */}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant="text"
          onClick={() => setListOpen(!listOpen)}
          sx={{ textTransform: 'none', color: 'text.secondary' }}
        >
          {listOpen ? 'Скрыть счета' : `Какие счета учтены (${selectedCount})`}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        {listOpen && (
          <Button size="small" onClick={resetToDefaults} sx={{ textTransform: 'none' }}>
            По умолчанию
          </Button>
        )}
      </Box>

      <Collapse in={listOpen}>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Чекбокс = включить на график. Чип «Фонд / Буфер» переключает слой —
            фонд снизу (зелёный, «не трогаю»), буфер сверху (оранжевый, «цели и
            транзиты»).
          </Typography>
          {activeAccounts.map(acc => {
            const balanceDisplay = toDisplay({ [acc.fxCode]: acc.balance })
            const mode = modeOf(acc.id)
            const isSelected = mode !== 'off'
            return (
              <Box
                key={acc.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 0.5,
                  opacity: isSelected ? 1 : 0.5,
                }}
              >
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onChange={() =>
                    toggleSelected(
                      acc.id,
                      // по умолчанию новый счёт идёт в ту группу, где он бы
                      // оказался в дефолтах (Ф/Б определяется типом + именем)
                      isCoreAccount(acc) ? 'core' : 'buffer'
                    )
                  }
                />
                {isSelected && (
                  <Chip
                    size="small"
                    label={mode === 'core' ? 'Фонд' : 'Буфер'}
                    onClick={() => flipCoreBuffer(acc.id)}
                    sx={{
                      mr: 1,
                      height: 20,
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                      bgcolor: mode === 'core' ? CORE_COLOR : BUFFER_COLOR,
                      color: '#fff',
                      fontWeight: 600,
                      '&:hover': { opacity: 0.85 },
                    }}
                  />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    flexGrow: 1,
                    fontWeight: isSelected ? 500 : 400,
                    color: acc.archive ? 'text.secondary' : 'text.primary',
                  }}
                >
                  {acc.title}
                  {acc.archive && (
                    <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                      (архив)
                    </Typography>
                  )}
                </Typography>
                <Chip
                  size="small"
                  label={TYPE_LABEL[acc.type] || acc.type}
                  sx={{ mx: 1, height: 18, fontSize: '0.65rem' }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: 110,
                    textAlign: 'right',
                    fontFeatureSettings: '"tnum"',
                    color:
                      balanceDisplay < 0
                        ? theme.palette.error.main
                        : theme.palette.text.primary,
                  }}
                >
                  {formatMoney(balanceDisplay, undefined, 0)}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Collapse>
    </Paper>
  )
}

function GrowthTooltip(props: any) {
  const { active, payload, coreColor, bufferColor } = props
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const total = (p.core ?? 0) + (p.buffer ?? 0)
  return (
    <Paper sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {new Date(p.date).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
        {formatMoney(total, undefined, 0)}
      </Typography>
      {p.core > 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: coreColor }}>
          Фонд: {formatMoney(p.core, undefined, 0)}
        </Typography>
      )}
      {p.buffer > 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: bufferColor }}>
          Буфер: {formatMoney(p.buffer, undefined, 0)}
        </Typography>
      )}
    </Paper>
  )
}
