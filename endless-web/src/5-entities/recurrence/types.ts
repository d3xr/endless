import { TISODate, TTagId, TTransactionId } from '6-shared/types'

export type Cadence =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'custom'

export interface RecurrenceRule {
  id: string
  name: string
  type: 'income' | 'expense'
  payeeKey: string
  samplePayee: string
  amount: number
  amountMin: number
  amountMax: number
  amountVariance: number
  cadence: Cadence
  avgGapDays: number
  anchorDay: number
  firstSeen: TISODate
  lastSeen: TISODate
  occurrences: number
  confidence: number
  isSalary: boolean
  isCredit: boolean
  category: string | null
  categoryId: TTagId | null
  matchedTxIds: TTransactionId[]
  active: boolean
  /** Merged from N salary components */
  mergedFrom?: number
}

export interface ProjectedEvent {
  id: string
  ruleId: string
  date: TISODate
  amount: number
  type: 'income' | 'expense'
  name: string
  category: string | null
  confidence: number
  isSalary: boolean
  isCredit: boolean
  /** A matching real transaction was found — this projection is realized */
  realized: boolean
  realizedTxId?: TTransactionId
}
