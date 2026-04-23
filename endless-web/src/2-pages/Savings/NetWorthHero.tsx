import React, { useMemo, useState, useCallback } from 'react'
import {
  Paper, Box, Typography, useMediaQuery, Theme,
} from '@mui/material'
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  Tooltip as RechartsTooltip, CartesianGrid,
} from 'recharts'
import { useAppTheme } from '6-shared/ui/theme'
import { formatMoney } from '6-shared/helpers/money'
import { useAssetProjections, ScenarioKey, RUB_PER_USD_NOW } from '5-entities/assets'
import type { LayerKey, LayerVisibility } from './index'

/** Adjust nominal value to today's purchasing power using scenario's inflation rate. */
function realValue(nominal: number, years: number, inflationRate: number): number {
  return nominal / Math.pow(1 + inflationRate, years)
}

/** Linear interpolation of RUB/USD rate between now (85) and end-of-10y. */
function rubPerUsdAt(years: number, rubEnd: number): number {
  return RUB_PER_USD_NOW + (rubEnd - RUB_PER_USD_NOW) * (years / 10)
}

const HORIZONS = { '3m': 3, '6m': 6, '1y': 12, '3y': 36, '5y': 60, '10y': 120 } as const
type Horizon = keyof typeof HORIZONS
const HORIZON_LABELS: Record<Horizon, string> = {
  '3m': '3 мес', '6m': '6 мес', '1y': '1 год', '3y': '3 года', '5y': '5 лет', '10y': '10 лет',
}
const HORIZON_CYCLE: Horizon[] = ['10y', '5y', '3y', '1y', '6m', '3m']

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const m = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
  return `${m[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`
}

export function NetWorthHero({ scenario, visible, onToggle }: {
  scenario: ScenarioKey
  visible: LayerVisibility
  onToggle: (key: LayerKey) => void
}) {
  const theme = useAppTheme()
  const isSmall = useMediaQuery<Theme>(t => t.breakpoints.down('md'))
  const [horizon, setHorizon] = useState<Horizon>('3y')
  const toggleLayer = onToggle

  const { netWorth, monthlySavings, scenario: sc } = useAssetProjections(scenario)
  const months = HORIZONS[horizon]

  const chartData = useMemo(() => {
    return netWorth
      .filter((_, i) => i % (months > 60 ? 3 : 1) === 0)
      .slice(0, months + 1)
      .map(p => ({
        date: p.date,
        realEstate: Math.round(p.realEstate / 1e6 * 10) / 10,
        vehicle: Math.round(p.vehicle / 1e6 * 10) / 10,
        liquid: Math.round(p.liquid / 1e6 * 10) / 10,
        total: Math.round(p.total / 1e6 * 10) / 10,
      }))
  }, [netWorth, months])

  const current = netWorth[0]
  const future = netWorth[Math.min(months, netWorth.length - 1)]
  if (!current || !future) return null

  // Sum only VISIBLE layers for header (fixes bug: header showed total even with layers toggled off)
  const sumVisible = (p: typeof current) =>
    (visible.realEstate ? p.realEstate : 0) +
    (visible.vehicle ? p.vehicle : 0) +
    (visible.liquid ? p.liquid : 0)
  const visCurrent = sumVisible(current)
  const visFuture = sumVisible(future)
  const delta = visFuture - visCurrent

  // Real (inflation-adjusted) + USD at projected exchange rate
  const years = months / 12
  const visFutureReal = realValue(visFuture, years, sc.inflationRate)
  const visFutureUsd = visFuture / rubPerUsdAt(years, sc.rubPerUsdEnd)
  const visCurrentUsd = visCurrent / RUB_PER_USD_NOW

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5">
        Чистый капитал{' '}
        <span
          style={{ color: theme.palette.secondary.main, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => setHorizon(HORIZON_CYCLE[(HORIZON_CYCLE.indexOf(horizon) + 1) % HORIZON_CYCLE.length])}
        >
          прогноз {HORIZON_LABELS[horizon]}
        </span>
      </Typography>

      {/* Current → Future (shows only visible layers) */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Сейчас</Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
            {formatMoney(visCurrent, undefined, 0)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
            ≈ ${Math.round(visCurrentUsd).toLocaleString('en-US')}
          </Typography>
        </Box>
        <Typography variant="h5" color="text.secondary" sx={{ mx: 1 }}>→</Typography>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>{HORIZON_LABELS[horizon]}</Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum"', color: sc.color }}>
            {formatMoney(visFuture, undefined, 0)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
            ≈ {formatMoney(visFutureReal, undefined, 0)}₽ по ценам 2026 · ≈ ${Math.round(visFutureUsd).toLocaleString('en-US')} @{Math.round(rubPerUsdAt(years, sc.rubPerUsdEnd))}₽/$
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        +{formatMoney(delta, undefined, 0)} номинально · инфляция {Math.round(sc.inflationRate * 100)}%/год
      </Typography>

      {/* Toggleable breakdown */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <MiniStat label="Недвижимость" current={current.realEstate} future={future.realEstate}
          color="#66bb6a" active={visible.realEstate} onClick={() => toggleLayer('realEstate')} />
        <MiniStat label="Авто" current={current.vehicle} future={future.vehicle}
          color="#42a5f5" active={visible.vehicle} onClick={() => toggleLayer('vehicle')} />
        <MiniStat label="Ликвидные" current={current.liquid} future={future.liquid}
          color="#ffa726" active={visible.liquid} onClick={() => toggleLayer('liquid')} />
      </Box>

      {/* Chart */}
      <Box sx={{ mt: 2 }}>
        <ResponsiveContainer height={isSmall ? 260 : 340}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="reG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#66bb6a" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#66bb6a" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="carG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#42a5f5" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#42a5f5" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="liqG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffa726" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#ffa726" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid opacity={0.2} vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} axisLine={false} tickLine={false}
              stroke={theme.palette.text.disabled} style={{ fontSize: '11px' }} minTickGap={60} />
            <YAxis tickFormatter={v => `${v}М`} axisLine={false} tickLine={false}
              stroke={theme.palette.text.disabled} style={{ fontSize: '11px' }} width={50} />
            <RechartsTooltip content={<NWTooltip visible={visible} />} />
            {visible.realEstate && <Area type="monotone" dataKey="realEstate" stackId="1" stroke="#66bb6a" fill="url(#reG)" strokeWidth={1.5} />}
            {visible.vehicle && <Area type="monotone" dataKey="vehicle" stackId="1" stroke="#42a5f5" fill="url(#carG)" strokeWidth={1.5} />}
            {visible.liquid && <Area type="monotone" dataKey="liquid" stackId="1" stroke="#ffa726" fill="url(#liqG)" strokeWidth={1.5} />}
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}

function MiniStat({ label, current, future, color, active = true, onClick }: {
  label: string; current: number; future: number; color: string; active?: boolean; onClick?: () => void
}) {
  const delta = future - current
  return (
    <Box onClick={onClick} sx={{
      minWidth: 90, cursor: 'pointer', opacity: active ? 1 : 0.3, transition: 'opacity 0.2s',
      p: 0.8, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' },
    }}>
      <Typography variant="caption" sx={{ color, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.6rem' }}>
        {active ? '●' : '○'} {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum"', fontSize: '0.8rem' }}>
        {formatMoney(current, undefined, 0)} → {formatMoney(future, undefined, 0)}
      </Typography>
      <Typography variant="caption" color={delta >= 0 ? 'success.main' : 'error.main'} sx={{ fontSize: '0.65rem' }}>
        {delta >= 0 ? '+' : ''}{formatMoney(delta, undefined, 0)}
      </Typography>
    </Box>
  )
}

function NWTooltip(props: any) {
  const { active, payload, visible } = props
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  const t = (visible?.realEstate ? p.realEstate : 0) + (visible?.vehicle ? p.vehicle : 0) + (visible?.liquid ? p.liquid : 0)
  return (
    <Paper sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {new Date(p.date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Итого: {t.toFixed(1)}М</Typography>
      {visible?.realEstate && <Typography variant="caption" sx={{ display: 'block', color: '#66bb6a' }}>Недвижимость: {p.realEstate.toFixed(1)}М</Typography>}
      {visible?.vehicle && <Typography variant="caption" sx={{ display: 'block', color: '#42a5f5' }}>Авто: {p.vehicle.toFixed(1)}М</Typography>}
      {visible?.liquid && <Typography variant="caption" sx={{ display: 'block', color: '#ffa726' }}>Ликвидные: {p.liquid.toFixed(1)}М</Typography>}
    </Paper>
  )
}
