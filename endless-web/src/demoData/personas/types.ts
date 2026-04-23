/**
 * Persona model — a complete fictional person used to drive demo data
 * generation. Everything a human reader needs to understand *who* this
 * person is lives in the bio block; everything the transaction generator
 * needs lives in the finance block.
 *
 * None of these people exist. All names, employers, and addresses are
 * invented. Any resemblance to real individuals is accidental.
 */

import type { RealAsset } from '5-entities/assets/types'

export type PersonaId =
  | 'marina-cashier'
  | 'alexey-accountant'
  | 'olga-office'
  | 'dmitry-it'
  | 'nikolay-business'

export type WealthTier = 'low' | 'middle-low' | 'middle' | 'upper-middle' | 'high'

export interface PersonaBio {
  id: PersonaId
  firstName: string
  lastName: string
  age: number
  gender: 'f' | 'm'
  city: string
  cityPopulationTier: 'million-plus' | 'regional-center' | 'small-town'
  emoji: string

  headline: string
  wealthTier: WealthTier
  wealthTierLabel: string

  occupation: {
    title: string
    employer: string
    industry: string
    yearsInRole: number
    educationLevel: 'secondary' | 'college' | 'university' | 'university-plus'
  }

  family: {
    status: 'single' | 'relationship' | 'married' | 'divorced'
    kids: Array<{ name: string; age: number }>
    pets?: string[]
    livesWith?: string
  }

  personality: string
  hobbies: string[]
  weekend: string
  entertainment: string
  financialHabits: string
  painPoints: string
  backstory: string
}

export interface MonthlyBudget {
  rent: number
  utilities: number
  groceries: number
  transport: number
  cafesAndRestaurants: number
  entertainment: number
  subscriptions: number
  clothing: number
  health: number
  kids?: number
  parents?: number
  savings: number
  fuelIfCar?: number
  carMaintenance?: number
  miscellaneous: number
}

/** One persona's behavioural trajectory under a single macro scenario.
 *  Year-indexed arrays must have the same length as the macro scenario
 *  (11 entries: year 0 through year 10). */
export interface PersonaBehavioralScenario {
  /** Salary growth multipliers, cumulative from year 0 (1.00 = baseline). */
  salaryMultipliers: number[]
  /** Fraction of net income that goes to savings each year (0..1). */
  savingsRateByYear: number[]
}

/** Three coherent life-trajectories for a given persona. */
export interface PersonaBehavioralScenarios {
  negative: PersonaBehavioralScenario
  conservative: PersonaBehavioralScenario
  optimistic: PersonaBehavioralScenario
}

export interface PersonaFinance {
  currency: 'RUB'
  monthStartDay: 1

  income: {
    salaryBase: number
    salaryVariancePct: number
    advancePaymentPct: number
    bonusMonths: number[]
    bonusAmount: [number, number]
    sideIncome?: {
      kind: string
      averageMonthly: number
      frequencyPerYear: number
    }
    annualGrowthPct: number
  }

  housing:
    | { kind: 'rent'; amount: number }
    | { kind: 'mortgage'; amount: number; yearsLeft: number }
    | { kind: 'own'; amount: 0 }

  car?: {
    make: string
    model: string
    monthlyFuel: number
    maintenance: number
  }

  accounts: Array<{
    key: string
    title: string
    type: 'checking' | 'ccard' | 'cash' | 'deposit' | 'debt'
    bank?: string
    openingBalance: number
  }>

  budget: MonthlyBudget

  lifeEvents: Array<{
    year: number
    month: number
    kind: string
    description: string
    amount?: number
    incomePct?: number
    expensePct?: number
  }>

  /** Physical assets (real estate, vehicles) owned by this persona.
   *  Used by the Savings/Capital projection page. Empty array = no
   *  significant physical assets (e.g. low-income renter). */
  assets: RealAsset[]

  /** Per-persona career trajectory and savings discipline under each of
   *  the three macro scenarios. Marco-economics (inflation, real-estate
   *  growth, currency) stay common across personas in scenarios.ts; this
   *  is where individual career shape lives. */
  behavioralScenarios: PersonaBehavioralScenarios
}

export interface Persona {
  bio: PersonaBio
  finance: PersonaFinance
}
