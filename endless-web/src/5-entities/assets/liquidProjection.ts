/**
 * Liquid savings projection with:
 *   - Salary growth (inflation + career progression)
 *   - SMarT-style savings rate escalation (15% → 30% over 10 years)
 *   - 3 return scenarios (pessimistic / base / optimistic)
 *   - Month-by-month iteration (no closed-form possible with variable inputs)
 *
 * Sources:
 *   - SMarT: Thaler & Benartzi 2004, JPE
 *   - Returns: NYU Stern Damodaran, S&P 500 historical
 *   - Salary: Glassdoor Russia, adjusted for Senior PM trajectory
 */

export interface LiquidScenario {
  label: string
  color: string
  /** Monthly snapshots: {date, value} */
  points: { date: string; value: number }[]
}

export interface LiquidProjectionResult {
  scenarios: LiquidScenario[]
  /** Current monthly savings */
  currentMonthlySavings: number
  /** Current salary (if computed) */
  currentSalary: number
}

// === Salary growth model ===
// Year-by-year nominal salary multipliers (cumulative from year 0).
// Based on: 8% inflation + career progression + one role transition at year 4.
const SALARY_MULTIPLIERS = [
  1.000, // year 0 (now)
  1.075, // year 1: +7.5% (inflation + modest real)
  1.150, // year 2: +7%
  1.238, // year 3: +7.6%
  1.688, // year 4: +36% (Head of Product transition)
  1.813, // year 5: +7.4%
  1.963, // year 6: +8.3%
  2.125, // year 7: +8.3%
  2.475, // year 8: +16.5% (Director/VP transition)
  2.663, // year 9: +7.6%
  3.000, // year 10: +12.7% (CPO / stabilization)
]

// === Savings rate (user already at 30%, conservative projection 25→30%) ===
const SAVINGS_RATE_BY_YEAR = [
  0.25, // year 0: conservative start (user is at 30%, hedge for fluctuations)
  0.25, // year 1
  0.26, // year 2
  0.27, // year 3
  0.27, // year 4
  0.28, // year 5
  0.28, // year 6
  0.29, // year 7
  0.29, // year 8
  0.30, // year 9
  0.30, // year 10
]

// === Return scenarios (annual nominal, RUB-based) ===
const SCENARIOS = [
  { label: 'Пессимист (3%)', annualReturn: 0.03, color: '#ef5350' },  // Bonds/deposits
  { label: 'База (8%)',       annualReturn: 0.08, color: '#66bb6a' },  // 60/40 portfolio
  { label: 'Оптимист (12%)',  annualReturn: 0.12, color: '#42a5f5' },  // 100% equities
]

function getYearParam(yearArray: number[], month: number): number {
  const year = Math.min(Math.floor(month / 12), yearArray.length - 1)
  return yearArray[year]
}

/**
 * Project liquid savings for `months` forward under 3 scenarios.
 * @param initialPortfolio Current liquid savings balance
 * @param currentMonthlySalary Current gross monthly salary
 * @param months How many months to project
 */
export function projectLiquidSavings(
  initialPortfolio: number,
  currentMonthlySalary: number,
  months: number,
  now = new Date(),
): LiquidProjectionResult {
  const scenarios: LiquidScenario[] = SCENARIOS.map(scenario => {
    const monthlyReturn = Math.pow(1 + scenario.annualReturn, 1 / 12) - 1
    let portfolio = initialPortfolio
    const points: { date: string; value: number }[] = []

    for (let m = 0; m <= months; m++) {
      const d = new Date(now)
      d.setMonth(d.getMonth() + m)

      points.push({
        date: d.toISOString().slice(0, 10),
        value: Math.round(portfolio),
      })

      if (m < months) {
        // Salary for this month (with career growth)
        const salaryMult = getYearParam(SALARY_MULTIPLIERS, m)
        const salary = currentMonthlySalary * salaryMult

        // Savings rate for this month (SMarT escalation)
        const savingsRate = getYearParam(SAVINGS_RATE_BY_YEAR, m)

        // Monthly contribution
        const contribution = salary * savingsRate

        // Compound: portfolio grows + new contribution
        portfolio = portfolio * (1 + monthlyReturn) + contribution
      }
    }

    return { label: scenario.label, color: scenario.color, points }
  })

  const currentSavingsRate = SAVINGS_RATE_BY_YEAR[0]
  const currentMonthlySavings = Math.round(currentMonthlySalary * currentSavingsRate)

  return {
    scenarios,
    currentMonthlySavings,
    currentSalary: currentMonthlySalary,
  }
}
