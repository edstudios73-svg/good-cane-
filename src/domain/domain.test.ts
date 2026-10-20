import { describe, expect, it } from 'vitest'
import { batchFromId, isOpen, openBatches, pastBatches } from './batches'
import { demandForBatch, forecastBottles, historicalConfirmRate } from './demand'
import { cancellationRate, forecastAccuracy, repeatOrderRate, weeklyRows } from './metrics'
import { canCustomerCancel, isValidPhone, normalisePhone, transition } from './orders'
import { remindersDue } from './reminders'
import { PRODUCTS, createSeedState } from './seed'
import type { Customer, Order, OrderStatus } from './types'

// Tuesday 20 Oct 2026, 10:00 local. Next batch: Sat 24 Oct, cutoff Thu 22 Oct 18:00.
const NOW = new Date(2026, 9, 20, 10)

function order(p: Partial<Order> & { status: OrderStatus }): Order {
  return {
    id: p.id ?? Math.random().toString(36),
    number: 1,
    customerId: 'c1',
    batchId: '2026-10-24',
    lines: [{ productId: 'raw', qty: 2 }],
    fulfilment: 'pickup',
    location: 'Pickup point A (sample)',
    history: [{ status: p.status, at: NOW.toISOString(), by: 'customer' }],
    source: 'direct',
    createdAt: NOW.toISOString(),
    sample: true,
    ...p,
  }
}

describe('batches', () => {
  it('next open batch is the coming Saturday with a Thursday 18:00 cutoff', () => {
    const [b] = openBatches(NOW, 1)
    expect(b.id).toBe('2026-10-24')
    expect(b.cutoff).toEqual(new Date(2026, 9, 22, 18))
  })

  it('rolls to the following week once the cutoff passes', () => {
    const fri = new Date(2026, 9, 23, 9)
    expect(openBatches(fri, 1)[0].id).toBe('2026-10-31')
    expect(isOpen('2026-10-24', fri)).toBe(false)
    expect(pastBatches(fri, 1)[0].id).toBe('2026-10-24')
  })

  it('past batches are closed and most recent first', () => {
    const past = pastBatches(NOW, 3).map((b) => b.id)
    expect(past).toEqual(['2026-10-17', '2026-10-10', '2026-10-03'])
  })

  it('round-trips batch ids', () => {
    expect(batchFromId('2026-10-24').productionDate.getDay()).toBe(6)
  })
})

describe('order lifecycle', () => {
  it('business moves requested → confirmed → paid → fulfilled', () => {
    let o = order({ status: 'requested' })
    o = transition(o, 'confirmed', 'business', NOW)
    o = transition(o, 'paid', 'business', NOW)
    o = transition(o, 'fulfilled', 'business', NOW)
    expect(o.status).toBe('fulfilled')
    expect(o.history.map((h) => h.status)).toEqual(['requested', 'confirmed', 'paid', 'fulfilled'])
  })

  it('cannot skip confirmation straight to paid', () => {
    expect(() => transition(order({ status: 'requested' }), 'paid', 'business', NOW)).toThrow()
  })

  it('customers can cancel unpaid orders before cutoff only', () => {
    expect(canCustomerCancel(order({ status: 'requested' }), NOW)).toBe(true)
    expect(canCustomerCancel(order({ status: 'confirmed' }), NOW)).toBe(true)
    expect(canCustomerCancel(order({ status: 'paid' }), NOW)).toBe(false)
    expect(canCustomerCancel(order({ status: 'requested' }), new Date(2026, 9, 22, 18, 1))).toBe(false)
    expect(() => transition(order({ status: 'paid' }), 'cancelled', 'customer', NOW)).toThrow()
  })

  it('normalises Ghanaian numbers', () => {
    expect(normalisePhone('+233 24 123 4567')).toBe('0241234567')
    expect(isValidPhone('024-123-4567')).toBe(true)
    expect(isValidPhone('12345')).toBe(false)
  })
})

describe('demand', () => {
  const orders = [
    order({ status: 'requested', lines: [{ productId: 'raw', qty: 3 }] }),
    order({ status: 'confirmed', lines: [{ productId: 'raw', qty: 2 }, { productId: 'passion', qty: 1 }] }),
    order({ status: 'paid', lines: [{ productId: 'mint-lemon', qty: 4 }] }),
    order({ status: 'cancelled', lines: [{ productId: 'raw', qty: 5 }] }),
    order({ status: 'confirmed', batchId: '2026-10-31', lines: [{ productId: 'raw', qty: 9 }] }),
  ]

  it('separates requests from firm demand and ignores other batches', () => {
    const d = demandForBatch(orders, '2026-10-24', PRODUCTS)
    expect(d.firmBottles).toBe(7)
    expect(d.pendingBottles).toBe(3)
    expect(d.totals.cancelled).toBe(5)
    expect(d.orders.requested).toBe(1)
    expect(d.byProduct.find((p) => p.productId === 'raw')!.bottles).toMatchObject({ requested: 3, confirmed: 2, cancelled: 5 })
  })

  it('forecast = firm + pending × confirm rate, rounded up', () => {
    expect(forecastBottles(7, 3, 0.5)).toBe(9)
    expect(forecastBottles(7, 0, 0.5)).toBe(7)
  })

  it('confirm rate comes from past batches, with an explicit fallback', () => {
    const past = [
      order({ status: 'fulfilled', batchId: '2026-10-17', lines: [{ productId: 'raw', qty: 3 }] }),
      order({ status: 'cancelled', batchId: '2026-10-17', lines: [{ productId: 'raw', qty: 1 }] }),
    ]
    expect(historicalConfirmRate(past, ['2026-10-17'])).toBe(0.75)
    expect(historicalConfirmRate([], ['2026-10-17'])).toBe(0.7)
  })
})

describe('metrics', () => {
  const orders = [
    order({ status: 'fulfilled', customerId: 'a', batchId: '2026-10-10' }),
    order({ status: 'fulfilled', customerId: 'a', batchId: '2026-10-17' }),
    order({ status: 'fulfilled', customerId: 'b', batchId: '2026-10-17' }),
    order({ status: 'cancelled', customerId: 'c', batchId: '2026-10-17' }),
  ]
  const ids = ['2026-10-10', '2026-10-17']

  it('repeat-order rate counts customers with firm orders in 2+ batches', () => {
    expect(repeatOrderRate(orders, ids)).toEqual({ rate: 0.5, repeaters: 1, customers: 2 })
  })

  it('cancellation rate is cancelled / all orders', () => {
    expect(cancellationRate(orders, ids)).toBe(0.25)
  })

  it('weekly rows track returning customers and forecast accuracy', () => {
    const rows = weeklyRows(orders, ids, [{ batchId: '2026-10-17', forecast: 8, sold: 10 }])
    expect(rows[1]).toMatchObject({ ordersPlaced: 3, confirmedOrders: 2, cancelledOrders: 1, returningCustomers: 1, forecastAccuracy: 0.8 })
    expect(rows[0].forecastAccuracy).toBeUndefined()
  })

  it('forecast accuracy never goes below zero', () => {
    expect(forecastAccuracy(30, 10)).toBe(0)
  })
})

describe('reminders', () => {
  const c = (id: string, optIn: boolean): Customer => ({
    id,
    name: id,
    phone: '0000000000',
    remindersOptIn: optIn,
    reminderChannel: 'whatsapp',
    createdAt: NOW.toISOString(),
    sample: true,
  })

  it('only opted-in past buyers without an active order this batch', () => {
    const customers = [c('in-no-order', true), c('out', false), c('in-ordered', true), c('in-never-bought', true), c('in-cancelled', true)]
    const orders = [
      order({ status: 'fulfilled', customerId: 'in-no-order', batchId: '2026-10-17' }),
      order({ status: 'fulfilled', customerId: 'out', batchId: '2026-10-17' }),
      order({ status: 'fulfilled', customerId: 'in-ordered', batchId: '2026-10-17' }),
      order({ status: 'requested', customerId: 'in-ordered', batchId: '2026-10-24' }),
      order({ status: 'fulfilled', customerId: 'in-cancelled', batchId: '2026-10-17' }),
      order({ status: 'cancelled', customerId: 'in-cancelled', batchId: '2026-10-24' }),
    ]
    expect(remindersDue(customers, orders, '2026-10-24').map((x) => x.id)).toEqual(['in-no-order', 'in-cancelled'])
  })
})

describe('seed data', () => {
  const s = createSeedState(NOW)

  it('is all labelled sample and uses obviously fake numbers', () => {
    expect(s.customers.every((c) => c.sample && c.name.startsWith('Sample') && c.phone.startsWith('00000000'))).toBe(true)
    expect(s.orders.every((o) => o.sample)).toBe(true)
  })

  it('has history plus a mix of statuses in the next open batch', () => {
    const next = openBatches(NOW, 1)[0].id
    const statuses = new Set(s.orders.filter((o) => o.batchId === next).map((o) => o.status))
    expect(statuses).toEqual(new Set(['requested', 'confirmed', 'paid', 'cancelled']))
    expect(s.batchRecords.length).toBeGreaterThanOrEqual(5)
  })

  it('every order history is a valid lifecycle path', () => {
    for (const o of s.orders) {
      expect(o.history[0].status).toBe('requested')
      expect(o.history[o.history.length - 1].status).toBe(o.status)
    }
  })
})
