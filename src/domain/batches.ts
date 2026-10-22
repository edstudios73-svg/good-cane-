// Weekly batch schedule. ASSUMPTION (to confirm with GoodCane): one production
// day a week (Saturday) and pre-orders close Thursday 18:00 the same week.

export const PRODUCTION_WEEKDAY = 6 // Saturday (0 = Sunday)
export const CUTOFF_DAYS_BEFORE = 2 // Thursday
export const CUTOFF_HOUR = 18

export interface Batch {
  id: string
  productionDate: Date
  cutoff: Date
}

export function toBatchId(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function batchFromId(id: string): Batch {
  const [y, m, d] = id.split('-').map(Number)
  const productionDate = new Date(y, m - 1, d)
  const cutoff = new Date(y, m - 1, d - CUTOFF_DAYS_BEFORE, CUTOFF_HOUR)
  return { id, productionDate, cutoff }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** The production day on or after `d`. */
function productionDayOnOrAfter(d: Date): Date {
  const s = startOfDay(d)
  const diff = (PRODUCTION_WEEKDAY - s.getDay() + 7) % 7
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + diff)
}

/** Batches still accepting pre-orders (cutoff in the future), soonest first. */
export function openBatches(now: Date, count = 3): Batch[] {
  const out: Batch[] = []
  let day = productionDayOnOrAfter(now)
  while (out.length < count) {
    const b = batchFromId(toBatchId(day))
    if (b.cutoff.getTime() > now.getTime()) out.push(b)
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 7)
  }
  return out
}

/** Batches whose cutoff has passed, most recent first. Includes one in production. */
export function pastBatches(now: Date, count: number): Batch[] {
  const out: Batch[] = []
  let day = productionDayOnOrAfter(now)
  // Step back until we find batches whose cutoff has passed.
  for (let i = 0; out.length < count && i < count + 3; i++) {
    const b = batchFromId(toBatchId(day))
    if (b.cutoff.getTime() <= now.getTime()) out.push(b)
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 7)
  }
  return out
}

export function isOpen(batchId: string, now: Date): boolean {
  return batchFromId(batchId).cutoff.getTime() > now.getTime()
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' })

/** Customer-facing date without the weekday: "31 October". */
export function formatDate(d: Date): string {
  return dateFmt.format(d)
}

/** Customer-facing closing time: "29 October, 6pm". */
export function formatClose(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  return `${dateFmt.format(d)}, ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`
}

export function formatShort(d: Date): string {
  return shortFmt.format(d)
}

export function formatDay(d: Date): string {
  return dayFmt.format(d)
}

export function formatCutoff(d: Date): string {
  return `${dayFmt.format(d)}, ${timeFmt.format(d)}`
}

/** "2d 4h" style countdown, or "closed". */
export function timeLeft(until: Date, now: Date): string {
  const ms = until.getTime() - now.getTime()
  if (ms <= 0) return 'closed'
  const h = Math.floor(ms / 3_600_000)
  const days = Math.floor(h / 24)
  if (days > 0) return `${days}d ${h % 24}h`
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}
