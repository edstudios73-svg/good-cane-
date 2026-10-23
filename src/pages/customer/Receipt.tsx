import { useEffect, useState } from 'react'
import { batchFromId, formatClose, formatDate } from '../../domain/batches'
import { bottles, canCustomerCancel, formatOrderNumber } from '../../domain/orders'
import { maskPhone } from '../../domain/sms'
import type { Order, OrderStatus, SmsLog } from '../../domain/types'
import { LinesList, StatusPill } from '../../components/ui'
import { href, type Route } from '../../router'
import { useShop } from '../../shop/ShopProvider'
import { reorderBatch } from './reorder'

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'requested', label: 'Received' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'paid', label: 'Paid' },
  { status: 'fulfilled', label: 'Collected' },
]

const EXPLAIN: Record<OrderStatus, string> = {
  requested: "We've got your order but haven't confirmed it yet. You'll get a text once we do, and that's when you pay.",
  confirmed: "Your bottles are set aside. We'll be in touch about payment.",
  paid: 'All paid. See you on the day.',
  fulfilled: 'Enjoy! You can order the same again below.',
  cancelled: 'This order was cancelled. You owe nothing.',
}

const reached = (order: Order, s: OrderStatus) => order.history.some((h) => h.status === s)

function smsLine(m: SmsLog | undefined): string | null {
  if (!m || !m.to) return null
  const to = maskPhone(m.to)
  if (m.status === 'sent') return `Order number texted to ${to}.`
  if (m.status === 'queued') return `Texting your order number to ${to}…`
  return `We couldn't text ${to}, so keep this page for your order number.`
}

export function Receipt({ id, route }: { id: string; route: Route }) {
  const { now, me, orders, loadOrder, placedHere, cancelOrder, setReminders } = useShop()
  const [data, setData] = useState<{ order: Order; sms: SmsLog[] } | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    const load = () => loadOrder(id).then((d) => live && setData(d)).catch(() => live && setData(null))
    void load()
    // The SMS provider answers a moment later; check once more for the delivery result.
    const t = setTimeout(load, 4000)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [id, loadOrder])

  if (data === undefined) return <p className="small muted">Loading your order…</p>
  if (!data) {
    return (
      <div className="card">
        <p>We couldn't find that order on this phone.</p>
        <a href={href('/orders')}>Sign in to see your orders</a>
      </div>
    )
  }

  const { order } = data
  const batch = batchFromId(order.batchId)
  const isNew = route.query.get('new') === '1'
  const firstText = data.sms.find((m) => m.kind === 'received')
  const inAccount = orders.some((o) => o.id === order.id)
  const mine = (me && inAccount) || placedHere(order.id)
  const nextOpen = reorderBatch(inAccount ? orders : [...orders, order], order.customerId, now)

  const cancel = async () => {
    if (!confirm(`Cancel order ${formatOrderNumber(order.number)}?`)) return
    setBusy(true)
    setError('')
    try {
      await cancelOrder(order)
      setData(await loadOrder(order.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      {isNew && (
        <div className="banner-ok" role="status">
          <span>
            <strong>Thanks{me ? `, ${me.name.split(' ')[0]}` : ''}.</strong> Your order number is {formatOrderNumber(order.number)}.
          </span>
        </div>
      )}

      <article className="receipt">
        <div className="receipt-head">
          <span className="mono">Order {formatOrderNumber(order.number)}</span>
          <StatusPill status={order.status} customer />
        </div>
        <p className="small muted">
          {formatDate(batch.productionDate)} · {order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'} · {order.location}
        </p>
        <hr />
        <LinesList lines={order.lines} />
        <div className="lines-total">
          <span>Bottles</span>
          <span>{bottles(order.lines)}</span>
        </div>
        <hr />
        {order.status !== 'cancelled' && (
          <ol className="timeline" aria-label="Order progress">
            {STEPS.map((s) => (
              <li key={s.status} className={reached(order, s.status) ? 'done' : ''}>
                {s.label}
              </li>
            ))}
          </ol>
        )}
        <p className="small">{EXPLAIN[order.status]}</p>
        {order.note && <p className="small muted">Your note: {order.note}</p>}
        {smsLine(firstText) && <p className="sms-line small">{smsLine(firstText)}</p>}
      </article>

      {error && <p className="error">{error}</p>}
      {canCustomerCancel(order, now) && (
        <>
          <button className="btn btn-ghost btn-block" onClick={() => void cancel()} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel order'}
          </button>
          <p className="small muted center">You can cancel until {formatClose(batch.cutoff)}.</p>
        </>
      )}

      {isNew && me && !me.remindersOptIn && (
        <section className="card">
          <h2>Want a reminder next week?</h2>
          <p className="small muted">One text before orders close. Stop any time.</p>
          <button className="btn btn-primary btn-block" onClick={() => void setReminders(true)}>
            Yes, text me
          </button>
        </section>
      )}

      {order.status !== 'cancelled' && mine && !isNew && (
        <a className="btn btn-primary btn-block" href={href(`/order?from=${order.id}&batch=${nextOpen.id}`)}>
          Order this again for {formatDate(nextOpen.productionDate)}
        </a>
      )}
      <a className="btn btn-ghost btn-block" href={href('/orders')}>
        My orders
      </a>
    </div>
  )
}
