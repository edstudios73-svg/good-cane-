import { isOpen } from './batches'
import type { Actor, Order, OrderLine, OrderStatus } from './types'

/** Statuses that count as firm demand (GoodCane has accepted the order). */
export const FIRM: readonly OrderStatus[] = ['confirmed', 'paid', 'fulfilled']

export const STATUS_LABEL: Record<OrderStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  paid: 'Paid',
  fulfilled: 'Delivered',
  cancelled: 'Cancelled',
}

/** Allowed business transitions. Payment is recorded manually — no live payments. */
const BUSINESS_NEXT: Record<OrderStatus, OrderStatus[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['paid', 'cancelled'],
  paid: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
}

export function businessActions(order: Order): OrderStatus[] {
  return BUSINESS_NEXT[order.status]
}

/** Customers can cancel unpaid orders until the batch cutoff. */
export function canCustomerCancel(order: Order, now: Date): boolean {
  return (order.status === 'requested' || order.status === 'confirmed') && isOpen(order.batchId, now)
}

export function transition(order: Order, to: OrderStatus, by: Actor, now: Date, note?: string): Order {
  const allowed = by === 'business' ? businessActions(order).includes(to) : to === 'cancelled' && canCustomerCancel(order, now)
  if (!allowed) throw new Error(`${by} cannot move order #${order.number} from ${order.status} to ${to}`)
  return {
    ...order,
    status: to,
    history: [...order.history, { status: to, at: now.toISOString(), by, note }],
  }
}

export function bottles(lines: OrderLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0)
}

export function cleanLines(lines: OrderLine[]): OrderLine[] {
  return lines.filter((l) => l.qty > 0).map((l) => ({ productId: l.productId, qty: Math.floor(l.qty) }))
}

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Treat +233XXXXXXXXX and 0XXXXXXXXX as the same Ghanaian number.
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3)
  return digits
}

export function isValidPhone(raw: string): boolean {
  return /^0\d{9}$/.test(normalisePhone(raw))
}

export function formatOrderNumber(n: number): string {
  return '#' + String(n).padStart(4, '0')
}
