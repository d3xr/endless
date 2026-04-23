/**
 * Project recurrence rules into future events within a date window.
 *
 * Strategy:
 *   - For monthly/bimonthly/quarterly/yearly cadences we project using
 *     the rule's `anchorDay` (day-of-month it usually lands on). This
 *     shows real dates like "20 мая" instead of "lastSeen + 30 days".
 *   - For daily/weekly/biweekly we step from lastSeen by avgGapDays.
 *   - Events within [today - pastDays, today] that have a matching real
 *     tx get `realized: true` so the UI can grey them out.
 */
import { TTransaction } from '6-shared/types'
import { RecurrenceRule, ProjectedEvent, Cadence } from './types'

const CADENCE_DAYS: Record<Cadence, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
  quarterly: 91,
  semiannual: 182,
  yearly: 365,
  custom: 30,
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

/** Build a YYYY-MM-DD from year/month(0-based)/day, clamping day to end of month. */
function makeDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, daysInMonth))
  return d.toISOString().slice(0, 10)
}

/**
 * Uzbekistan public holidays.
 *
 * Fixed holidays use "MM-DD" keys.
 * Lunar holidays (Рамазан хайит / Курбан хайит) shift every year,
 * so they use "YYYY-MM-DD" keys for 2026–2035 (pre-computed from
 * Umm al-Qura calendar). Each gets +1 day (2-day holiday in UZ).
 */
const UZ_FIXED_HOLIDAYS = [
  '01-01',         // Новый год
  '01-14',         // День защитников Родины
  '03-08',         // Международный женский день
  '03-21',         // Навруз
  '05-09',         // День памяти и почестей
  '09-01',         // День независимости
  '10-01',         // День учителя
  '12-08',         // День Конституции
]

// Рамазан хайит (Eid al-Fitr) — 2 дня
const RAMAZAN_HAYIT: Record<number, string> = {
  2026: '03-20', 2027: '03-09', 2028: '02-26', 2029: '02-14', 2030: '02-04',
  2031: '01-24', 2032: '01-14', 2033: '01-02', 2034: '12-12', 2035: '12-01',
}

// Курбан хайит (Eid al-Adha) — 2 дня
const KURBAN_HAYIT: Record<number, string> = {
  2026: '05-27', 2027: '05-16', 2028: '05-05', 2029: '04-24', 2030: '04-13',
  2031: '04-02', 2032: '03-22', 2033: '03-11', 2034: '03-01', 2035: '02-18',
}

/** Build the full holiday set for a given year. */
function buildHolidaySet(year: number): Set<string> {
  const s = new Set<string>(UZ_FIXED_HOLIDAYS)
  // Add lunar holidays + day 2
  for (const [y, mmdd] of Object.entries(RAMAZAN_HAYIT)) {
    if (+y === year) {
      s.add(mmdd)
      const d2 = new Date(`${year}-${mmdd}`)
      d2.setDate(d2.getDate() + 1)
      s.add(d2.toISOString().slice(5, 10))
    }
  }
  for (const [y, mmdd] of Object.entries(KURBAN_HAYIT)) {
    if (+y === year) {
      s.add(mmdd)
      const d2 = new Date(`${year}-${mmdd}`)
      d2.setDate(d2.getDate() + 1)
      s.add(d2.toISOString().slice(5, 10))
    }
  }
  return s
}

// Cache per year
const holidayCache = new Map<number, Set<string>>()

/**
 * Salary anchor: if the target day lands on weekend or holiday,
 * shift to the nearest PREVIOUS business day (salary paid earlier, not later).
 */
function salaryDate(year: number, month: number, targetDay: number): string {
  const iso = makeDate(year, month, targetDay)
  const d = new Date(iso)
  const actualYear = d.getUTCFullYear()
  let holidays = holidayCache.get(actualYear)
  if (!holidays) {
    holidays = buildHolidaySet(actualYear)
    holidayCache.set(actualYear, holidays)
  }
  // Walk backward until we find a business day
  for (let i = 0; i < 7; i++) {
    const dow = d.getUTCDay() // 0=Sun, 6=Sat
    const mmdd = d.toISOString().slice(5, 10)
    if (dow !== 0 && dow !== 6 && !holidays!.has(mmdd)) {
      return d.toISOString().slice(0, 10)
    }
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}

export interface ProjectOptions {
  /** Days ahead to project. Default 30. */
  horizonDays?: number
  /** Include past events to show "realized" history. Default last 7 days. */
  pastDays?: number
  /** Current date override. */
  now?: Date
  /** All transactions (for realized-matching). */
  transactions?: TTransaction[]
}

export function projectEvents(
  rules: RecurrenceRule[],
  options: ProjectOptions = {}
): ProjectedEvent[] {
  const { horizonDays = 30, pastDays = 7, now = new Date(), transactions = [] } = options
  const todayStr = now.toISOString().slice(0, 10)
  const startStr = addDays(todayStr, -pastDays)
  const endStr = addDays(todayStr, horizonDays)

  const events: ProjectedEvent[] = []

  for (const rule of rules) {
    if (!rule.active) continue

    // --- Monthly+ cadences: project on anchorDay of month ---
    if (
      rule.cadence === 'monthly' ||
      rule.cadence === 'bimonthly' ||
      rule.cadence === 'quarterly' ||
      rule.cadence === 'semiannual' ||
      rule.cadence === 'yearly'
    ) {
      const stepMonths =
        rule.cadence === 'monthly' ? 1 :
        rule.cadence === 'bimonthly' ? 2 :
        rule.cadence === 'quarterly' ? 3 :
        rule.cadence === 'semiannual' ? 6 : 12
      // Start from current month, walk forward until horizon
      const startYear = now.getUTCFullYear()
      const startMonth = now.getUTCMonth()
      for (let i = -1; i < 24; i++) {
        const m = startMonth + i * stepMonths
        // Salary: shift to nearest earlier business day (not weekends/holidays)
        const d = rule.isSalary
          ? salaryDate(startYear, m, rule.anchorDay)
          : makeDate(startYear, m, rule.anchorDay)
        if (d < startStr) continue
        if (d > endStr) break
        events.push({
          id: `${rule.id}_${d}`,
          ruleId: rule.id,
          date: d as any,
          amount: rule.amount,
          type: rule.type,
          name: rule.name,
          category: rule.category,
          confidence: rule.confidence,
          isSalary: rule.isSalary,
          isCredit: rule.isCredit,
          realized: false,
        })
      }
      continue
    }

    // --- Sub-monthly cadences: step from lastSeen ---
    const step = rule.avgGapDays || CADENCE_DAYS[rule.cadence]
    if (step <= 0) continue
    let cursor: string = rule.lastSeen
    let i = 0
    while (cursor < endStr && i < 100) {
      cursor = addDays(cursor, step)
      i++
      if (cursor < startStr) continue
      if (cursor > endStr) break
      events.push({
        id: `${rule.id}_${cursor}`,
        ruleId: rule.id,
        date: cursor as any,
        amount: rule.amount,
        type: rule.type,
        name: rule.name,
        category: rule.category,
        confidence: rule.confidence,
        isSalary: rule.isSalary,
        isCredit: rule.isCredit,
        realized: false,
      })
    }
  }

  // --- Realization matching: past events with a real tx get marked ---
  if (transactions.length > 0) {
    const recentTxs = transactions.filter(t => {
      if (t.deleted) return false
      return t.date >= startStr && t.date <= todayStr
    })

    for (const ev of events) {
      if (ev.date > todayStr) continue
      const expectedAmount = ev.amount
      const tol = Math.max(expectedAmount * 0.05, 100)
      const match = recentTxs.find(t => {
        const amt = ev.type === 'income' ? t.income : t.outcome
        if (Math.abs(amt - expectedAmount) > tol) return false
        return Math.abs(daysBetween(t.date, ev.date)) <= 3
      })
      if (match) {
        ev.realized = true
        ev.realizedTxId = match.id
      }
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date))
  return events
}

/** Find the nearest upcoming salary event. Used for "до ЗП осталось". */
export function nextSalaryEvent(events: ProjectedEvent[], now = new Date()): ProjectedEvent | null {
  const today = now.toISOString().slice(0, 10)
  return events.find(e => e.isSalary && e.type === 'income' && e.date >= today && !e.realized) || null
}

/** Sum of credit expenses between today and a given end date (exclusive). */
export function creditsBefore(events: ProjectedEvent[], endDate: string, now = new Date()): number {
  const today = now.toISOString().slice(0, 10)
  return events
    .filter(e => e.isCredit && e.type === 'expense' && e.date >= today && e.date < endDate)
    .reduce((sum, e) => sum + e.amount, 0)
}
