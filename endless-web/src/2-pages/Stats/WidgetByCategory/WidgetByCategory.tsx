import React, { useMemo, useState } from 'react'
import {
  Paper,
  Box,
  Typography,
  Card,
  IconButton,
} from '@mui/material'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import { useAppTheme } from '6-shared/ui/theme'
import { formatMoney } from '6-shared/helpers/money'
import { trModel } from '5-entities/transaction'
import { tagModel } from '5-entities/tag'
import { ChevronLeftIcon, ChevronRightIcon } from '6-shared/ui/Icons'
import { useTransactionDrawer } from '3-widgets/global/TransactionListDrawer'
import { Period } from '../shared/period'

type WidgetByCategoryProps = {
  period?: Period
  onTogglePeriod?: () => void
}

/** Period selector — how wide the window is, in months. */
type PeriodLen = 1 | 3 | 6 | 12

const PERIOD_LABELS: Record<PeriodLen, string> = {
  1: 'за месяц',
  3: 'за 3 мес',
  6: 'за полгода',
  12: 'за год',
}

const PERIOD_CYCLE: PeriodLen[] = [12, 6, 3, 1]
const nextPeriod = (p: PeriodLen): PeriodLen => {
  const idx = PERIOD_CYCLE.indexOf(p)
  return PERIOD_CYCLE[(idx + 1) % PERIOD_CYCLE.length]
}

const COLORS = [
  '#ef5350', '#ab47bc', '#5c6bc0', '#29b6f6', '#26a69a',
  '#66bb6a', '#d4e157', '#ffa726', '#8d6e63', '#78909c',
  '#ec407a', '#7e57c2', '#42a5f5', '#26c6da', '#9ccc65',
]

const RU_MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]
const RU_MONTHS_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/** Compute [startDate, endDate) for a (periodLen, offset) pair. */
function computeRange(periodLen: PeriodLen, offset: number) {
  const now = new Date()
  // End = start of (current period − offset) block
  // Anchor on first day of current month for deterministic behavior
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1 - offset * periodLen, 1)
  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - periodLen)
  return { startDate, endDate }
}

function formatRange(periodLen: PeriodLen, startDate: Date, endDate: Date): string {
  const endPrev = new Date(endDate)
  endPrev.setDate(0) // last day of previous month

  if (periodLen === 1) {
    return `${RU_MONTHS_FULL[startDate.getMonth()]} ${startDate.getFullYear()}`
  }
  // Multi-month range: "Фев–Апр 2026" or "Ноя 2025 – Апр 2026"
  const startLabel = `${RU_MONTHS_SHORT[startDate.getMonth()]}${
    startDate.getFullYear() !== endPrev.getFullYear() ? ' ' + startDate.getFullYear() : ''
  }`
  const endLabel = `${RU_MONTHS_SHORT[endPrev.getMonth()]} ${endPrev.getFullYear()}`
  return `${startLabel} – ${endLabel}`
}

interface CategoryBucket {
  id: string
  name: string
  total: number
  transactionIds: string[]
}

export function WidgetByCategory(_props: WidgetByCategoryProps) {
  const theme = useAppTheme()
  const allTransactions = trModel.useTransactionsHistory()
  const tags = tagModel.usePopulatedTags()
  const trDrawer = useTransactionDrawer()

  const [periodLen, setPeriodLen] = useState<PeriodLen>(12)
  const [offset, setOffset] = useState(0)

  const { startDate, endDate } = useMemo(
    () => computeRange(periodLen, offset),
    [periodLen, offset]
  )

  const { buckets, totalSpending, txInRange } = useMemo(() => {
    const map = new Map<string, CategoryBucket>()
    const txInRange: typeof allTransactions = []

    const startStr = startDate.toISOString().slice(0, 10)
    const endStr = endDate.toISOString().slice(0, 10)

    for (const tx of allTransactions) {
      if (tx.deleted) continue
      if (tx.date < startStr || tx.date >= endStr) continue
      if (tx.outcome <= 0) continue
      if (tx.income > 0 && tx.outcome > 0) continue

      txInRange.push(tx)

      const tagId = tx.tag?.[0] || '__none'
      const tag = tagId !== '__none' ? tags[tagId] : null
      const parentTag = tag?.parent ? tags[tag.parent] : null
      const groupId = parentTag ? tag!.parent! : tagId
      const groupName = parentTag ? parentTag.title : tag?.title || 'Без категории'

      const existing = map.get(groupId)
      if (existing) {
        existing.total += tx.outcome
        existing.transactionIds.push(tx.id)
      } else {
        map.set(groupId, {
          id: groupId,
          name: groupName,
          total: tx.outcome,
          transactionIds: [tx.id],
        })
      }
    }

    const sorted = [...map.values()].sort((a, b) => b.total - a.total).slice(0, 15)
    const totalSpending = sorted.reduce((s, d) => s + d.total, 0)
    return { buckets: sorted, totalSpending, txInRange }
  }, [allTransactions, tags, startDate, endDate])

  const data = buckets.map((b, i) => ({
    id: b.id,
    name: b.name.length > 14 ? b.name.slice(0, 12) + '…' : b.name,
    fullName: b.name,
    value: Math.round(b.total),
    color: COLORS[i % COLORS.length],
  }))

  const rangeLabel = formatRange(periodLen, startDate, endDate)
  const monthlyAvg = Math.round(totalSpending / periodLen)

  const handleBarClick = (entry: any) => {
    if (!entry || !entry.id) return
    const bucket = buckets.find(b => b.id === entry.id)
    if (!bucket) return
    const txIdSet = new Set(bucket.transactionIds)
    const categoryTransactions = txInRange.filter(t => txIdSet.has(t.id))
    trDrawer.open({
      title: `${bucket.name} · ${rangeLabel}`,
      transactions: categoryTransactions,
    })
  }

  return (
    <Paper>
      <Box sx={{ p: 2 }}>
        {/* Header: title + clickable period */}
        <Typography variant="h5">
          Расходы по категориям{' '}
          <span
            style={{
              color: theme.palette.secondary.main,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => {
              setPeriodLen(nextPeriod(periodLen))
              setOffset(0)
            }}
          >
            {PERIOD_LABELS[periodLen]}
          </span>
        </Typography>

        {/* Navigation row */}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
          <IconButton size="small" onClick={() => setOffset(offset + 1)}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="body2"
            sx={{
              minWidth: 160,
              textAlign: 'center',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {rangeLabel}
          </Typography>
          <IconButton
            size="small"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 1))}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Всего {formatMoney(totalSpending, undefined, 0)}
            {periodLen > 1 && (
              <> · ~{formatMoney(monthlyAvg, undefined, 0)}/мес</>
            )}
          </Typography>
        </Box>
      </Box>

      {data.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Нет расходов за этот период
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer height={420}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 80 }}>
            <CartesianGrid opacity={0.3} vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              stroke={theme.palette.text.secondary}
              style={{ fontSize: '11px' }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tickFormatter={v => formatMoney(v, undefined, 0)}
              axisLine={false}
              tickLine={false}
              stroke={theme.palette.text.disabled}
              style={{ fontSize: '11px' }}
            />
            <RechartsTooltip
              content={<CustomTooltip totalSpending={totalSpending} periodLen={periodLen} />}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={handleBarClick}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <Box sx={{ px: 2, pb: 2, pt: 0 }}>
        <Typography variant="caption" color="text.secondary">
          Клик на столбец — все транзакции по категории
        </Typography>
      </Box>
    </Paper>
  )
}

function CustomTooltip(props: any) {
  const { active, payload, totalSpending, periodLen } = props
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pct = totalSpending > 0 ? ((d.value / totalSpending) * 100).toFixed(1) : '0'
  const monthly = Math.round(d.value / (periodLen || 1))

  return (
    <Card elevation={10} sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {d.fullName}
      </Typography>
      <Typography variant="body2">
        {formatMoney(d.value, undefined, 0)} ({pct}%)
      </Typography>
      {periodLen > 1 && (
        <Typography variant="body2" color="text.secondary">
          ~{formatMoney(monthly, undefined, 0)}/мес
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        клик — детали
      </Typography>
    </Card>
  )
}
