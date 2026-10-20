import { formatCutoff, formatDay, type Batch } from './batches'
import { FIRM } from './orders'
import type { Customer, Order } from './types'

/**
 * Customers who opted in to reminders, have ordered before, and have no
 * active order for this batch yet. Cancelled orders don't count as active.
 */
export function remindersDue(customers: Customer[], orders: Order[], batchId: string): Customer[] {
  return customers.filter((c) => {
    if (!c.remindersOptIn) return false
    const mine = orders.filter((o) => o.customerId === c.id)
    const orderedBefore = mine.some((o) => FIRM.includes(o.status))
    const activeThisBatch = mine.some((o) => o.batchId === batchId && o.status !== 'cancelled')
    return orderedBefore && !activeThisBatch
  })
}

export function reminderMessage(customer: Customer, batch: Batch, reorderUrl: string): string {
  // Sample names ("Sample Customer 03") read oddly shortened, so keep them whole.
  const first = customer.sample ? customer.name : customer.name.split(' ')[0]
  return (
    `Hi ${first}, GoodCane's next fresh batch is ${formatDay(batch.productionDate)}. ` +
    `Pre-orders close ${formatCutoff(batch.cutoff)}. Same again? ${reorderUrl} ` +
    `— Reply STOP to turn off reminders.`
  )
}
