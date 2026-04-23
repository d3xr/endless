import { useMemo } from 'react'
import { trModel } from '5-entities/transaction'
import { tagModel } from '5-entities/tag'
import { accountModel } from '5-entities/account'
import { detectRecurrenceRules, ruleMonthlyAmount } from './detect'
import { projectEvents, nextSalaryEvent, creditsBefore } from './project'

/** Detected recurrence rules (cached via useMemo on transactions/tags reference). */
export function useRecurrenceRules() {
  const transactions = trModel.useTransactionsHistory()
  const tags = tagModel.usePopulatedTags()
  const accounts = accountModel.useAccountList()

  return useMemo(() => {
    const tagName = (id: string): string => {
      const t = tags[id]
      if (!t) return id
      const name = t.name.trim()
      if (t.parent) {
        const p = tags[t.parent]
        if (p) return `${p.name.trim()} > ${name}`
      }
      return name
    }

    const wbWalletIds = new Set<string>()
    for (const a of accounts) {
      if (/wb/i.test(a.title || '')) wbWalletIds.add(a.id)
    }

    return detectRecurrenceRules(transactions, {
      tagName,
      isWbWalletAccount: id => wbWalletIds.has(id),
      // Only look at the last 4 months — user changed jobs recently,
      // longer window mixes old & new salaries and gives wrong medians.
      lookbackMonths: 4,
    })
  }, [transactions, tags, accounts])
}

/** Future events projected from active rules. */
export function useProjectedEvents(horizonDays = 30) {
  const rules = useRecurrenceRules()
  const transactions = trModel.useTransactionsHistory()
  return useMemo(
    () => projectEvents(rules, { horizonDays, transactions }),
    [rules, transactions, horizonDays]
  )
}

/** "Денег до ЗП осталось" — sum of positive in-budget accounts minus credits before salary. */
export function usePlannedHeadline() {
  const rules = useRecurrenceRules()
  const events = useProjectedEvents(60)
  const inBudgetAccounts = accountModel.useInBudgetAccounts()

  return useMemo(() => {
    // Cash on hand (positive in-budget accounts — excludes savings and loans)
    const cashOnHand = inBudgetAccounts
      .filter(a => !a.archive && a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0)

    const next = nextSalaryEvent(events)
    const creditsTillSalary = next ? creditsBefore(events, next.date) : 0

    // Per-cadence monthly equivalent (biweekly → × 2.17, etc.)
    const monthlyIncome = rules
      .filter(r => r.type === 'income' && r.isSalary)
      .reduce((s, r) => s + ruleMonthlyAmount(r), 0)
    const monthlyCredits = rules
      .filter(r => r.isCredit)
      .reduce((s, r) => s + ruleMonthlyAmount(r), 0)

    const creditsCount = rules.filter(r => r.isCredit).length

    return {
      cashOnHand,
      nextSalary: next,
      creditsTillSalary,
      cashAfterCredits: cashOnHand - creditsTillSalary,
      monthlyIncome,
      monthlyCredits,
      creditsCount,
    }
  }, [rules, events, inBudgetAccounts])
}
