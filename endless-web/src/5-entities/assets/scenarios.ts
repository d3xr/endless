/**
 * 3 macro scenarios affecting ALL projection parameters at once.
 *
 * Each scenario is a coherent story, not independent knobs:
 *   - Negative: global/RU recession, stagnation, low savings discipline
 *   - Conservative: current trajectory, moderate growth
 *   - Optimistic: strong economy, career growth, high discipline
 */

export type ScenarioKey = 'negative' | 'conservative' | 'optimistic'

export interface ScenarioParams {
  label: string
  emoji: string
  color: string
  description: string
  /** Investment return on liquid savings (annual nominal) */
  liquidReturn: number
  /** Salary growth multipliers by year (cumulative from year 0) */
  salaryMultipliers: number[]
  /** Savings rate by year */
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
    // Потеря работы в год 2, долгое восстановление, второй удар на 8-м году
    salaryMultipliers: [
      1.00, 1.05, 1.08, 0.92,  // год 3: потеря работы на полгода → откат
      0.95, 1.05, 1.15, 1.20,  // медленный подъём без карьерного роста
      1.05, 1.15, 1.30,        // год 8: второе сокращение, восстановление
    ],
    // Depression arc: в тяжёлые годы копить не получается ВООБЩЕ
    savingsRateByYear: [
      0.15, 0.08, 0.02, 0.00, 0.03, // 2026-2030: провал, депрессия, 0% сбережений
      0.05, 0.08, 0.05, 0.03, 0.07, 0.10, // 2031-2036: пытаешься вернуться, но идёт тяжело
    ],
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
    salaryMultipliers: [
      1.00, 1.06, 1.12, 1.19, 1.26, // рост на инфляцию + 2% реальных
      1.38, 1.50, 1.60, 1.72, 1.85, 2.00,
    ],
    savingsRateByYear: [
      0.25, 0.25, 0.25, 0.26, 0.26,
      0.27, 0.27, 0.28, 0.28, 0.28, 0.28,
    ],
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
    salaryMultipliers: [
      1.00, 1.10, 1.22, 1.35, 1.89,  // быстрый карьерный рывок + бонусы
      2.08, 2.29, 2.52, 3.02, 3.32, 3.80,
    ],
    savingsRateByYear: [
      0.30, 0.30, 0.32, 0.33, 0.35,
      0.35, 0.37, 0.38, 0.40, 0.40, 0.40,
    ],
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
