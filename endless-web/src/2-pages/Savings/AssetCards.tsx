import React, { useMemo } from 'react'
import {
  Paper,
  Box,
  Typography,
  Stack,
  LinearProgress,
  Tooltip,
  Chip,
} from '@mui/material'
import { useAppTheme } from '6-shared/ui/theme'
import { formatMoney } from '6-shared/helpers/money'
import { useAssetProjections, RealAsset, ProjectedAsset, ScenarioKey } from '5-entities/assets'
import type { LayerKey, LayerVisibility } from './index'

/** Map asset type to chart layer key. */
function layerOf(asset: RealAsset): LayerKey {
  if (asset.type === 'apartment' || asset.type === 'house') return 'realEstate'
  if (asset.type === 'car') return 'vehicle'
  return 'liquid'
}

const TYPE_LABEL = {
  apartment: 'Квартира',
  house: 'Дом',
  car: 'Автомобиль',
  investment: 'Инвестиции',
  other: 'Другое',
}

export function AssetCards({ scenario = 'conservative' as ScenarioKey, visible, onToggle }: {
  scenario?: ScenarioKey
  visible?: LayerVisibility
  onToggle?: (key: LayerKey) => void
}) {
  const theme = useAppTheme()
  const { assets, projections, netWorth, liquidNow, scenario: sc } = useAssetProjections(scenario)

  if (assets.length === 0 && liquidNow === 0) return null

  const liquid5y = netWorth[Math.min(60, netWorth.length - 1)]?.liquid ?? 0
  const liquid10y = netWorth[netWorth.length - 1]?.liquid ?? 0

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Активы
      </Typography>
      <Stack spacing={2}>
        <LiquidCard
          now={liquidNow}
          in5y={liquid5y}
          in10y={liquid10y}
          annualReturn={sc.liquidReturn}
          sparkData={netWorth.filter((_, i) => i % 3 === 0).map(p => p.liquid)}
          active={visible ? visible.liquid : true}
          onClick={onToggle ? () => onToggle('liquid') : undefined}
        />
        {assets.map((asset, i) => {
          const layer = layerOf(asset)
          const active = visible ? visible[layer] : true
          return (
            <AssetCard
              key={asset.id}
              asset={asset}
              projection={projections[i]}
              active={active}
              onClick={onToggle ? () => onToggle(layer) : undefined}
            />
          )
        })}
      </Stack>
    </Paper>
  )
}

function LiquidCard({ now, in5y, in10y, annualReturn, sparkData = [], active = true, onClick }: {
  now: number; in5y: number; in10y: number; annualReturn: number
  sparkData?: number[]
  active?: boolean; onClick?: () => void
}) {
  const theme = useAppTheme()
  const ratePct = Math.round(annualReturn * 100)
  const sparkMin = sparkData.length ? Math.min(...sparkData) : 0
  const sparkMax = sparkData.length ? Math.max(...sparkData) : 1
  const sparkRange = sparkMax - sparkMin || 1
  const isGrowing = sparkData.length >= 2 && sparkData[sparkData.length - 1] > sparkData[0]

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        bgcolor: 'action.hover',
        borderRadius: 2,
        display: 'flex',
        gap: 2,
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        alignItems: 'flex-start',
        opacity: active ? 1 : 0.35,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'opacity 0.2s',
        '&:hover': onClick ? { bgcolor: 'action.selected' } : {},
      }}
    >
      <Box sx={{ minWidth: 200 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '1.8rem' }}>💰</Typography>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              Ликвидные
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Chip size="small" label="Счета/инвест" sx={{ height: 18, fontSize: '0.65rem' }} />
            </Box>
          </Box>
        </Box>
        <Typography variant="caption" sx={{
          color: ratePct >= 0 ? theme.palette.success.main : theme.palette.error.main,
          fontWeight: 600,
        }}>
          {ratePct >= 0 ? '↗' : '↘'} {Math.abs(ratePct)}%/год ({ratePct >= 0 ? 'доходность' : 'инфляция съедает'})
        </Typography>
      </Box>

      <Box sx={{ minWidth: 140, textAlign: { xs: 'left', md: 'center' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Сейчас
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
          {formatMoney(now, undefined, 0)}
        </Typography>
      </Box>

      <Box sx={{ minWidth: 120, textAlign: { xs: 'left', md: 'center' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Ежемес. вклады
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum"', color: theme.palette.success.main }}>
          +{Math.round((in5y - now) / 60 / 1000)}К/мес
        </Typography>
        <Typography variant="caption" color="text.secondary">
          среднее
        </Typography>
      </Box>

      <Box sx={{ minWidth: 140, textAlign: { xs: 'left', md: 'right' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Прогноз
        </Typography>
        <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum"' }}>
          5 лет: <strong>{formatMoney(in5y, undefined, 0)}</strong>
        </Typography>
        <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum"' }}>
          10 лет: <strong>{formatMoney(in10y, undefined, 0)}</strong>
        </Typography>
      </Box>

      {/* Mini sparkline */}
      {sparkData.length > 1 && (
        <Box sx={{ width: 120, height: 50, flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
          <svg width="120" height="50" viewBox="0 0 120 50">
            <polyline
              fill="none"
              stroke={isGrowing ? theme.palette.success.main : theme.palette.error.main}
              strokeWidth="1.5"
              strokeLinejoin="round"
              points={sparkData
                .map((v, i) => {
                  const x = (i / (sparkData.length - 1)) * 120
                  const y = 48 - ((v - sparkMin) / sparkRange) * 46
                  return `${x},${y}`
                })
                .join(' ')}
            />
          </svg>
        </Box>
      )}
    </Box>
  )
}

function AssetCard({ asset, projection, active = true, onClick }: {
  asset: RealAsset
  projection: ProjectedAsset[]
  active?: boolean
  onClick?: () => void
}) {
  const theme = useAppTheme()

  const now = projection[0]
  const in5y = projection[Math.min(60, projection.length - 1)]
  const in10y = projection[projection.length - 1]

  if (!now) return null

  const hasLoan = now.loanBalance < 0
  const loanPaidOff = in10y && in10y.loanBalance >= 0
  const growthRate = asset.growthPhases[0]?.rate ?? 0
  const isGrowing = growthRate > 0

  // Sparkline: monthly equity for last projection
  const sparkData = useMemo(() => {
    // Take every 3rd month for 10-year view
    return projection
      .filter((_, i) => i % 3 === 0)
      .map(p => p.equity)
  }, [projection])

  const sparkMin = Math.min(...sparkData)
  const sparkMax = Math.max(...sparkData)
  const sparkRange = sparkMax - sparkMin || 1

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        bgcolor: 'action.hover',
        borderRadius: 2,
        display: 'flex',
        gap: 2,
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        alignItems: 'flex-start',
        opacity: active ? 1 : 0.35,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'opacity 0.2s',
        '&:hover': onClick ? { bgcolor: 'action.selected' } : {},
      }}
    >
      {/* Emoji + Name */}
      <Box sx={{ minWidth: 200 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: '1.8rem' }}>{asset.emoji}</Typography>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {asset.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Chip
                size="small"
                label={TYPE_LABEL[asset.type] || asset.type}
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
              {asset.sqm && (
                <Typography variant="caption" color="text.secondary">
                  {asset.sqm} м²
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* Trend label */}
        <Typography
          variant="caption"
          sx={{
            color: isGrowing ? theme.palette.success.main : theme.palette.error.main,
            fontWeight: 600,
          }}
        >
          {isGrowing ? '↗' : '↘'}{' '}
          {Math.abs(growthRate * 100).toFixed(0)}%/год (
          {isGrowing ? 'рост' : 'амортизация'})
        </Typography>
      </Box>

      {/* Current value */}
      <Box sx={{ minWidth: 140, textAlign: { xs: 'left', md: 'center' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Рыночная стоимость
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
          {formatMoney(now.grossValue, undefined, 0)}
        </Typography>
        {hasLoan && (
          <Tooltip title={`Остаток долга: ${formatMoney(Math.abs(now.loanBalance), undefined, 0)}`}>
            <Typography variant="caption" color="error.main">
              Долг: −{formatMoney(Math.abs(now.loanBalance), undefined, 0)}
            </Typography>
          </Tooltip>
        )}
      </Box>

      {/* Equity */}
      <Box sx={{ minWidth: 120, textAlign: { xs: 'left', md: 'center' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Твоё (equity)
        </Typography>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontFeatureSettings: '"tnum"',
            color: theme.palette.success.main,
          }}
        >
          {formatMoney(now.equity, undefined, 0)}
        </Typography>
      </Box>

      {/* 5yr / 10yr projection */}
      <Box sx={{ minWidth: 140, textAlign: { xs: 'left', md: 'right' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Прогноз equity
        </Typography>
        <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum"' }}>
          5 лет: <strong>{formatMoney(in5y?.equity ?? 0, undefined, 0)}</strong>
        </Typography>
        <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum"' }}>
          10 лет: <strong>{formatMoney(in10y?.equity ?? 0, undefined, 0)}</strong>
        </Typography>
        {hasLoan && loanPaidOff && (
          <Typography variant="caption" color="success.main">
            Долг закрыт ✓
          </Typography>
        )}
      </Box>

      {/* Mini sparkline */}
      <Box sx={{ width: 120, height: 50, flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
        <svg width="120" height="50" viewBox="0 0 120 50">
          <polyline
            fill="none"
            stroke={isGrowing ? theme.palette.success.main : theme.palette.error.main}
            strokeWidth="1.5"
            strokeLinejoin="round"
            points={sparkData
              .map((v, i) => {
                const x = (i / (sparkData.length - 1)) * 120
                const y = 48 - ((v - sparkMin) / sparkRange) * 46
                return `${x},${y}`
              })
              .join(' ')}
          />
        </svg>
      </Box>
    </Box>
  )
}
