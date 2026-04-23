/**
 * 3 macro scenarios affecting ALL projection parameters at once.
 *
 * Each scenario is a coherent story, not independent knobs:
 *   - Negative: global/RU recession, stagnation, low savings discipline
 *   - Conservative: current trajectory, moderate growth
 *   - Optimistic: strong economy, career growth, high discipline
 *
 * Macro fields (inflation, real-estate growth, car depreciation, FX) apply
 * the same to every persona — the market doesn't care who you are.
 * Behavioural fields (salaryMultipliers, savingsRateByYear) are FALLBACKS
 * used only when no persona is active. When a persona is loaded,
 * loadDemoData() injects the persona's own three-scenario behavioural
 * trajectory (see PersonaBehavioralScenarios in demoData/personas/types.ts)
 * into localStorage and the Savings projection reads it from there.
 */

export type ScenarioKey = 'negative' | 'conservative' | 'optimistic'

export interface ScenarioParams {
  label: string
  emoji: string
  color: string
  description: string
  /** Investment return on liquid savings (annual nominal) */
  liquidReturn: number
  /** FALLBACK salary growth multipliers (year 0 = 1.00). Generic mid-market
   *  shape — overridden per persona when a demo persona is active. */
  salaryMultipliers: number[]
  /** FALLBACK savings rate by year. Generic mid-market shape —
   *  overridden per persona when a demo persona is active. */
  savingsRateByYear: number[]
  /** Real estate growth phases: [years, annualRate][] for apartments */
  apartmentGrowth: [number, number][]
  /** Real estate growth phases for suburban houses */
  houseGrowth: [number, number][]
  /** Car depreciation phases: [years, annualRate][] (negative) */
  carDepreciation: [number, number][]
  /** Annual RUB inflation rate (CPI) */
  inflationRate: number
  /** USD/RUB exchange rate at year 10 (current ~85) */
  rubPerUsdEnd: number
}

/** Current USD/RUB rate (April 2026) */
export const RUB_PER_USD_NOW = 85

export const SCENARIOS: Record<ScenarioKey, ScenarioParams> = {
  negative: {
    label: 'Негативный',
    emoji: '🌧',
    color: '#ef5350',
    description: 'Глубокий кризис + депрессия: потеря работы, выгорание, копить не получается',
    // Инфляция ~12%/год, рынки падают, рубль девальвирует → реально −5%
    liquidReturn: -0.05,
    // Generic mid-market fallback — persona override takes precedence
    salaryMultipliers: [1.00, 1.00, 0.95, 0.93, 0.96, 1.02, 1.10, 1.15, 1.18, 1.22, 1.28],
    savingsRateByYear: [0.10, 0.05, 0.00, 0.00, 0.03, 0.05, 0.08, 0.08, 0.10, 0.10, 0.10],
    apartmentGrowth: [
      [2, 0.00],    // стагнация
      [2, -0.09],   // обвал −25% за 18 мес (как крупные регионы в 2008-2009)
      [2, 0.00],    // дно
      [4, 0.06],    // медленное восстановление
    ],
    houseGrowth: [
      [2, -0.03],   // пригород первым падает
      [2, -0.08],   // глубже города
      [2, -0.02],
      [4, 0.05],
    ],
    carDepreciation: [
      [2, -0.16],   // крутой обвал + дилеры уходят
      [2, -0.14],
      [3, -0.10],
      [3, -0.05],   // стабилизация (перешёл на Toyota)
    ],
    inflationRate: 0.12,   // высокая инфляция в кризис (РФ 2015 была 13%)
    rubPerUsdEnd: 180,     // рубль обвалится до ~180 (как 2014-2022)
  },

  conservative: {
    label: 'Консервативный',
    emoji: '📊',
    color: '#66bb6a',
    description: 'Текущая траектория: стабильная карьера, 25-30% сбережений, умеренные рынки',
    liquidReturn: 0.06,   // 60/40, но с учётом российских рисков
    // Generic mid-market fallback — persona override takes precedence
    salaryMultipliers: [1.00, 1.06, 1.12, 1.19, 1.26, 1.34, 1.43, 1.52, 1.61, 1.70, 1.80],
    savingsRateByYear: [0.15, 0.15, 0.16, 0.16, 0.17, 0.17, 0.18, 0.18, 0.18, 0.19, 0.19],
    apartmentGrowth: [
      [3, 0.06],   // чуть выше инфляции
      [3, 0.05],
      [4, 0.04],
    ],
    houseGrowth: [
      [3, 0.05],
      [3, 0.04],
      [4, 0.03],
    ],
    carDepreciation: [
      [2, -0.12],
      [2, -0.09],
      [3, -0.07],
      [3, -0.05],
    ],
    inflationRate: 0.07,   // умеренная (цель ЦБ 4%, реал 6-8%)
    rubPerUsdEnd: 120,     // медленная девальвация ~3.5%/год
  },

  optimistic: {
    label: 'Оптимистичный',
    emoji: '🚀',
    color: '#42a5f5',
    description: 'Сильная экономика, карьерный рывок, высокая дисциплина, рынки растут',
    liquidReturn: 0.12,   // 100% акции, бычий рынок
    // Generic mid-market fallback — persona override takes precedence
    salaryMultipliers: [1.00, 1.10, 1.22, 1.35, 1.50, 1.68, 1.88, 2.10, 2.35, 2.60, 2.90],
    savingsRateByYear: [0.22, 0.24, 0.26, 0.28, 0.30, 0.32, 0.33, 0.35, 0.35, 0.35, 0.35],
    apartmentGrowth: [
      [3, 0.15],   // бум крупных региональных центров
      [3, 0.10],
      [4, 0.08],
    ],
    houseGrowth: [
      [3, 0.12],
      [3, 0.08],
      [4, 0.06],
    ],
    carDepreciation: [
      [2, -0.10],  // лучше ликвидность китайцев
      [2, -0.08],
      [3, -0.06],
      [3, -0.05],
    ],
    inflationRate: 0.05,   // низкая, близка к цели ЦБ
    rubPerUsdEnd: 95,      // рубль укрепляется (сильная экономика)
  },
}

export const SCENARIO_KEYS: ScenarioKey[] = ['negative', 'conservative', 'optimistic']
