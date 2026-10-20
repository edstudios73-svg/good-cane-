// Shapes shared by the shop, the staff dashboard and the database functions.

export interface Product {
  id: string
  name: string
  /** Name without "Sugarcane", for compact two-line titles. */
  short: string
  /** Longer copy for the flavour page. */
  about: string
  /** Bottle cut out of the photo, on white — sits on `tint` via multiply. */
  bottle: string
  /** What's in it, as printed on the label. */
  ingredients: string
  description: string
  /** Label colour, used as the flavour's accent. */
  accent: string
  /** Light tint of the label colour for backgrounds. */
  tint: string
  image: string
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
  /** Lets the person who placed the order view it without signing in. */
  viewToken?: string
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

export type SmsKind = 'received' | 'confirmed' | 'paid' | 'fulfilled' | 'cancelled' | 'reminder' | 'login_code'

/** skipped = not handed to the provider (sample customer, or SMS not configured). */
export type SmsStatus = 'queued' | 'sent' | 'failed' | 'skipped'

export interface SmsLog {
  id: string
  customerId: string | null
  orderId?: string | null
  batchId: string | null
  kind: SmsKind
  to: string
  body: string
  status: SmsStatus
  at: string
  error?: string | null
}

/** The signed-in shopper, as the shop sees them. */
export interface Me {
  id: string
  name: string
  phone: string
  remindersOptIn: boolean
}

export interface AppState {
  customers: Customer[]
  orders: Order[]
  batchRecords: BatchRecord[]
  smsLog: SmsLog[]
}
