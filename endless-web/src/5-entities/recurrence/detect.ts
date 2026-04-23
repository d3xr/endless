/**
 * Recurrence detection algorithm.
 *
 * Scope (intentionally narrow):
 *   Surfaces SALARY and CREDIT payments only — everything else is noise
 *   for the "Запланировано" view. Shopping/subscriptions/rent/etc. go to
 *   the regular Budget page.
 *
 * Input: array of transactions + helper to resolve tag names
 * Output: array of RecurrenceRule[] where every rule has either
 *         `isSalary === true` or `isCredit === true`.
 *
 * We do NOT merge salary components — "аванс" and "начисление" stay
 * separate so the timeline shows 2 events per month (biweekly ЗП).
 */
import { TTransaction, TTagId } from '6-shared/types'
import { Cadence, RecurrenceRule } from './types'

// Noise blocklist — exact payee substrings (lowercase) that we always drop,
// even if they pass other checks. "Операция" = daily interest on WB wallet,
// "прочее" = catch-all bucket, "уплата процентов" = fractional kopek noise.
const PAYEE_BLOCKLIST = [
  'операция',
  'прочее',
  'уплата процентов',
]

// --- Helpers ---

// Russian month names — salary payees contain "Зарплата за месяц Январь 2026 г."
// and if we don't strip the month, each month becomes a different group.
const RU_MONTHS_RE = /\b(январ[яьи]?|феврал[яьи]?|март[аеу]?|апрел[яьи]?|ма[йяю]|июн[яьи]?|июл[яьи]?|август[аеу]?|сентябр[яьи]?|октябр[яьи]?|ноябр[яьи]?|декабр[яьи]?)\b/gi

function normalizePayee(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[*#№]/g, ' ')
    .replace(/\bсбп\b|\bперевод\b|\bоплата\b|\bпокупка\b|\bсписание\b/gi, ' ')
    .replace(RU_MONTHS_RE, ' ')         // strip month names (salary payees vary monthly)
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function primaryKey(norm: string, n = 3): string {
  const words = norm.split(' ').filter(w => w.length >= 3)
  if (words.length === 0) return norm
  return words.slice(0, n).join(' ')
}

function amountBucket(amt: number): number {
  if (amt < 100) return Math.round(amt / 10) * 10
  if (amt < 1000) return Math.round(amt / 100) * 100
  if (amt < 10000) return Math.round(amt / 500) * 500
  if (amt < 100000) return Math.round(amt / 5000) * 5000
  return Math.round(amt / 25000) * 25000
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function stdev(arr: number[]): number {
  if (arr.length === 0) return 0
  const m = arr.reduce((s, x) => s + x, 0) / arr.length
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length
  return Math.sqrt(v)
}

function classifyCadence(gaps: number[]): { cadence: Cadence; avgGap: number; variance: number } {
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length
  const sd = stdev(gaps)
  const variance = avg > 0 ? sd / avg : 1
  let cadence: Cadence = 'custom'
  if (avg >= 0.5 && avg <= 2) cadence = 'daily'
  else if (avg >= 5 && avg <= 9) cadence = 'weekly'
  else if (avg >= 12 && avg <= 17) cadence = 'biweekly'
  else if (avg >= 25 && avg <= 35) cadence = 'monthly'
  else if (avg >= 50 && avg <= 70) cadence = 'bimonthly'
  else if (avg >= 80 && avg <= 100) cadence = 'quarterly'
  else if (avg >= 170 && avg <= 200) cadence = 'semiannual'
  else if (avg >= 340 && avg <= 380) cadence = 'yearly'
  return { cadence, avgGap: avg, variance }
}

// --- Main algorithm ---

export interface DetectOptions {
  /** Resolve tag id to display name ("Parent > Child" format). */
  tagName: (id: TTagId) => string
  /** How many months of history to analyze. Default 12. */
  lookbackMonths?: number
  /** Current date override (for testing). Default new Date(). */
  now?: Date
  /** Whether an account id belongs to a WB wallet (for filtering "Операция" rows). */
  isWbWalletAccount?: (id: string) => boolean
}

export function detectRecurrenceRules(
  transactions: TTransaction[],
  options: DetectOptions
): RecurrenceRule[] {
  const { tagName, lookbackMonths = 12, now = new Date(), isWbWalletAccount } = options

  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - lookbackMonths)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const todayStr = now.toISOString().slice(0, 10)

  // --- Filter ---
  const txs = transactions.filter(t => {
    if (t.deleted) return false
    if (t.date < cutoffStr) return false
    if (t.income > 0 && t.outcome > 0) return false
    if (t.income === 0 && t.outcome === 0) return false
    // Skip WB wallet "Операция" daily interest
    if (isWbWalletAccount) {
      const accId = t.income > 0 ? t.incomeAccount : t.outcomeAccount
      if (isWbWalletAccount(accId) && /операция/i.test(t.payee || '')) return false
    }
    return true
  })

  // --- Group by (type, primaryKey, amountBucket) ---
  interface SubGroup {
    primary: string
    bucket: number
    type: 'income' | 'expense'
    samplePayee: string
    txs: TTransaction[]
  }

  const subGroups = new Map<string, SubGroup>()
  for (const t of txs) {
    let payeeRaw = (t.payee || '').trim()
    if (!payeeRaw && t.comment) payeeRaw = t.comment.split('\n')[0].trim().slice(0, 60)
    if (!payeeRaw) continue
    const norm = normalizePayee(payeeRaw)
    if (norm.length < 3) continue
    const primary = primaryKey(norm, 3)
    if (primary.length < 3) continue

    const type: 'income' | 'expense' = t.income > 0 ? 'income' : 'expense'
    const amt = type === 'income' ? t.income : t.outcome
    const bucket = amountBucket(amt)
    const key = `${type}::${primary}::${bucket}`

    const g = subGroups.get(key) || { primary, bucket, type, samplePayee: payeeRaw, txs: [] }
    g.txs.push(t)
    subGroups.set(key, g)
  }

  // --- Detect rules per sub-group ---
  const rules: RecurrenceRule[] = []
  for (const g of subGroups.values()) {
    const amounts = g.txs.map(t => (g.type === 'income' ? t.income : t.outcome))
    const medAmount = median(amounts)
    const isBig = medAmount >= 30000
    const minOccurrences = isBig ? 2 : 3
    if (g.txs.length < minOccurrences) continue

    g.txs.sort((a, b) => a.date.localeCompare(b.date))

    const amountMin = Math.min(...amounts)
    const amountMax = Math.max(...amounts)
    const amountVariance = medAmount > 0 ? stdev(amounts) / medAmount : 1
    if (amountVariance > 0.5) continue

    let cadence: Cadence, avgGap: number, gapVariance: number
    if (g.txs.length === 1) {
      cadence = 'custom'; avgGap = 30; gapVariance = 0
    } else {
      const gaps: number[] = []
      for (let i = 1; i < g.txs.length; i++) {
        gaps.push(daysBetween(g.txs[i - 1].date, g.txs[i].date))
      }
      const cls = classifyCadence(gaps)
      cadence = cls.cadence; avgGap = cls.avgGap; gapVariance = cls.variance
    }
    if (cadence === 'custom' && gapVariance > 0.5 && g.txs.length > 2) continue

    let confidence = Math.min(1, g.txs.length / 6)
    if (gapVariance > 0.15) confidence -= 0.1
    if (gapVariance > 0.3) confidence -= 0.15
    if (amountVariance > 0.1) confidence -= 0.08
    if (amountVariance > 0.25) confidence -= 0.12
    const lastDate = g.txs[g.txs.length - 1].date
    const daysSinceLast = daysBetween(lastDate, todayStr)
    if (avgGap > 0 && daysSinceLast > avgGap * 2) confidence -= 0.3
    if (isBig) confidence += 0.1
    confidence = Math.max(0, Math.min(1, confidence))
    if (confidence < 0.4) continue

    const anchorDay = Math.round(median(g.txs.map(t => new Date(t.date).getUTCDate())))

    const catCounts = new Map<string, number>()
    for (const t of g.txs) {
      if (t.tag && t.tag[0]) catCounts.set(t.tag[0], (catCounts.get(t.tag[0]) || 0) + 1)
    }
    const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const categoryId = topCat?.[0] || null
    const category = categoryId ? tagName(categoryId) : null

    const isSalary =
      g.type === 'income' &&
      (!!(category && /зарплата|стипендия|аванс/i.test(category)) ||
        /заработн|аванс|зарплат/i.test(g.primary) ||
        (medAmount >= 100000 && (cadence === 'monthly' || cadence === 'biweekly')))
    const isCredit =
      g.type === 'expense' &&
      (!!(category && /кредит|ипотек/i.test(category)) ||
        /кредит|ипотек|погашени/i.test(g.primary))

    rules.push({
      id: `rule_${g.type}_${g.primary.replace(/\s/g, '_')}_${g.bucket}`,
      name: g.samplePayee,
      type: g.type,
      payeeKey: g.primary,
      samplePayee: g.samplePayee,
      amount: Math.round(medAmount),
      amountMin: Math.round(amountMin),
      amountMax: Math.round(amountMax),
      amountVariance: Math.round(amountVariance * 100) / 100,
      cadence,
      avgGapDays: Math.round(avgGap),
      anchorDay,
      firstSeen: g.txs[0].date,
      lastSeen: lastDate,
      occurrences: g.txs.length,
      confidence: Math.round(confidence * 100) / 100,
      isSalary,
      isCredit,
      category,
      categoryId,
      matchedTxIds: g.txs.map(t => t.id),
      active: true,
    })
  }

  // --- Pass 2: TAG-BASED salary detection ---
  // Payee-based grouping fails when payee contains month names or varies
  // wildly (e.g., "Зарплата за месяц Январь" vs "Аванс Март" vs
  // "Для зачисления на счет Вафина"). But the TAG is stable.
  // If 2+ income transactions share tag "Зарплата" or payee matches
  // salary-like patterns, create aggregated rules regardless of payee/amount.
  {
    const salaryTagIds = new Set<string>()
    for (const [id, _] of Object.entries({})) {} // placeholder
    // Find tag IDs for "Зарплата" or "Аванс"
    const salaryTxs = txs.filter(t => {
      if (t.income <= 0) return false
      if (t.income > 0 && t.outcome > 0) return false
      // By tag
      if (t.tag?.[0]) {
        const tName = tagName(t.tag[0]).toLowerCase()
        if (/зарплата|стипендия/.test(tName)) return true
      }
      // By payee
      const p = (t.payee || t.comment || '').toLowerCase()
      if (/зарплат|аванс|начислен/.test(p)) return true
      return false
    })

    // Group salary txs into TWO buckets: 5th (salary) and 20th (advance).
    // Russian companies typically pay on 5th and 20th of month.
    // If the date lands on a weekend/holiday, it shifts earlier — so
    // transactions from 1st-14th → "5th" bucket, 15th-31st → "20th" bucket.
    const salaryByAnchor = new Map<number, typeof salaryTxs>()
    for (const t of salaryTxs) {
      const day = new Date(t.date).getUTCDate()
      const bucket = day <= 14 ? 5 : 20
      const arr = salaryByAnchor.get(bucket) || []
      arr.push(t)
      salaryByAnchor.set(bucket, arr)
    }

    // Create rules for each anchor bucket with >= 2 occurrences
    const existingSalaryIds = new Set(
      rules.filter(r => r.isSalary).flatMap(r => r.matchedTxIds)
    )

    for (const [anchor, group] of salaryByAnchor) {
      const newTxs = group.filter(t => !existingSalaryIds.has(t.id))
      if (newTxs.length < 2) continue

      newTxs.sort((a, b) => a.date.localeCompare(b.date))
      const amounts = newTxs.map(t => t.income)
      const medAmount = amounts.reduce((s, x) => s + x, 0) / amounts.length

      // Fixed anchor: 5th or 20th (known from user context)
      const anchorDay = anchor

      const label = anchor <= 10 ? 'Зарплата' : 'Аванс'
      rules.push({
        id: `rule_salary_tag_${anchor}`,
        name: `${label} (${anchorDay}-е числа)`,
        type: 'income',
        payeeKey: `зарплата_tag_${anchor}`,
        samplePayee: newTxs[0].payee || newTxs[0].comment || label,
        amount: Math.round(medAmount),
        amountMin: Math.round(Math.min(...amounts)),
        amountMax: Math.round(Math.max(...amounts)),
        amountVariance: 0,
        cadence: 'monthly',
        avgGapDays: 30,
        anchorDay,
        firstSeen: newTxs[0].date,
        lastSeen: newTxs[newTxs.length - 1].date,
        occurrences: newTxs.length,
        confidence: 0.9,
        isSalary: true,
        isCredit: false,
        category: 'Зарплата',
        categoryId: newTxs[0].tag?.[0] || null,
        matchedTxIds: newTxs.map(t => t.id),
        active: true,
      })
    }
  }

  // --- Filter: keep ONLY salary and credit, drop noise ---
  const filtered = rules.filter(r => {
    if (!r.isSalary && !r.isCredit) return false
    if (PAYEE_BLOCKLIST.some(p => r.payeeKey.includes(p))) return false
    if (r.isCredit && r.amount < 500) return false
    return true
  })

  // --- Sort: income first, then by amount desc ---
  filtered.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'income' ? -1 : 1
    return b.amount - a.amount
  })

  return filtered
}

/** Approximate monthly equivalent for a rule given its cadence. */
export function ruleMonthlyAmount(rule: RecurrenceRule): number {
  const mult: Record<Cadence, number> = {
    daily: 30, weekly: 4.33, biweekly: 2.17, monthly: 1, bimonthly: 0.5,
    quarterly: 1 / 3, semiannual: 1 / 6, yearly: 1 / 12, custom: 1,
  }
  return rule.amount * mult[rule.cadence]
}
