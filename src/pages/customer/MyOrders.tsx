import { useState, type FormEvent } from 'react'
import { batchFromId, formatDay } from '../../domain/batches'
import { bottles, formatOrderNumber, isValidPhone, normalisePhone } from '../../domain/orders'
import { LinesList, StatusPill, productName } from '../../components/ui'
import { href } from '../../router'
import { useStore } from '../../store'
import { lastReorderable, reorderBatch } from './reorder'

function Lookup() {
  const { state, setMe } = useStore()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidPhone(phone)) return setError('Enter the 10-digit number you ordered with.')
    if (!state.customers.some((c) => c.phone === normalisePhone(phone))) return setError("We couldn't find orders for that number.")
    setMe(phone)
  }
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <header>
        <p className="eyebrow mono">My orders</p>
        <h1>Find your orders</h1>
        <p className="small">Enter the number you used when you pre-ordered.</p>
      </header>
      <label className="field">
        <span>WhatsApp / phone number</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="024 123 4567" />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary btn-block">Show my orders</button>
      <p className="small muted">
        Prototype note: a live version would send a one-time code to this number before showing orders. Demo tip: sample customers use
        numbers 0000000001 to 0000000016.
      </p>
    </form>
  )
}

export function MyOrders() {
  const { state, now, meCustomer, setMe, setReminders, forgetCustomer } = useStore()
  if (!meCustomer) return <Lookup />

  const mine = state.orders.filter((o) => o.customerId === meCustomer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const last = lastReorderable(state.orders, meCustomer.id)
  const next = reorderBatch(state.orders, meCustomer.id, now)
  const forget = () => {
    if (confirm('Delete your name and number from GoodCane? Unpaid orders for open batches will be cancelled.')) forgetCustomer(meCustomer.id)
  }

  return (
    <div className="stack">
      <header>
        <p className="eyebrow mono">My orders</p>
        <h1>Hi {meCustomer.name.split(' ')[0]}</h1>
      </header>

      {last && (
        <section className="card again">
          <p className="mono small">YOUR LAST ORDER · {formatOrderNumber(last.number)}</p>
          <LinesList lines={last.lines} />
          <a className="btn btn-pink btn-block" href={href(`/order?from=${last.id}&batch=${next.id}`)}>
            Same again for {formatDay(next.productionDate)}
          </a>
        </section>
      )}

      <article className="receipt">
        <div className="receipt-head">
          <span className="mono">ORDER HISTORY</span>
          <span className="mono">{mine.length}</span>
        </div>
        {mine.length === 0 && <p className="small">No orders yet.</p>}
        <ul className="history">
          {mine.map((o) => (
            <li key={o.id}>
              <a href={href(`/receipt/${o.id}`)}>
                <span className="mono small">{formatOrderNumber(o.number)}</span>
                <span className="history-main">
                  <span>{o.lines.map((l) => productName(l.productId)).join(', ')}</span>
                  <span className="small muted">
                    {formatDay(batchFromId(o.batchId).productionDate)} · {bottles(o.lines)} bottle{bottles(o.lines) === 1 ? '' : 's'}
                  </span>
                </span>
                <StatusPill status={o.status} />
              </a>
            </li>
          ))}
        </ul>
      </article>

      <section className="card">
        <h2>Reminders</h2>
        <label className="check">
          <input type="checkbox" checked={meCustomer.remindersOptIn} onChange={(e) => setReminders(meCustomer.id, e.target.checked)} />
          <span>Remind me before each weekly cutoff (at most once a week).</span>
        </label>
        {meCustomer.remindersOptIn && (
          <div className="segmented small-seg">
            {(['whatsapp', 'sms'] as const).map((c) => (
              <label key={c} className={meCustomer.reminderChannel === c ? 'on' : ''}>
                <input type="radio" name="ch" checked={meCustomer.reminderChannel === c} onChange={() => setReminders(meCustomer.id, true, c)} />
                {c === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="row-between small">
        <button className="link" onClick={() => setMe(null)}>
          Not you? Sign out
        </button>
        <button className="link danger" onClick={forget}>
          Delete my details
        </button>
      </div>
    </div>
  )
}
