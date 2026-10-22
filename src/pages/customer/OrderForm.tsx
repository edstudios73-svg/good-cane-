import { useMemo, useState, type FormEvent } from 'react'
import { formatCutoff, formatDay, openBatches } from '../../domain/batches'
import { bottles, formatOrderNumber, isValidPhone } from '../../domain/orders'
import { DELIVERY_AREAS, PICKUP_POINTS, PRODUCTS } from '../../domain/catalog'
import type { Fulfilment, Source } from '../../domain/types'
import { BackIcon } from '../../components/icons'
import { campaignSource, href, navigate, type Route } from '../../router'
import { useShop } from '../../shop/ShopProvider'

export function OrderForm({ route }: { route: Route }) {
  const { orders, now, me, placeOrder, basket, clearBasket } = useShop()
  const batches = openBatches(now, 3)
  const from = orders.find((o) => o.id === route.query.get('from'))
  const viaReminder = route.query.get('src') === 'reminder'

  const [batchId, setBatchId] = useState(() => {
    const q = route.query.get('batch')
    return batches.some((b) => b.id === q) ? q! : batches[0].id
  })
  const [fulfilment, setFulfilment] = useState<Fulfilment>(from?.fulfilment ?? 'pickup')
  const [location, setLocation] = useState(from?.location ?? PICKUP_POINTS[0])
  const [name, setName] = useState(me?.name ?? '')
  const [phone, setPhone] = useState(me?.phone ?? '')
  const [optIn, setOptIn] = useState(me?.remindersOptIn ?? false)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')

  const items = PRODUCTS.filter((p) => basket[p.id])
  const lines = items.map((p) => ({ productId: p.id, qty: basket[p.id] }))
  const total = bottles(lines)
  const locations = fulfilment === 'pickup' ? PICKUP_POINTS : DELIVERY_AREAS
  const batch = batches.find((b) => b.id === batchId)!
  const existing = useMemo(() => orders.find((o) => o.batchId === batchId && o.status !== 'cancelled'), [orders, batchId])

  const errors = {
    location: locations.includes(location) ? '' : fulfilment === 'pickup' ? "Choose where you'll pick up." : 'Choose your area.',
    name: name.trim().length < 2 ? 'We need a name for the order.' : '',
    phone: isValidPhone(phone) ? '' : 'Enter a 10-digit number, like 024 123 4567.',
  }
  const valid = total > 0 && Object.values(errors).every((e) => !e)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!valid || busy) return
    setBusy(true)
    setServerError('')
    const source: Source = from ? (viaReminder ? 'reminder' : 'reorder') : campaignSource()
    try {
      const order = await placeOrder({ name, phone, batchId, lines, fulfilment, location, note, remindersOptIn: optIn, source, reorderOf: from?.id })
      clearBasket()
      navigate(`/receipt/${order.id}?new=1`)
    } catch (err) {
      setServerError((err as Error).message)
      setBusy(false)
    }
  }

  const err = (k: keyof typeof errors) => (tried && errors[k] ? <p className="error">{errors[k]}</p> : null)

  if (total === 0) {
    return (
      <div className="empty-cart">
        <h2>Your order is empty</h2>
        <a className="pill-btn dark big" href={href('/')}>
          See the menu
        </a>
      </div>
    )
  }

  return (
    <form className="checkout" onSubmit={submit} noValidate>
      <div className="detail-bar">
        <a className="round-btn" href={href('/cart')} aria-label="Back to your order">
          <BackIcon />
        </a>
        <span className="detail-bar-title">Checkout</span>
        <span className="round-btn ghost" aria-hidden="true" />
      </div>

      <div className="checkout-grid">
        <div className="checkout-main">
          <section className="panel">
            <h2>Which Saturday?</h2>
            <div className="day-chips">
              {batches.map((b) => (
                <label key={b.id} className={`day-chip ${b.id === batchId ? 'on' : ''}`}>
                  <input type="radio" name="batch" value={b.id} checked={b.id === batchId} onChange={() => setBatchId(b.id)} />
                  <strong>{formatDay(b.productionDate)}</strong>
                  <span>order by {formatCutoff(b.cutoff)}</span>
                </label>
              ))}
            </div>
            {existing && <p className="note">You already have order {formatOrderNumber(existing.number)} for this day. This one will be separate.</p>}
          </section>

          <section className="panel">
            <h2>Pickup or delivery</h2>
            <div className="segmented">
              {(['pickup', 'delivery'] as const).map((f) => (
                <label key={f} className={fulfilment === f ? 'on' : ''}>
                  <input
                    type="radio"
                    name="fulfilment"
                    checked={fulfilment === f}
                    onChange={() => {
                      setFulfilment(f)
                      setLocation(f === 'pickup' ? PICKUP_POINTS[0] : '')
                    }}
                  />
                  {f === 'pickup' ? 'Pickup' : 'Delivery'}
                </label>
              ))}
            </div>
            <label className="field">
              <span>{fulfilment === 'pickup' ? 'Pick up from' : 'Area'}</span>
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">Choose…</option>
                {locations.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            {err('location')}
            {fulfilment === 'delivery' && <p className="fine">We'll call or text for the exact address.</p>}
          </section>

          <section className="panel">
            <h2>Your details</h2>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            </label>
            {err('name')}
            <label className="field">
              <span>Phone number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="024 123 4567" />
            </label>
            {err('phone')}
            <p className="fine">Your order number and updates come by SMS to this number.</p>
            <label className="field">
              <span>
                Note <span className="muted">(optional)</span>
              </span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. after 2pm please" />
            </label>
            <label className="check">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              <span>Text me a reminder before orders close each week. Stop any time.</span>
            </label>
          </section>
        </div>

        <aside className="summary">
          <h2>Your order</h2>
          <ul className="mini-lines">
            {items.map((p) => (
              <li key={p.id}>
                <span className="mini-thumb" style={{ background: p.tint }}>
                  <img src={p.bottle} alt="" />
                </span>
                <span>{p.short}</span>
                <strong>× {basket[p.id]}</strong>
              </li>
            ))}
          </ul>
          <div className="summary-line dashed">
            <span>Bottles</span>
            <strong>{total}</strong>
          </div>
          <div className="summary-line">
            <span>Collect</span>
            <strong>{formatDay(batch.productionDate)}</strong>
          </div>
          <div className="summary-line total">
            <span>Payment</span>
            <strong>After we confirm</strong>
          </div>
          {serverError && (
            <p className="error" role="alert">
              {serverError}
            </p>
          )}
          <button className="pill-btn dark big block" type="submit" disabled={busy}>
            {busy ? 'Placing your order…' : 'Place order'}
          </button>
        </aside>
      </div>
    </form>
  )
}
