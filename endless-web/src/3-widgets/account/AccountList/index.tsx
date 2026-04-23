import React, { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Collapse, List, ListItemButton, FormControlLabel, Switch, Box } from '@mui/material'
import { Tooltip } from '6-shared/ui/Tooltip'
import { useToggle } from '6-shared/hooks/useToggle'
import { TFxAmount, AccountType } from '6-shared/types'
import { addFxAmount } from '6-shared/helpers/money'
import { toISOMonth } from '6-shared/helpers/date'

import { accountModel, TAccountPopulated } from '5-entities/account'
import {
  DisplayAmount,
  displayCurrency,
} from '5-entities/currency/displayCurrency'
import { Account, Subheader } from './components'

/**
 * Hide debt/loan accounts from the primary balance line. Per research:
 * surfacing big negative numbers as the first thing a user sees triggers
 * loss aversion and shame — antipattern for financial anxiety UX.
 * Loans still exist in a collapsible "Долги" section for transparency.
 */
function isLiability(acc: TAccountPopulated): boolean {
  if (acc.type === AccountType.Loan) return true
  // Credit card that is currently drawn down (negative balance)
  if (acc.type === AccountType.Ccard && acc.balance < 0) return true
  return false
}

export default function AccountList({ className = '' }) {
  const { t } = useTranslation('accounts')
  const [hideEmpty, setHideEmpty] = useState(true)
  const [liabilitiesOpen, toggleLiabilities] = useToggle()
  const toDisplay = displayCurrency.useToDisplay(toISOMonth(new Date()))

  const inBudgetRaw = accountModel
    .useInBudgetAccounts()
    .sort(
      (a, b) =>
        toDisplay({ [b.fxCode]: b.balance }) -
        toDisplay({ [a.fxCode]: a.balance })
    )
  const savings = accountModel
    .useSavingAccounts()
    .sort(
      (a, b) =>
        toDisplay({ [b.fxCode]: b.balance }) -
        toDisplay({ [a.fxCode]: a.balance })
    )

  // Split inBudget into assets (positive liquid money) and liabilities (loans / credit cards in minus)
  const assets = inBudgetRaw.filter(a => !isLiability(a))
  const liabilitiesFromBudget = inBudgetRaw.filter(isLiability)
  const liabilitiesFromSavings = savings.filter(isLiability)
  const liabilities = [...liabilitiesFromBudget, ...liabilitiesFromSavings]
  const pureSavings = savings.filter(a => !isLiability(a))

  const filterEmpty = (accs: TAccountPopulated[]) =>
    hideEmpty ? accs.filter(a => Math.abs(a.balance) >= 1) : accs

  const assetsActive = filterEmpty(assets.filter(a => !a.archive))
  const assetsArchived = assets.filter(a => a.archive)

  const savingsActive = filterEmpty(pureSavings.filter(a => !a.archive))
  const savingsArchived = pureSavings.filter(a => a.archive)

  return (
    <div className={className}>
      <Box sx={{ px: 1, pt: 0.5 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={hideEmpty}
              onChange={() => setHideEmpty(!hideEmpty)}
            />
          }
          label={<span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Скрыть пустые</span>}
          sx={{ ml: 0 }}
        />
      </Box>

      <List dense>
        <Subheader
          name={
            <Tooltip title={t('inBalanceDescription')}>
              <span>{t('inBalance')}</span>
            </Tooltip>
          }
          amount={getTotal(assets)}
        />
        {assetsActive.map(acc => (
          <Account key={acc.id} account={acc} />
        ))}
        <ArchivedList accs={assetsArchived} />
      </List>

      {pureSavings.length > 0 && (
        <List dense>
          <Subheader
            name={
              <Tooltip title={t('otherDescription')}>
                <span>{t('other')}</span>
              </Tooltip>
            }
            amount={getTotal(pureSavings)}
          />
          {savingsActive.map(acc => (
            <Account key={acc.id} account={acc} />
          ))}
          <ArchivedList accs={savingsArchived} />
        </List>
      )}

      {/* Liabilities: collapsed by default — see research "Designing for Financial Anxiety" */}
      {liabilities.length > 0 && (
        <List dense>
          <Collapse in={liabilitiesOpen} unmountOnExit>
            <Subheader
              name={<span style={{ opacity: 0.7 }}>Обязательства</span>}
              amount={getTotal(liabilities)}
            />
            {liabilities.map(acc => (
              <Account key={acc.id} account={acc} />
            ))}
          </Collapse>
          <ListItemButton
            sx={{
              typography: 'body2',
              borderRadius: 1,
              color: 'text.secondary',
              opacity: 0.7,
            }}
            onClick={toggleLiabilities}
          >
            {liabilitiesOpen
              ? 'Скрыть обязательства'
              : `Обязательства (${liabilities.length})`}
          </ListItemButton>
        </List>
      )}
    </div>
  )
}

const ArchivedList: FC<{ accs: TAccountPopulated[] }> = props => {
  const { t } = useTranslation('accounts')
  const { accs } = props
  const month = toISOMonth(new Date())
  const toDisplay = displayCurrency.useToDisplay(month)
  const [visible, toggleVisibility] = useToggle()
  if (!accs.length) return null

  const sum = getTotal(accs)
  const hasArchivedMoney = Boolean(toDisplay(sum)) // It can be too small to show

  return (
    <>
      <Collapse in={visible} unmountOnExit>
        <List dense>
          {accs.map(acc => (
            <Account key={acc.id} account={acc} />
          ))}
        </List>
      </Collapse>
      <ListItemButton
        sx={{ typography: 'body2', borderRadius: 1, color: 'info.main' }}
        onClick={toggleVisibility}
      >
        {visible ? (
          <span>{t('hideArchived')}</span>
        ) : (
          <span>
            {t('archivedAccounts', { count: accs.length })}{' '}
            {hasArchivedMoney && (
              <DisplayAmount
                month={month}
                value={sum}
                decMode="ifOnly"
                noShade
              />
            )}
          </span>
        )}
      </ListItemButton>
    </>
  )
}

function getTotal(accs: TAccountPopulated[]): TFxAmount {
  return accs.reduce(
    (sum, a) => addFxAmount(sum, { [a.fxCode]: a.balance }),
    {}
  )
}
