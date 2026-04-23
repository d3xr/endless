import React, { useState, useCallback } from 'react'
import { Box, Stack, Typography, Chip } from '@mui/material'
import { WidgetGoals } from '../Analytics/WidgetGoals'
import { SavingsGrowth } from './SavingsGrowth'
import { NetWorthHero } from './NetWorthHero'
import { AssetCards } from './AssetCards'
import { ScenarioKey, SCENARIOS, SCENARIO_KEYS } from '5-entities/assets'

export type LayerKey = 'realEstate' | 'vehicle' | 'liquid'
export type LayerVisibility = Record<LayerKey, boolean>

export default function CapitalPage() {
  const [scenario, setScenario] = useState<ScenarioKey>('conservative')
  const [visible, setVisible] = useState<LayerVisibility>({
    realEstate: true,
    vehicle: true,
    liquid: true,
  })

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisible(v => ({ ...v, [key]: !v[key] }))
  }, [])

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 10, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5 }}>
        Капитал
      </Typography>

      <Box sx={{
        display: 'flex', gap: 1, mb: 3, overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {SCENARIO_KEYS.map(k => {
          const s = SCENARIOS[k]
          const active = scenario === k
          return (
            <Chip
              key={k}
              label={`${s.emoji} ${s.label}`}
              variant={active ? 'filled' : 'outlined'}
              onClick={() => setScenario(k)}
              sx={{
                fontWeight: active ? 600 : 400,
                bgcolor: active ? `${s.color}22` : 'transparent',
                borderColor: active ? s.color : 'divider',
                color: active ? s.color : 'text.secondary',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            />
          )
        })}
      </Box>

      <Stack spacing={2.5}>
        <NetWorthHero scenario={scenario} visible={visible} onToggle={toggleLayer} />
        <AssetCards scenario={scenario} visible={visible} onToggle={toggleLayer} />
        <SavingsGrowth />
        <WidgetGoals />
      </Stack>
    </Box>
  )
}
