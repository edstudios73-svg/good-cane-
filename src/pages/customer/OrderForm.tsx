import { useMemo, useState, type FormEvent } from 'react'
import { formatCutoff, formatDay, openBatches } from '../../domain/batches'
import { bottles, formatOrderNumber, isValidPhone } from '../../domain/orders'
import { DELIVERY_AREAS, PICKUP_POINTS, PRODUCTS } from '../../domain/catalog'
import type { Fulfilment, Source } from '../../domain/types'
import { ProductThumb, Stepper } from '../../components/ui'
import { campaignSource, navigate, type Route } from '../../router'
import { useShop } from '../../shop/ShopProvider'

export function OrderForm({ route }: { route: Route }) {
  const { orders, now, me, placeOrder, basket, setBasketQty, clearBasket } = useShop()
  const batches = openBatches(now, 3)
  const from = orders.find((o) => o.id === route.query.get('from'))
  const viaReminder = route.query.get('src') === 'reminder'

  const [batchId, setBatchId] = useState(() => {
    const q = route.query.get('batch')
    return batches.some((b) => b.id === q) ? q! : batches[0].id
  })
  // A repeat order starts from the copied order; otherwise from what was picked on the menu.
  const [qty, setQtyState] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = from ? {} : { ...basket }
    from?.lines.forEach((l) => (init[l.productId] = l.qty))
    const add = route.query.get('add')
    if (add && !from && !init[add]) init[add] = 1
    return init
  })
  const setQty = (next: Record<string, number>) => {
    setQtyState(next)
    if (!from) Object.keys({ ...qty, ...next }).forEach((id) => setBasketQty(id, next[id] ?? 0))
  }
  const [fulfilment, setFulfilment] = useState<Fulfilment>(from?.fulfilment ?? 'pickup')
  const [location, setLocation] = useState(from?.location ?? '')
  const [name, setName] = useState(me?.name ?? '')
  const [phone, setPhone] = useState(me?.phone ?? '')
  const [optIn, setOptIn] = useState(me?.remindersOptIn ?? false)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')

  const lines = PRODUCTS.map((p) => ({ productId: p.id, qty: qty[p.id] ?? 0 })).filter((l) => l.qty > 0)
  const total = bottles(lines)
  const locations = fulfilment === 'pickup' ? PICKUP_POINTS : DELIVERY_AREAS
  const batch = batches.find((b) => b.id === batchId)!

  const existing = useMemo(
    () => orders.find((o) => o.batchId === batchId && o.status !== 'cancelled'),
    [orders, batchId],
  )

  const errors = {
    lines: total === 0 ? 'Add at least one bottle.' : '',
    location: locations.includes(location) ? '' : fulfilment === 'pickup' ? 'Choose where you\'ll pick up.' : 'Choose your area.',
    name: name.trim().length < 2 ? 'We need a name for the order.' : '',
    phone: isValidPhone(phone) ? '' : 'Enter a 10-digit number, like 024 123 4567.',
  }
  const valid = Object.values(errors).every((e) => !e)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!valid || busy) return
    setBusy(true)
    setServerError('')
    const source: Source = from ? (viaReminder ? 'reminder' : 'reorder') : campaignSource()
    try {
      const order = await placeOrder({ name, phone, batchId, lines, fulfilment, location, note, remindersOptIn: optIn, source, reorderOf: from?.id })
      if (!from) clearBasket()
      navigate(`/receipt/${order.id}?new=1`)
    } catch (err) {
      setServerError((err as Error).message)
      setBusy(false)
    }
  }

  const err = (k: keyof typeof errors) => (tried && errors[k] ? <p className="error">{errors[k]}</p> : null)

  return (
    <form className="stack order-form" onSubmit={submit} noValidate>
      <header>
        {from ? (
          <>
            <h1>Order again</h1>
            <p className="small muted">We've copied order {formatOrderNumber(from.number)}. Change anything you like.</p>
          </>
        ) : (
          <h1>Your order</h1>
        )}
      </header>

      <fieldset>
        <legend>Which Saturday?</legend>
        <div className="chips">
          {batches.map((b) => (
            <label key={b.id} className={`chip ${b.id === batchId ? 'on' : ''}`}>
              <input type="radio" name="batch" value={b.id} checked={b.id === batchId} onChange={() => setBatchId(b.id)} />
              <strong>{formatDay(b.productionDate)}</strong>
              <span className="small">order by {formatCutoff(b.cutoff)}</span>
            </label>
          ))}
        </div>
        {existing && (
          <p className="notice small">
            You already have order {formatOrderNumber(existing.number)} for this day. This one will be separate.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>Juices</legend>
        <ul className="pick-list">
          {PRODUCTS.map((p) => (
            <li key={p.id} className={qty[p.id] ? 'on' : ''} style={{ ['--accent' as string]: p.accent }}>
              <ProductThumb product={p} size={52} />
              <span className="pick-name">
                {p.short}
                <span className="small muted">Sugarcane juice</span>
              </span>
              <Stepper label={p.name} value={qty[p.id] ?? 0} onChange={(n) => setQty({ ...qty, [p.id]: n })} />
            </li>
          ))}
        </ul>
        {err('lines')}
      </fieldset>

      <fieldset>
        <legend>Pickup or delivery</legend>
        <div className="segmented">
          {(['pickup', 'delivery'] as const).map((f) => (
            <label key={f} className={fulfilment === f ? 'on' : ''}>
              <input
                type="radio"
                name="fulfilment"
                checked={fulfilment === f}
                onChange={() => {
                  setFulfilment(f)
                  setLocation('')
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
        {fulfilment === 'delivery' && <p className="small muted">We'll call or text for the exact address.</p>}
      </fieldset>

      <fieldset>
        <legend>Your details</legend>
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
        <p className="small muted">We'll text your order number here, and let you know when it's confirmed.</p>
        <label className="field">
          <span>
            Note <span className="muted">(optional)</span>
          </span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. after 2pm please" />
        </label>

        <label className="check">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span>Text me a reminder before orders close each week. You can stop these any time.</span>
        </label>
      </fieldset>

      {serverError && (
        <p className="error" role="alert">
          {serverError}
        </p>
      )}
      <div className="sticky-bar">
        <div>
          <strong>
            {total} bottle{total === 1 ? '' : 's'}
          </strong>
          <span className="small"> for {formatDay(batch.productionDate)}</span>
          <p className="small muted">Pay after we confirm.</p>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Placing…' : 'Place order'}
        </button>
      </div>
    </form>
  )
}
