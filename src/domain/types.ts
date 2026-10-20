// Core data model. Everything that ships in the demo is SAMPLE data — see seed.ts.

export interface Product {
  id: string
  name: string
  description: string
  /** Liquid colour used for the bottle illustration. */
  colour: string
}

/**
 * Order lifecycle. A "request" is not a sale: it only becomes firm demand once
 * GoodCane confirms it, and "paid" is marked by hand because no payment
 * integration is connected.
 */
export type OrderStatus = 'requested' | 'confirmed' | 'paid' | 'fulfilled' | 'cancelled'

export type Actor = 'customer' | 'business'

export type Fulfilment = 'pickup' | 'delivery'

export type Source = 'tiktok' | 'instagram' | 'whatsapp' | 'direct' | 'reorder' | 'reminder'

export interface OrderLine {
  productId: string
  qty: number
}

export interface StatusChange {
  status: OrderStatus
  at: string
  by: Actor
  note?: string
}

export interface Order {
  id: string
  /** Short human number shown on receipts, e.g. #0042. */
  number: number
  customerId: string
  /** Batch id = ISO date (YYYY-MM-DD) of the production day. */
  batchId: string
  lines: OrderLine[]
  fulfilment: Fulfilment
  /** Pickup point or delivery area label (sample placeholders only). */
  location: string
  note?: string
  status: OrderStatus
  history: StatusChange[]
  source: Source
  /** Set when the order was created with "Same again?". */
  reorderOf?: string
  createdAt: string
  sample: boolean
}

export interface Customer {
  id: string
  name: string
  /** Digits only. Used as the lookup key — production would verify by OTP. */
  phone: string
  remindersOptIn: boolean
  reminderChannel: 'whatsapp' | 'sms'
  createdAt: string
  sample: boolean
}

/** What actually happened for a batch, entered by the business after production. */
export interface BatchRecord {
  batchId: string
  /** Bottles the forecast suggested at cutoff (snapshot). */
  forecast?: number
  produced?: number
  sold?: number
}

/** Reminders are never sent by the prototype — only previewed and logged. */
export interface ReminderLog {
  id: string
  customerId: string
  batchId: string
  at: string
  message: string
}

export interface AppState {
  version: number
  nextOrderNumber: number
  customers: Customer[]
  orders: Order[]
  batchRecords: BatchRecord[]
  reminderLog: ReminderLog[]
}
