import { useMemo } from 'react'
import { accountModel } from '5-entities/account'
import { RealAsset, ProjectedAsset, NetWorthPoint } from './types'
import { projectAsset, buildNetWorthTimeline } from './projection'
import { DEFAULT_ASSETS } from './defaults'
import { AccountType } from '6-shared/types'
import { ScenarioKey, SCENARIOS, ScenarioParams } from './scenarios'

const STORAGE_KEY = 'endless_assets'
const SALARY_KEY = 'endless_current_salary'
const PROJECTION_MONTHS = 120
/** Fallback salary when no persona has been loaded. Deliberately generic —
 *  a mid-market office worker's net. Per-persona salary is injected into
 *  localStorage by loadDemoData(). */
const FALLBACK_SALARY = 120_000

function loadAssets(): RealAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_ASSETS
}

function loadCurrentSalary(): number {
  try {
    const raw = localStorage.getItem(SALARY_KEY)
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
  } catch {}
  return FALLBACK_SALARY
}

export function useAssets(): RealAsset[] {
  return useMemo(() => loadAssets(), [])
}

/** Apply scenario growth rates to an asset's phases. */
function applyScenarioToAsset(asset: RealAsset, scenario: ScenarioParams): RealAsset {
  let phases = asset.growthPhases
  if (asset.type === 'apartment' && scenario.apartmentGrowth.length) {
    phases = scenario.apartmentGrowth.map(([years, rate]) => ({ years, rate }))
  } else if (asset.type === 'house' && scenario.houseGrowth.length) {
    phases = scenario.houseGrowth.map(([years, rate]) => ({ years, rate }))
  } else if (asset.type === 'car' && scenario.carDepreciation.length) {
    phases = scenario.carDepreciation.map(([years, rate]) => ({ years, rate }))
  }
  return { ...asset, growthPhases: phases }
}

/** Project everything under a single coherent scenario. */
export function useAssetProjections(scenarioKey: ScenarioKey = 'conservative') {
  const baseAssets = useAssets()
  const allAccounts = accountModel.useAccountList()
  const scenario = SCENARIOS[scenarioKey]

  return useMemo(() => {
    const now = new Date()

    // Loan balances from ZenMoney
    const loanBalances = new Map<string, number>()
    for (const acc of allAccounts) {
      if (acc.type === AccountType.Loan || (acc.type === AccountType.Ccard && acc.balance < 0)) {
        loanBalances.set(acc.id, acc.balance)
      }
    }

    // Apply scenario growth rates and project each asset
    const assets = baseAssets.map(a => applyScenarioToAsset(a, scenario))
    const projections: ProjectedAsset[][] = []
    for (const asset of assets) {
      let loanBalance = 0
      if (asset.linkedLoanAccountId) {
        for (const [accId, bal] of loanBalances) {
          if (accId.startsWith(asset.linkedLoanAccountId)) {
            loanBalance = bal
            break
          }
        }
      }
      projections.push(projectAsset(asset, PROJECTION_MONTHS, now, loanBalance))
    }

    // Liquid savings включают:
    //   - все депозиты (deposit): Накопительный Озон/Ббанк, Вклад, Накопит ВТБ
    //   - off-budget checking: Инвест копилка, Брокерский, Saver
    //   - ccard с "кошельковым" названием: WB wallet, Депозит Локо
    //     (это технически "ccard" в ZenMoney, но функционально — сберегательные
    //     с начислением процентов). Берём независимо от inBudget —
    //     у пользователя WB wallet может быть в бюджете, но смысл тот же.
    const SAVINGS_NAME_RE = /wallet|копилк|вклад|депозит|накоп|saver|broker|брокер|инвест/i
    const liquidAccounts = allAccounts.filter(a => {
      if (a.archive) return false
      if (a.type === AccountType.Loan) return false
      if (a.type === AccountType.Debt) return false
      if (a.title?.includes('Endless Data')) return false
      // Любой депозит = сбережение
      if (a.type === AccountType.Deposit) return true
      // Off-budget checking = сбережение (Инвест копилка, Брокерский счёт)
      if (a.type === AccountType.Checking && !a.inBudget) return true
      // Ccard с "сберегательным" названием (WB wallet, Депозит Локо)
      if (a.type === AccountType.Ccard && SAVINGS_NAME_RE.test(a.title)) return true
      return false
    })
    const liquidNow = liquidAccounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0)

    // Current monthly NET salary is persona-dependent and injected into
    // localStorage by loadDemoData(). Falls back to a generic mid-market
    // number when no persona is active.
    const currentSalary = loadCurrentSalary()
    const monthlyReturn = Math.pow(1 + scenario.liquidReturn, 1 / 12) - 1

    const getYearParam = (arr: number[], month: number) => {
      const year = Math.min(Math.floor(month / 12), arr.length - 1)
      return arr[year]
    }

    const liquidByMonth: { date: string; value: number }[] = []
    let portfolio = liquidNow
    for (let m = 0; m <= PROJECTION_MONTHS; m++) {
      const d = new Date(now)
      d.setMonth(d.getMonth() + m)
      liquidByMonth.push({ date: d.toISOString().slice(0, 10), value: Math.round(portfolio) })
      if (m < PROJECTION_MONTHS) {
        const salaryMult = getYearParam(scenario.salaryMultipliers, m)
        const savingsRate = getYearParam(scenario.savingsRateByYear, m)
        const contribution = currentSalary * salaryMult * savingsRate
        portfolio = portfolio * (1 + monthlyReturn) + contribution
      }
    }

    const netWorth = buildNetWorthTimeline(projections, liquidByMonth, PROJECTION_MONTHS)

    const monthlySavings = Math.round(currentSalary * scenario.savingsRateByYear[0])

    return { assets, projections, netWorth, liquidNow, monthlySavings, scenario }
  }, [baseAssets, allAccounts, scenario, scenarioKey])
}
