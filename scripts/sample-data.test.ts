import { describe, expect, it } from 'vitest'
import { openBatches } from '../src/domain/batches'
import { createSampleData, toSql } from './sample-data'

const NOW = new Date(2026, 9, 20, 10)

describe('sample data', () => {
  const s = createSampleData(NOW)

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

describe('sample SQL', () => {
  it('flags every row as sample and bumps the order sequence', () => {
    const sql = toSql(createSampleData(NOW))
    expect(sql).toContain("setval('public.order_number_seq'")
    expect(sql.split('\n').filter((l) => l.startsWith('insert into public.orders')).every((l) => l.includes(', true, '))).toBe(true)
  })
})
