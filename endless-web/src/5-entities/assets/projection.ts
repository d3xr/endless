/**
 * Project asset values into the future using phase-based growth curves.
 *
 * Real estate: compound growth with declining rate (boom → normalization → inflation).
 * Cars: step-decay depreciation (steep early → flattening → floor).
 * Loans: linear paydown to 0 by loanEndDate or matched from ZenMoney balance.
 */
import { RealAsset, ProjectedAsset, NetWorthPoint } from './types'

/** Project a single asset month-by-month for `months` into the future. */
export function projectAsset(
  asset: RealAsset,
  months: number,
  now = new Date(),
  currentLoanBalance = 0,
): ProjectedAsset[] {
  const results: ProjectedAsset[] = []
  let value = asset.currentValue

  // Build monthly rate schedule from phases
  const monthlyRates = buildMonthlyRates(asset.growthPhases, months)

  // Loan schedule: linear paydown
  const loanMonths = asset.loanEndDate
    ? monthsBetween(now, new Date(asset.loanEndDate))
    : 0
  const loanPayPerMonth = loanMonths > 0
    ? Math.abs(currentLoanBalance) / loanMonths
    : 0

  let loan = currentLoanBalance // negative number

  for (let m = 0; m <= months; m++) {
    const d = new Date(now)
    d.setMonth(d.getMonth() + m)
    const dateStr = d.toISOString().slice(0, 10)

    results.push({
      date: dateStr,
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.type,
      emoji: asset.emoji,
      grossValue: Math.round(value),
      loanBalance: Math.round(loan),
      equity: Math.round(value + loan), // loan is negative
    })

    // Apply monthly growth/depreciation
    if (m < months) {
      const rate = monthlyRates[m] || 0
      value *= (1 + rate)

      // Floor for cars: don't go below 15% of purchase price (realistic residual)
      if (asset.type === 'car') {
        const floor = asset.purchasePrice * 0.15
        if (value < floor) value = floor
      }

      // Loan paydown
      if (loan < 0 && loanMonths > 0) {
        loan = Math.min(0, loan + loanPayPerMonth)
      }
    }
  }

  return results
}

/** Build an array of monthly growth rates from phase definitions. */
function buildMonthlyRates(phases: RealAsset['growthPhases'], totalMonths: number): number[] {
  const rates: number[] = []
  let monthsUsed = 0

  for (const phase of phases) {
    const phaseMonths = phase.years * 12
    const monthlyRate = Math.pow(1 + phase.rate, 1 / 12) - 1
    for (let i = 0; i < phaseMonths && monthsUsed < totalMonths; i++) {
      rates.push(monthlyRate)
      monthsUsed++
    }
  }

  // Fill remaining with last phase's rate
  const lastRate = phases.length > 0
    ? Math.pow(1 + phases[phases.length - 1].rate, 1 / 12) - 1
    : 0
  while (rates.length < totalMonths) {
    rates.push(lastRate)
  }

  return rates
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

/** Combine multiple asset projections + liquid savings into net worth timeline. */
export function buildNetWorthTimeline(
  projections: ProjectedAsset[][],
  liquidByMonth: { date: string; value: number }[],
  months: number,
): NetWorthPoint[] {
  const timeline: NetWorthPoint[] = []

  for (let m = 0; m <= months; m++) {
    let realEstate = 0
    let vehicle = 0
    let other = 0
    let date = ''

    for (const proj of projections) {
      if (m >= proj.length) continue
      const p = proj[m]
      date = p.date
      if (p.assetType === 'apartment' || p.assetType === 'house') {
        realEstate += p.equity
      } else if (p.assetType === 'car') {
        vehicle += p.equity
      } else {
        other += p.equity
      }
    }

    const liquid = liquidByMonth[m]?.value ?? liquidByMonth[liquidByMonth.length - 1]?.value ?? 0

    timeline.push({
      date: date || new Date().toISOString().slice(0, 10),
      liquid,
      realEstate,
      vehicle,
      other,
      total: liquid + realEstate + vehicle + other,
    })
  }

  return timeline
}
