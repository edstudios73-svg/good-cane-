import { FIRM, bottles } from './orders'
import type { Order, OrderStatus, Product } from './types'

export type StatusCounts = Record<OrderStatus, number>

export interface ProductDemand {
  productId: string
  bottles: StatusCounts
}

export interface BatchDemand {
  batchId: string
  byProduct: ProductDemand[]
  totals: StatusCounts
  /** Orders (not bottles) per status. */
  orders: StatusCounts
  /** Bottles GoodCane has accepted: confirmed + paid + delivered. */
  firmBottles: number
  /** Bottles still waiting for confirmation. */
  pendingBottles: number
}

const zero = (): StatusCounts => ({ requested: 0, confirmed: 0, paid: 0, fulfilled: 0, cancelled: 0 })

export function demandForBatch(orders: Order[], batchId: string, products: Product[]): BatchDemand {
  const byProduct = new Map(products.map((p) => [p.id, zero()]))
  const totals = zero()
  const orderCounts = zero()
  for (const o of orders) {
    if (o.batchId !== batchId) continue
    orderCounts[o.status]++
    for (const l of o.lines) {
      if (!byProduct.has(l.productId)) byProduct.set(l.productId, zero())
      byProduct.get(l.productId)![o.status] += l.qty
      totals[o.status] += l.qty
    }
  }
  return {
    batchId,
    byProduct: [...byProduct].map(([productId, b]) => ({ productId, bottles: b })),
    totals,
    orders: orderCounts,
    firmBottles: FIRM.reduce((n, s) => n + totals[s], 0),
    pendingBottles: totals.requested,
  }
}

/**
 * Share of past requests that GoodCane went on to confirm (i.e. that were not
 * cancelled). Used to weight still-pending requests in the forecast.
 * Falls back to 0.7 — an explicit placeholder — when there is no history.
 */
export function historicalConfirmRate(orders: Order[], pastBatchIds: string[]): number {
  const past = orders.filter((o) => pastBatchIds.includes(o.batchId))
  const total = past.reduce((n, o) => n + bottles(o.lines), 0)
  if (total === 0) return 0.7
  const firm = past.filter((o) => FIRM.includes(o.status)).reduce((n, o) => n + bottles(o.lines), 0)
  return firm / total
}

/**
 * Suggested bottles to produce: everything already confirmed plus pending
 * requests weighted by how often requests historically get confirmed.
 * Deliberately simple and explainable — no AI needed for this.
 */
export function forecastBottles(firm: number, pending: number, confirmRate: number): number {
  return firm + Math.ceil(pending * confirmRate)
}

export function forecastForProduct(d: StatusCounts, confirmRate: number): number {
  return forecastBottles(FIRM.reduce((n, s) => n + d[s], 0), d.requested, confirmRate)
}
