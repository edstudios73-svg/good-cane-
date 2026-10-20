import { openBatches, type Batch } from '../../domain/batches'
import type { Order } from '../../domain/types'

/** The customer's most recent order that wasn't cancelled — the one "Same again?" copies. */
export function lastReorderable(orders: Order[], customerId: string): Order | undefined {
  return orders
    .filter((o) => o.customerId === customerId && o.status !== 'cancelled')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/** Soonest open batch the customer hasn't already ordered for — "same again" means next time, not a duplicate. */
export function reorderBatch(orders: Order[], customerId: string, now: Date): Batch {
  const open = openBatches(now, 3)
  const taken = new Set(orders.filter((o) => o.customerId === customerId && o.status !== 'cancelled').map((o) => o.batchId))
  return open.find((b) => !taken.has(b.id)) ?? open[0]
}
