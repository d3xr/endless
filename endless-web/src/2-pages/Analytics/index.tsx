import React, { useState, useCallback } from 'react'
import { Stack, Box, Tabs, Tab } from '@mui/material'
import { WidgetByCategory } from '../Stats/WidgetByCategory'
import { WidgetCashflow } from '../Stats/WidgetCashflow'
import { WidgetNetWorth } from '../Stats/WidgetNetWorth'
import { WidgetAccHistory } from '../Stats/WidgetAccHistory'
import { nextPeriod, Period } from '../Stats/shared/period'

type TabId = 'endless' | 'classic'

export default function Analytics() {
  const [period, setPeriod] = useState<Period>(Period.LastYear)
  const [tab, setTab] = useState<TabId>('endless')

  const togglePeriod = useCallback(
    () => setPeriod(prevPeriod => nextPeriod(prevPeriod)),
    []
  )

  return (
    <Box sx={{ p: 3, pb: 10 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Обзор" value="endless" />
          <Tab label="Классика" value="classic" />
        </Tabs>
      </Box>

      {tab === 'endless' && (
        <Stack spacing={2}>
          <WidgetByCategory period={period} onTogglePeriod={togglePeriod} />
          <WidgetCashflow period={period} onTogglePeriod={togglePeriod} />
        </Stack>
      )}

      {tab === 'classic' && (
        <Stack spacing={2}>
          <WidgetNetWorth period={period} onTogglePeriod={togglePeriod} />
          <WidgetCashflow period={period} onTogglePeriod={togglePeriod} />
          <WidgetAccHistory period={period} />
        </Stack>
      )}
    </Box>
  )
}
