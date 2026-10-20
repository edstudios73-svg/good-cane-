import { useMemo, useState, type FormEvent } from 'react'
import { formatCutoff, formatDay, openBatches } from '../../domain/batches'
import { bottles, formatOrderNumber, isValidPhone } from '../../domain/orders'
import { DELIVERY_AREAS, PICKUP_POINTS, PRODUCTS } from '../../domain/seed'
import type { Fulfilment, Source } from '../../domain/types'
import { Bottle, Stepper } from '../../components/ui'
import { campaignSource, navigate, type Route } from '../../router'
import { useStore } from '../../store'

export function OrderForm({ route }: { route: Route }) {
  const { state, now, meCustomer, placeOrder } = useStore()
  const batches = openBatches(now, 3)
  const from = state.orders.find((o) => o.id === route.query.get('from'))
  const viaReminder = route.query.get('src') === 'reminder'

  const [batchId, setBatchId] = useState(() => {
    const q = route.query.get('batch')
    return batches.some((b) => b.id === q) ? q! : batches[0].id
  })
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    from?.lines.forEach((l) => (init[l.productId] = l.qty))
    const add = route.query.get('add')
    if (add && !from) init[add] = 1
    return init
  })
  const [fulfilment, setFulfilment] = useState<Fulfilment>(from?.fulfilment ?? 'pickup')
  const [location, setLocation] = useState(from?.location ?? '')
  const [name, setName] = useState(meCustomer?.name ?? '')
  const [phone, setPhone] = useState(meCustomer?.phone ?? '')
  const [optIn, setOptIn] = useState(meCustomer?.remindersOptIn ?? false)
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>(meCustomer?.reminderChannel ?? 'whatsapp')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  const lines = PRODUCTS.map((p) => ({ productId: p.id, qty: qty[p.id] ?? 0 })).filter((l) => l.qty > 0)
  const total = bottles(lines)
  const locations = fulfilment === 'pickup' ? PICKUP_POINTS : DELIVERY_AREAS
  const batch = batches.find((b) => b.id === batchId)!

  const existing = useMemo(
    () => meCustomer && state.orders.find((o) => o.customerId === meCustomer.id && o.batchId === batchId && o.status !== 'cancelled'),
    [state.orders, meCustomer, batchId],
  )

  const errors = {
    lines: total === 0 ? 'Choose at least one bottle.' : '',
    location: locations.includes(location) ? '' : fulfilment === 'pickup' ? 'Choose a pickup point.' : 'Choose a delivery area.',
    name: name.trim().length < 2 ? 'Add your name so GoodCane knows who the order is for.' : '',
    phone: isValidPhone(phone) ? '' : 'Enter a 10-digit number, e.g. 024 123 4567.',
  }
  const valid = Object.values(errors).every((e) => !e)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!valid) return
    const source: Source = from ? (viaReminder ? 'reminder' : 'reorder') : campaignSource()
    const order = placeOrder({
      name,
      phone,
      batchId,
      lines,
      fulfilment,
      location,
      note,
      remindersOptIn: optIn,
      reminderChannel: channel,
      source,
      reorderOf: from?.id,
    })
    navigate(`/receipt/${order.id}?new=1`)
  }

  const err = (k: keyof typeof errors) => (tried && errors[k] ? <p className="error">{errors[k]}</p> : null)

  return (
    <form className="stack order-form" onSubmit={submit} noValidate>
      <header>
        {from ? (
          <>
            <p className="eyebrow mono">Same again? · copied {formatOrderNumber(from.number)}</p>
            <h1>Your usual, ready to go</h1>
            <p className="small">Change anything you like, then send.</p>
          </>
        ) : (
          <>
            <p className="eyebrow mono">Pre-order</p>
            <h1>Reserve your bottles</h1>
          </>
        )}
      </header>

      <fieldset>
        <legend>1. Which batch?</legend>
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
            You already have {formatOrderNumber(existing.number)} for this batch. This will be an extra order.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>2. Flavours</legend>
        <ul className="pick-list">
          {PRODUCTS.map((p) => (
            <li key={p.id} className={qty[p.id] ? 'on' : ''}>
              <Bottle colour={p.colour} size={44} />
              <span className="pick-name">{p.name}</span>
              <Stepper label={p.name} value={qty[p.id] ?? 0} onChange={(n) => setQty({ ...qty, [p.id]: n })} />
            </li>
          ))}
        </ul>
        <p className="small muted">Bottle size and price to be confirmed by GoodCane.</p>
        {err('lines')}
      </fieldset>

      <fieldset>
        <legend>3. Pickup or delivery</legend>
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
          <span>{fulfilment === 'pickup' ? 'Pickup point' : 'Delivery area'}</span>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Choose…</option>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        {err('location')}
        {fulfilment === 'delivery' && <p className="small muted">GoodCane will ask for the exact address on WhatsApp — we don't store it here.</p>}
      </fieldset>

      <fieldset>
        <legend>4. Your details</legend>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </label>
        {err('name')}
        <label className="field">
          <span>WhatsApp / phone number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="024 123 4567" />
        </label>
        {err('phone')}
        <label className="field">
          <span>
            Note <span className="muted">(optional)</span>
          </span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. after 2pm please" />
        </label>

        <label className="check">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span>
            <strong>Remind me before next week's cutoff.</strong> One message a week at most. Turn off any time.
          </span>
        </label>
        {optIn && (
          <div className="segmented small-seg">
            {(['whatsapp', 'sms'] as const).map((c) => (
              <label key={c} className={channel === c ? 'on' : ''}>
                <input type="radio" name="channel" checked={channel === c} onChange={() => setChannel(c)} />
                {c === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </label>
            ))}
          </div>
        )}
        <p className="small muted">We only use your name and number to confirm this order{optIn ? ' and send your reminder' : ''}.</p>
      </fieldset>

      <div className="sticky-bar">
        <div>
          <strong>
            {total} bottle{total === 1 ? '' : 's'}
          </strong>
          <span className="small"> · {formatDay(batch.productionDate)}</span>
          <p className="small muted">No payment now — GoodCane confirms first.</p>
        </div>
        <button className="btn btn-primary" type="submit">
          Send pre-order
        </button>
      </div>
    </form>
  )
}
