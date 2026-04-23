import React, { FC, useMemo } from 'react'
import { useRouteMatch } from 'react-router-dom'
import { Link } from 'react-router-dom'
import RefreshButton from '3-widgets/RefreshButton'
import { MenuButton } from './MenuButton'
import {
  Box,
  Drawer,
  Divider,
  List,
  ListItemText,
  ListItemIcon,
  DrawerProps,
  ListItemButton,
  Typography,
  Chip,
} from '@mui/material'
import { trModel } from '5-entities/transaction'
import {
  AccountBalanceIcon,
  HelpOutlineIcon,
  SyncAltIcon,
  WhatshotIcon,
  BarChartIcon,
  CategoryIcon,
  CalendarIcon,
  TrendingUpIcon,
} from '6-shared/ui/Icons'
// Logo removed — replaced with Endless text
import { useAppTheme } from '6-shared/ui/theme'

import AccountList from '3-widgets/account/AccountList'
import { DebtorList } from '3-widgets/DebtorList'
import { useTranslation } from 'react-i18next'

export default function NavigationDrawer(props: DrawerProps) {
  const theme = useAppTheme()

  return (
    <Drawer {...props}>
      <Box
        sx={{
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Box
          sx={{
            width: '100%',
            px: 1,
            pt: 2,
          }}
        >
          <Links />
        </Box>

        <Box
          sx={{
            width: '100%',
            py: 3,
          }}
        >
          <Divider />
        </Box>

        <Box
          sx={{
            width: '100%',
            px: 1,
          }}
        >
          <AccountList />
        </Box>

        <Box
          sx={{
            width: '100%',
            px: 1,
          }}
        >
          <DebtorList />
        </Box>

        <Box
          sx={{
            height: 64,
            width: '100%',
            flexShrink: 0,
          }}
        />

        <Box
          sx={{
            bgcolor: 'background.paper',
            width: '100%',
            pt: 1,
            pb: 2,
            px: 3,
            mt: 'auto',
            position: 'sticky',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: '5',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'row',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
            Endless
          </Typography>
          <Box
            sx={{
              ml: 'auto',
            }}
          >
            <RefreshButton />
            <MenuButton edge="end" />
          </Box>
        </Box>
      </Box>
    </Drawer>
  )
}

function useUncategorizedCount() {
  // Считает P2P транзакции за последние 2 дня без категории (не переводы между счетами)
  const transactions = trModel.useTransactionsHistory()
  return useMemo(() => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const cutoff = twoDaysAgo.toISOString().slice(0, 10)
    let count = 0
    for (const tx of transactions) {
      if (tx.deleted) continue
      if (tx.date < cutoff) continue
      if (tx.tag && tx.tag.length > 0) continue
      // skip account transfers
      if (tx.income > 0 && tx.outcome > 0) continue
      count++
    }
    return count
  }, [transactions])
}

function Links() {
  const { t } = useTranslation('navigation')
  const uncategorized = useUncategorizedCount()
  return (
    <List>
      <NavigationLink
        text={t('budget')}
        path="/budget"
        icon={<AccountBalanceIcon />}
      />
      <NavigationLink
        text={t('transactions')}
        path="/transactions"
        icon={<SyncAltIcon />}
      />
      <NavigationLink text="Запланировано" path="/planned" icon={<CalendarIcon />} />
      <NavigationLink text="Капитал" path="/savings" icon={<TrendingUpIcon />} />
      <NavigationLink text="Аналитика" path="/analytics" icon={<BarChartIcon />} />
      <NavigationLink
        text="Категоризация"
        path="/categorize"
        icon={<CategoryIcon />}
        badge={uncategorized > 0 ? uncategorized : undefined}
      />
      <NavigationLink
        text="Как пользоваться"
        path="/about"
        icon={<HelpOutlineIcon />}
      />
      <NavigationLink
        text={t('yearWrapped')}
        path="/review"
        icon={<WhatshotIcon />}
      />
    </List>
  )
}

const NavigationLink: FC<{
  icon: React.ReactNode
  text: React.ReactNode
  path: string
  badge?: number
}> = ({ icon, text, path, badge }) => {
  const match = useRouteMatch(path)
  return (
    <ListItemButton
      sx={{ borderRadius: 1 }}
      selected={!!match}
      component={Link}
      to={path}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={text} />
      {badge !== undefined && (
        <Chip
          size="small"
          label={badge}
          color="warning"
          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
        />
      )}
    </ListItemButton>
  )
}
