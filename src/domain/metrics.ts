import { FIRM, bottles } from './orders'
import type { BatchRecord, Order } from './types'

export interface WeeklyRow {
  batchId: string
  ordersPlaced: number
  confirmedOrders: number
  cancelledOrders: number
  firmBottles: number
  /** Customers with a firm order this week who also had one in an earlier week. */
  returningCustomers: number
  forecast?: number
  sold?: number
  /** 1 − |forecast − sold| / sold, when both are known. */
  forecastAccuracy?: number
}

/** Rows for the given batches (pass them oldest → newest so "returning" is meaningful). */
export function weeklyRows(orders: Order[], batchIds: string[], records: BatchRecord[]): WeeklyRow[] {
  const seenBefore = new Set<string>()
  return batchIds.map((batchId) => {
    const week = orders.filter((o) => o.batchId === batchId)
    const firm = week.filter((o) => FIRM.includes(o.status))
    const firmCustomers = new Set(firm.map((o) => o.customerId))
    const returning = [...firmCustomers].filter((c) => seenBefore.has(c)).length
    firmCustomers.forEach((c) => seenBefore.add(c))
    const rec = records.find((r) => r.batchId === batchId)
    return {
      batchId,
      ordersPlaced: week.length,
      confirmedOrders: firm.length,
      cancelledOrders: week.filter((o) => o.status === 'cancelled').length,
      firmBottles: firm.reduce((n, o) => n + bottles(o.lines), 0),
      returningCustomers: returning,
      forecast: rec?.forecast,
      sold: rec?.sold,
      forecastAccuracy: forecastAccuracy(rec?.forecast, rec?.sold),
    }
  })
}

export function forecastAccuracy(forecast?: number, sold?: number): number | undefined {
  if (forecast == null || sold == null || sold === 0) return undefined
  return Math.max(0, 1 - Math.abs(forecast - sold) / sold)
}

/**
 * Repeat-order rate: of customers with at least one firm order in these
 * batches, the share who have firm orders in two or more different batches.
 */
export function repeatOrderRate(orders: Order[], batchIds: string[]): { rate: number; repeaters: number; customers: number } {
  const weeksByCustomer = new Map<string, Set<string>>()
  for (const o of orders) {
    if (!batchIds.includes(o.batchId) || !FIRM.includes(o.status)) continue
    if (!weeksByCustomer.has(o.customerId)) weeksByCustomer.set(o.customerId, new Set())
    weeksByCustomer.get(o.customerId)!.add(o.batchId)
  }
  const customers = weeksByCustomer.size
  const repeaters = [...weeksByCustomer.values()].filter((s) => s.size >= 2).length
  return { rate: customers ? repeaters / customers : 0, repeaters, customers }
}

export function cancellationRate(orders: Order[], batchIds: string[]): number {
  const inScope = orders.filter((o) => batchIds.includes(o.batchId))
  if (!inScope.length) return 0
  return inScope.filter((o) => o.status === 'cancelled').length / inScope.length
}

export function pct(x: number | undefined): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`
}
