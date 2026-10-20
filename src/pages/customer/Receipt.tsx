import { batchFromId, formatCutoff, formatDay } from '../../domain/batches'
import { bottles, canCustomerCancel, formatOrderNumber } from '../../domain/orders'
import type { Order, OrderStatus } from '../../domain/types'
import { LinesList, StatusPill } from '../../components/ui'
import { href, type Route } from '../../router'
import { useStore } from '../../store'
import { reorderBatch } from './reorder'

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'requested', label: 'Requested' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'paid', label: 'Paid' },
  { status: 'fulfilled', label: 'Delivered' },
]

const EXPLAIN: Record<OrderStatus, string> = {
  requested: "Your request is in. It isn't confirmed or paid yet — GoodCane will message you on WhatsApp to confirm and arrange payment.",
  confirmed: 'GoodCane has confirmed your bottles for this batch. Payment is arranged directly with GoodCane.',
  paid: "Paid and reserved. We'll see you on batch day.",
  fulfilled: 'Delivered. Enjoy! Order the same again in one tap below.',
  cancelled: 'This order was cancelled. Nothing is owed.',
}

function reached(order: Order, s: OrderStatus): boolean {
  return order.history.some((h) => h.status === s)
}

export function Receipt({ id, route }: { id: string; route: Route }) {
  const { state, now, meCustomer, customerCancel, setReminders } = useStore()
  const order = state.orders.find((o) => o.id === id)
  if (!order) {
    return (
      <div className="card">
        <p>We couldn't find that order on this device.</p>
        <a href={href('/orders')}>Find my orders</a>
      </div>
    )
  }
  const batch = batchFromId(order.batchId)
  const isNew = route.query.get('new') === '1'
  const customer = state.customers.find((c) => c.id === order.customerId)
  const nextOpen = reorderBatch(state.orders, order.customerId, now)

  const cancel = () => {
    if (confirm(`Cancel ${formatOrderNumber(order.number)}? Nothing has been charged.`)) customerCancel(order.id)
  }

  return (
    <div className="stack">
      {isNew && (
        <div className="banner-ok" role="status">
          <strong>Pre-order sent!</strong> Keep this receipt — you can find it again under "My orders".
        </div>
      )}

      <article className="receipt">
        <div className="receipt-head">
          <span className="mono">GOODCANE · PRE-ORDER</span>
          <span className="mono">{formatOrderNumber(order.number)}</span>
        </div>
        <p className="mono small">
          BATCH {formatDay(batch.productionDate).toUpperCase()} · {order.fulfilment === 'pickup' ? 'PICKUP' : 'DELIVERY'}
        </p>
        <p className="small">{order.location}</p>
        <hr />
        <LinesList lines={order.lines} />
        <div className="lines-total mono">
          <span>BOTTLES</span>
          <span>{bottles(order.lines)}</span>
        </div>
        <hr />
        <div className="receipt-status">
          <span className="mono small">STATUS</span>
          <StatusPill status={order.status} />
        </div>
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
        {order.note && <p className="small muted">Note: {order.note}</p>}
        <div className="barcode" aria-hidden="true" />
      </article>

      {canCustomerCancel(order, now) && (
        <button className="btn btn-ghost btn-block" onClick={cancel}>
          Cancel this order
        </button>
      )}
      {canCustomerCancel(order, now) && <p className="small muted center">You can cancel until {formatCutoff(batch.cutoff)}.</p>}

      {isNew && customer && !customer.remindersOptIn && (
        <section className="card">
          <h2>Want a nudge next week?</h2>
          <p className="small">One WhatsApp message before the cutoff with a "Same again?" link. Turn off any time.</p>
          <button className="btn btn-primary btn-block" onClick={() => setReminders(customer.id, true, 'whatsapp')}>
            Yes, remind me
          </button>
        </section>
      )}
      {isNew && customer?.remindersOptIn && <p className="small center">✓ Reminders on. Change this any time in My orders.</p>}

      {order.status !== 'cancelled' && meCustomer?.id === order.customerId && !isNew && (
        <a className="btn btn-pink btn-block" href={href(`/order?from=${order.id}&batch=${nextOpen.id}`)}>
          Same again for {formatDay(nextOpen.productionDate)}
        </a>
      )}
      <a className="btn btn-ghost btn-block" href={href('/orders')}>
        My orders
      </a>
    </div>
  )
}
