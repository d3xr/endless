export type AssetType = 'apartment' | 'house' | 'car' | 'investment' | 'other'

export interface RealAsset {
  id: string
  type: AssetType
  name: string
  emoji: string
  purchasePrice: number
  purchaseDate: string          // YYYY-MM-DD
  currentValue: number          // user's latest market estimate
  currentValueDate: string      // when they estimated
  sqm?: number                  // for real estate
  /** Phase-based annual growth rates (for real estate) or depreciation (for cars).
   *  Each phase: [yearsFromNow, annualRate]. Applied in order. */
  growthPhases: GrowthPhase[]
  /** ZenMoney account ID for linked loan (ипотека / автокредит). */
  linkedLoanAccountId?: string
  /** If loan ends at a known date, set here. */
  loanEndDate?: string
}

export interface GrowthPhase {
  /** How many years this phase lasts from the start of projection. */
  years: number
  /** Annual rate: +0.12 = +12% growth, -0.10 = -10% depreciation. */
  rate: number
}

export interface ProjectedAsset {
  date: string          // YYYY-MM-DD (monthly)
  assetId: string
  assetName: string
  assetType: AssetType
  emoji: string
  grossValue: number    // market value
  loanBalance: number   // outstanding loan (negative or 0)
  equity: number        // grossValue + loanBalance
}

export interface NetWorthPoint {
  date: string
  liquid: number        // savings accounts
  realEstate: number    // apartments + houses equity
  vehicle: number       // car equity
  other: number         // other assets equity
  total: number
}
