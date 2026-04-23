import React, { useMemo } from 'react'
import {
  Paper,
  Box,
  Typography,
  LinearProgress,
  Stack,
  Tooltip,
} from '@mui/material'
import { useAppTheme } from '6-shared/ui/theme'
import { formatMoney } from '6-shared/helpers/money'
import { toISOMonth } from '6-shared/helpers/date'
import { accountModel } from '5-entities/account'
import { trModel } from '5-entities/transaction'
import { tagModel } from '5-entities/tag'
import { instrumentModel } from '5-entities/currency/instrument'
import { displayCurrency } from '5-entities/currency/displayCurrency'

// === Экспертные предположения для FIRE модели (из research) ===
const EMERGENCY_FUND_MONTHS = 6 // Подушка = 6 месяцев расходов
const FIRE_MULTIPLIER = 25 // Правило 4% — FIRE = 25× годовых расходов
const SAFE_WITHDRAWAL_MONTHS = 12 * 25 // = 300 мес

// Сколько месяцев смотреть назад для усреднения
const LOOKBACK_MONTHS = 3

export function WidgetGoals() {
  const theme = useAppTheme()
  const inBudgetAccounts = accountModel.useInBudgetAccounts()
  const savingsAccounts = accountModel.useSavingAccounts()
  const transactions = trModel.useTransactionsHistory()
  const tags = tagModel.usePopulatedTags()
  const instCodeMap = instrumentModel.useInstCodeMap()
  const toDisplay = displayCurrency.useToDisplay(toISOMonth(new Date()))

  // Теги, которые исключаем из расчёта расходов (переводы между своими счетами)
  const excludedTagIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, tag] of Object.entries(tags)) {
      const t = tag.title.trim().toLowerCase()
      if (t === 'переводы' || t === 'correction') ids.add(id)
    }
    return ids
  }, [tags])

  // Helper: это транзакция по исключённому тегу?
  const isExcluded = (tagIds: string[] | null) => {
    if (!tagIds || tagIds.length === 0) return false
    return excludedTagIds.has(tagIds[0])
  }

  // === Liquid assets (ликвидные активы) ===
  // inBudget + savings, только положительные (не включаем кредиты и долги)
  const liquidAssets = useMemo(() => {
    const all = [...inBudgetAccounts, ...savingsAccounts]
    return all
      .filter(a => !a.archive && a.balance > 0)
      .reduce(
        (sum, a) => sum + toDisplay({ [a.fxCode]: a.balance }),
        0
      )
  }, [inBudgetAccounts, savingsAccounts, toDisplay])

  // === Долги (ипотека, кредиты, кредитки в минусе) ===
  const debts = useMemo(() => {
    const all = [...inBudgetAccounts, ...savingsAccounts]
    return Math.abs(
      all
        .filter(a => !a.archive && a.balance < 0)
        .reduce(
          (sum, a) => sum + toDisplay({ [a.fxCode]: a.balance }),
          0
        )
    )
  }, [inBudgetAccounts, savingsAccounts, toDisplay])

  // === Средний месячный расход (за последние 3 месяца, без переводов) ===
  const avgMonthlyExpense = useMemo(() => {
    const now = new Date()
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - LOOKBACK_MONTHS,
      1
    )
    const startStr = startDate.toISOString().slice(0, 10)

    let total = 0
    for (const tx of transactions) {
      if (tx.deleted) continue
      if (tx.date < startStr) continue
      if (tx.outcome <= 0) continue
      if (tx.income > 0 && tx.outcome > 0) continue // transfer
      if (isExcluded(tx.tag)) continue // Переводы/Correction
      const fxCode = instCodeMap[tx.outcomeInstrument]
      if (!fxCode) continue
      total += toDisplay({ [fxCode]: tx.outcome })
    }

    return total / LOOKBACK_MONTHS
  }, [transactions, toDisplay, instCodeMap, excludedTagIds])

  // === Средний доход за LOOKBACK_MONTHS полных месяцев (без текущего неполного) ===
  const avgMonthlyIncome = useMemo(() => {
    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - LOOKBACK_MONTHS,
      1
    )
    const startStr = startDate.toISOString().slice(0, 10)
    const endStr = endDate.toISOString().slice(0, 10)

    let total = 0
    for (const tx of transactions) {
      if (tx.deleted) continue
      if (tx.date < startStr || tx.date >= endStr) continue
      if (tx.income <= 0) continue
      if (tx.income > 0 && tx.outcome > 0) continue
      if (isExcluded(tx.tag)) continue
      const fxCode = instCodeMap[tx.incomeInstrument]
      if (!fxCode) continue
      total += toDisplay({ [fxCode]: tx.income })
    }
    return total / LOOKBACK_MONTHS
  }, [transactions, toDisplay, instCodeMap, excludedTagIds])

  // === Метрики ===
  const runwayMonths =
    avgMonthlyExpense > 0 ? liquidAssets / avgMonthlyExpense : 0

  // === Savings rate: actual transfers to savings accounts ===
  // Old formula (income - expense) was wrong — renovation expenses made it negative.
  // Correct: sum transfers TO off-budget (savings) accounts / income.
  const actualMonthlySavings = useMemo(() => {
    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const startDate = new Date(now.getFullYear(), now.getMonth() - LOOKBACK_MONTHS, 1)
    const startStr = startDate.toISOString().slice(0, 10)
    const endStr = endDate.toISOString().slice(0, 10)

    // Off-budget account IDs (savings/investments)
    const offBudgetIds = new Set(
      savingsAccounts.filter(a => !a.archive).map(a => a.id)
    )

    let totalSaved = 0
    for (const tx of transactions) {
      if (tx.deleted) continue
      if (tx.date < startStr || tx.date >= endStr) continue
      // Transfer TO off-budget = saving
      if (tx.income > 0 && tx.outcome > 0 && offBudgetIds.has(tx.incomeAccount)) {
        totalSaved += tx.income
      }
    }
    return totalSaved / LOOKBACK_MONTHS
  }, [transactions, savingsAccounts])

  const savingsRate =
    avgMonthlyIncome > 0
      ? Math.min(1, Math.max(0, actualMonthlySavings / avgMonthlyIncome))
      : 0

  const emergencyTarget = avgMonthlyExpense * EMERGENCY_FUND_MONTHS
  const emergencyCurrent = Math.min(liquidAssets, emergencyTarget)
  const emergencyPct = Math.min(100, (emergencyCurrent / emergencyTarget) * 100)

  const fireTarget = avgMonthlyExpense * SAFE_WITHDRAWAL_MONTHS
  const fireCurrent = liquidAssets
  const firePct = Math.min(100, (fireCurrent / fireTarget) * 100)

  // === Hero: Savings Rate как ключевой показатель ===
  // По ресерчу («Designing for Financial Anxiety») главная метрика должна
  // быть позитивной и аспирационной, а не формировать чувство вины.
  // Savings rate растёт в процентах — его приятно смотреть.
  const savingsRatePct = Math.round(savingsRate * 100)

  return (
    <Paper sx={{ p: 3 }}>
      {/* HERO: Savings Rate */}
      <Tooltip
        arrow
        placement="top"
        title="Реальные переводы на сберегательные счета / доход. Считается по фактическим пополнениям Инвест копилки и других off-budget счетов. FIRE: 10% мин, 25% комфорт, 50%+ агрессивный."
      >
        <Box sx={{ mb: 3, cursor: 'help' }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
          >
            Норма накоплений
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color:
                savingsRatePct >= 25
                  ? theme.palette.success.main
                  : savingsRatePct >= 10
                  ? theme.palette.warning.main
                  : theme.palette.text.primary,
              lineHeight: 1.1,
              mt: 0.5,
            }}
          >
            {savingsRatePct}%
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            из дохода {formatMoney(Math.round(avgMonthlyIncome), undefined, 0)} откладывается{' '}
            {formatMoney(Math.round(actualMonthlySavings), undefined, 0)}/мес на сбер. счета
            {savingsRatePct < 25 && ' · цель 25%+'}
          </Typography>
        </Box>
      </Tooltip>

      {/* Метрики 2x2 — позитивный каркас */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        <MetricCard
          label="Ликвидные активы"
          value={formatMoney(Math.round(liquidAssets), undefined, 0)}
          hint="наличные и вклады"
          color={theme.palette.success.main}
          tooltip="Деньги, которые можно потратить быстро: остатки на счетах и депозитах. Без учёта ипотеки, недвижимости и кредитных обязательств."
        />
        <MetricCard
          label="Runway"
          value={
            runwayMonths >= 100
              ? '∞'
              : runwayMonths >= 1
              ? `${runwayMonths.toFixed(1)} мес`
              : `${Math.round(runwayMonths * 30)} дн`
          }
          hint={`при расходе ${formatMoney(Math.round(avgMonthlyExpense), undefined, 0)}/мес`}
          color={
            runwayMonths >= 6
              ? theme.palette.success.main
              : runwayMonths >= 3
              ? theme.palette.warning.main
              : theme.palette.text.primary
          }
          tooltip="Сколько месяцев ты проживёшь, если завтра пропадёт доход. Считается как ликвидные активы ÷ средний месячный расход за последние 3 мес. Норма — 6+ мес (подушка безопасности)."
        />
        <MetricCard
          label="Средний доход"
          value={`${formatMoney(Math.round(avgMonthlyIncome), undefined, 0)}/мес`}
          hint={`за ${LOOKBACK_MONTHS} мес`}
          tooltip="Суммарный доход за последние 3 полных месяца, делённый на 3. Без учёта переводов между своими счетами. Используется для расчёта savings rate."
        />
        <MetricCard
          label="Обязательства"
          value={`−${formatMoney(Math.round(debts), undefined, 0)}`}
          hint="ипотека, кредиты"
          color={theme.palette.text.secondary}
          tooltip="Сумма всех отрицательных балансов: ипотека, автокредиты, кредитки в минусе. Это долгосрочные обязательства — они не вычитаются из ликвидных активов, потому что тебе не нужно платить их все завтра."
        />
      </Box>

      {/* Цели с прогресс-барами */}
      <Stack spacing={2.5}>
        {/* Подушка */}
        <GoalRow
          icon="🛡️"
          label="Подушка безопасности"
          current={emergencyCurrent}
          target={emergencyTarget}
          pct={emergencyPct}
          subtitle={`${EMERGENCY_FUND_MONTHS} месяцев расходов`}
          color={theme.palette.info.main}
          tooltip="Фонд «чёрного дня» на случай потери дохода: болезнь, увольнение, срочные расходы. Классическое правило — 3–6 месяцев обычных трат в ликвидных активах. Источник: The Millionaire Next Door, подтверждено NerdWallet."
        />

        {/* FIRE */}
        <GoalRow
          icon="🔥"
          label="Финансовая независимость (FIRE)"
          current={fireCurrent}
          target={fireTarget}
          pct={firePct}
          subtitle={`${FIRE_MULTIPLIER}× годовых расходов — правило 4%`}
          color={theme.palette.secondary.main}
          tooltip="Капитал, который покрывает годовые расходы при доходности ~4% в год (правило 4% из Trinity Study). Когда достигнешь этой суммы — работа становится опциональной, можно жить на доход с капитала."
        />
      </Stack>

    </Paper>
  )
}

function MetricCard(props: {
  label: string
  value: string
  hint?: string
  color?: string
  tooltip?: string
}) {
  const { label, value, hint, color, tooltip } = props
  return (
    <Tooltip
      title={tooltip || ''}
      placement="top"
      arrow
      disableHoverListener={!tooltip}
    >
      <Box
        sx={{
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 2,
          cursor: tooltip ? 'help' : 'default',
          transition: 'background 0.2s',
          '&:hover': tooltip ? { bgcolor: 'action.selected' } : {},
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}
        >
          {label}
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, mt: 0.3, color: color || 'text.primary' }}
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
    </Tooltip>
  )
}

function GoalRow(props: {
  icon: string
  label: string
  subtitle: string
  current: number
  target: number
  pct: number
  color: string
  tooltip?: string
}) {
  const { icon, label, subtitle, current, target, pct, color, tooltip } = props
  const theme = useAppTheme()
  const remaining = Math.max(0, target - current)

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          mb: 0.5,
        }}
      >
        <Tooltip title={tooltip || ''} placement="top" arrow disableHoverListener={!tooltip}>
          <Box sx={{ cursor: tooltip ? 'help' : 'default' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {icon} {label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
        </Tooltip>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatMoney(Math.round(current), undefined, 0)} /{' '}
            {formatMoney(Math.round(target), undefined, 0)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {pct.toFixed(0)}% • осталось{' '}
            {formatMoney(Math.round(remaining), undefined, 0)}
          </Typography>
        </Box>
      </Box>
      <Tooltip
        title={`${pct.toFixed(1)}% от цели`}
        placement="top"
        arrow
      >
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 10,
            borderRadius: 5,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 5,
              bgcolor: color,
            },
          }}
        />
      </Tooltip>
    </Box>
  )
}
