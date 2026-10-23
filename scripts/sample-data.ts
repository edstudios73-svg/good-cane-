// Generates labelled sample history for the staff dashboard as SQL.
//   npx tsx scripts/sample-data.ts > supabase/sample-data.sql
// Every row is flagged is_sample and uses a 00000000xx phone number, so it is
// never texted and is easy to delete:
//   delete from orders where is_sample; delete from customers where is_sample;

import { randomUUID } from 'node:crypto'
import { openBatches, pastBatches } from '../src/domain/batches'
import { PICKUP_POINTS, PRODUCTS } from '../src/domain/catalog'

// Placeholder areas for labelled sample rows only.
const DELIVERY_AREAS = ['Delivery area 1 (sample)', 'Delivery area 2 (sample)', 'Delivery area 3 (sample)']
import { FIRM, bottles } from '../src/domain/orders'
import type { BatchRecord, Customer, Order, OrderLine, OrderStatus, Source } from '../src/domain/types'

export interface SampleData {
  customers: Customer[]
  orders: Order[]
  batchRecords: BatchRecord[]
}

/** Small deterministic PRNG so the demo looks the same on every reset. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export function createSampleData(now: Date): SampleData {
  const rand = rng(20261024)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const id = (p: string, n: number) => `${p}_${n.toString(36)}`

  const customers: Customer[] = Array.from({ length: 16 }, (_, i) => ({
    id: id('cus', i + 1),
    name: `Sample Customer ${String(i + 1).padStart(2, '0')}`,
    phone: `00000000${String(i + 1).padStart(2, '0')}`,
    remindersOptIn: i % 3 !== 2,
    reminderChannel: i % 4 === 0 ? 'sms' : 'whatsapp',
    createdAt: new Date(now.getTime() - 60 * 86_400_000).toISOString(),
    sample: true,
  }))
  // Each sample customer has a habit: a favourite flavour and a likelihood of ordering each week.
  const habits = customers.map((c, i) => ({
    customerId: c.id,
    favourite: PRODUCTS[i % PRODUCTS.length].id,
    weekly: 0.25 + rand() * 0.55,
  }))

  const orders: Order[] = []
  let number = 1
  const sources: Source[] = ['tiktok', 'tiktok', 'instagram', 'whatsapp', 'direct']

  const makeLines = (favourite: string): OrderLine[] => {
    const lines: OrderLine[] = [{ productId: favourite, qty: 1 + Math.floor(rand() * 4) }]
    if (rand() < 0.35) {
      const other = pick(PRODUCTS.filter((p) => p.id !== favourite)).id
      lines.push({ productId: other, qty: 1 + Math.floor(rand() * 2) })
    }
    return lines
  }

  const addOrder = (customerId: string, batchId: string, lines: OrderLine[], status: OrderStatus, createdAt: Date) => {
    const steps: OrderStatus[] = ['requested']
    if (status === 'cancelled') {
      if (rand() < 0.5) steps.push('confirmed')
      steps.push('cancelled')
    } else {
      for (const s of ['confirmed', 'paid', 'fulfilled'] as const) {
        if (steps.includes(status)) break
        steps.push(s)
      }
    }
    const history = steps.map((s, i) => ({
      status: s,
      at: new Date(createdAt.getTime() + i * 3_600_000 * 5).toISOString(),
      by: s === 'requested' || (s === 'cancelled' && rand() < 0.6) ? ('customer' as const) : ('business' as const),
    }))
    orders.push({
      id: id('ord', number),
      number: number++,
      customerId,
      batchId,
      lines,
      fulfilment: rand() < 0.55 ? 'delivery' : 'pickup',
      location: rand() < 0.55 ? pick(DELIVERY_AREAS) : pick(PICKUP_POINTS),
      status,
      history,
      source: orders.some((o) => o.customerId === customerId) ? (rand() < 0.5 ? 'reorder' : 'reminder') : pick(sources),
      createdAt: createdAt.toISOString(),
      sample: true,
    })
  }

  // History: six past weeks, growing slowly as more customers discover GoodCane.
  const past = pastBatches(now, 6).reverse()
  const batchRecords: BatchRecord[] = []
  past.forEach((b, w) => {
    const active = habits.slice(0, 8 + w)
    const inProduction = b.productionDate.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    for (const h of active) {
      if (rand() > h.weekly) continue
      const createdAt = new Date(b.cutoff.getTime() - (1 + rand() * 4) * 86_400_000)
      const r = rand()
      const status: OrderStatus = r < 0.12 ? 'cancelled' : inProduction ? (r < 0.6 ? 'paid' : 'confirmed') : 'fulfilled'
      addOrder(h.customerId, b.id, makeLines(h.favourite), status, createdAt)
    }
    if (!inProduction) {
      const firm = orders.filter((o) => o.batchId === b.id && FIRM.includes(o.status)).reduce((n, o) => n + bottles(o.lines), 0)
      const walkIns = Math.floor(rand() * 6)
      const forecast = firm + Math.round((rand() - 0.3) * 6)
      batchRecords.push({ batchId: b.id, forecast, produced: Math.max(forecast, firm) + 4, sold: firm + walkIns })
    }
  })

  // Upcoming: next batch is filling up; the one after has a couple of early requests.
  const [next, after] = openBatches(now, 2)
  const nextStatuses: OrderStatus[] = ['paid', 'confirmed', 'confirmed', 'requested', 'requested', 'requested', 'cancelled']
  nextStatuses.forEach((status, i) => {
    const h = habits[i * 2]
    addOrder(h.customerId, next.id, makeLines(h.favourite), status, new Date(now.getTime() - (i + 1) * 5 * 3_600_000))
  })
  for (const i of [3, 7]) {
    const h = habits[i]
    addOrder(h.customerId, after.id, makeLines(h.favourite), 'requested', new Date(now.getTime() - i * 3_600_000))
  }

  return { customers, orders, batchRecords }
}

const q = (v: unknown) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

export function toSql(d: SampleData): string {
  const ids = new Map<string, string>()
  const uuid = (k: string) => {
    if (!ids.has(k)) ids.set(k, randomUUID())
    return ids.get(k)!
  }
  const out = ['-- Sample history for the staff dashboard (is_sample = true). Generated by scripts/sample-data.ts.', 'begin;']
  for (const c of d.customers) {
    out.push(`insert into public.customers (id, name, phone, reminders_opt_in, is_sample, created_at) values (${q(uuid(c.id))}, ${q(c.name)}, ${q(c.phone)}, ${c.remindersOptIn}, true, ${q(c.createdAt)});`)
  }
  for (const o of d.orders) {
    out.push(
      `insert into public.orders (id, number, customer_id, batch_date, lines, fulfilment, location, status, history, source, is_sample, created_at) values (${q(uuid(o.id))}, ${o.number}, ${q(uuid(o.customerId))}, ${q(o.batchId)}, ${q(JSON.stringify(o.lines))}::jsonb, ${q(o.fulfilment)}, ${q(o.location)}, ${q(o.status)}, ${q(JSON.stringify(o.history))}::jsonb, ${q(o.source)}, true, ${q(o.createdAt)});`,
    )
  }
  for (const r of d.batchRecords) {
    out.push(`insert into public.batch_records (batch_date, forecast, produced, sold) values (${q(r.batchId)}, ${r.forecast ?? 'null'}, ${r.produced ?? 'null'}, ${r.sold ?? 'null'});`)
  }
  out.push(`select setval('public.order_number_seq', ${Math.max(...d.orders.map((o) => o.number))});`, 'commit;')
  return out.join('\n') + '\n'
}

if (process.argv[1]?.endsWith('sample-data.ts')) process.stdout.write(toSql(createSampleData(new Date())))
