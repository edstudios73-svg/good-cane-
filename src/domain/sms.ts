import { batchFromId } from './batches'
import { formatOrderNumber } from './orders'
import type { SmsKind } from './types'

// Same wording as public.sms_text() in the database, which sends the real
// texts. Used here to preview messages in the staff dashboard.

export const SMS_KINDS: readonly SmsKind[] = ['received', 'confirmed', 'paid', 'fulfilled', 'cancelled', 'reminder']

export interface SmsContext {
  orderNumber?: number
  batchId: string
  bottles?: number
}

// Fixed wording rather than Intl, so the browser and server write identical texts.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const shortDay = (batchId: string) => {
  const d = batchFromId(batchId).productionDate
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

const cutoffText = (batchId: string) => {
  const c = batchFromId(batchId).cutoff
  const h = c.getHours()
  return `${DAYS[c.getDay()]} ${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`
}

export function smsBody(kind: SmsKind, ctx: SmsContext): string {
  const no = ctx.orderNumber != null ? formatOrderNumber(ctx.orderNumber) : ''
  const day = shortDay(ctx.batchId)
  switch (kind) {
    case 'received':
      return `GoodCane: Order ${no} received for ${day} (${ctx.bottles} bottle${ctx.bottles === 1 ? '' : 's'}). We'll text you when it's confirmed.`
    case 'confirmed':
      return `GoodCane: Order ${no} is confirmed for ${day}. We'll be in touch about payment.`
    case 'paid':
      return `GoodCane: Payment received for order ${no}. See you on ${day}.`
    case 'fulfilled':
      return `GoodCane: Order ${no} is done. Enjoy! You can order again any time before ${cutoffText(ctx.batchId)}.`
    case 'cancelled':
      return `GoodCane: Order ${no} has been cancelled. Nothing is owed.`
    case 'reminder':
      return `GoodCane: Orders for ${day} close ${cutoffText(ctx.batchId)}. Want your usual? Reply STOP to opt out.`
    case 'login_code':
      return 'GoodCane: Your code is ••••••.'
  }
}

/** 0241234567 -> 233241234567, the format SMS providers expect. */
export function toIntl(localPhone: string): string {
  const d = localPhone.replace(/\D/g, '')
  return d.startsWith('0') ? '233' + d.slice(1) : d
}

export function maskPhone(localPhone: string): string {
  return localPhone.length === 10 ? `${localPhone.slice(0, 3)} *** ${localPhone.slice(-4)}` : localPhone
}
