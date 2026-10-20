import { useState, type FormEvent } from 'react'
import { batchFromId, formatDay } from '../../domain/batches'
import { bottles, formatOrderNumber, isValidPhone } from '../../domain/orders'
import { LinesList, StatusPill, productName } from '../../components/ui'
import { href } from '../../router'
import { useShop } from '../../shop/ShopProvider'
import { lastReorderable, reorderBatch } from './reorder'

function SignIn() {
  const { requestCode, verifyCode } = useShop()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidPhone(phone)) return setError('Enter the 10-digit number you ordered with.')
    void run(async () => {
      await requestCode(phone)
      setSent(true)
    })
  }

  const verify = (e: FormEvent) => {
    e.preventDefault()
    void run(() => verifyCode(phone, code))
  }

  return (
    <div className="stack">
      <header>
        <h1>My orders</h1>
        <p className="small muted">{sent ? `If ${phone} has ordered with us, a 6-digit code is on its way.` : "We'll text you a code to sign in."}</p>
      </header>
      {!sent ? (
        <form className="stack" onSubmit={send} noValidate>
          <label className="field">
            <span>Phone number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="024 123 4567" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sending…' : 'Text me a code'}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify} noValidate>
          <label className="field">
            <span>Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="code-input"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="link small" onClick={() => setSent(false)}>
            Use a different number
          </button>
        </form>
      )}
    </div>
  )
}

export function MyOrders() {
  const { ready, orders, now, me, signOut, setReminders, forgetMe } = useShop()
  if (!ready) return <p className="small muted">Loading…</p>
  if (!me) return <SignIn />

  const last = lastReorderable(orders, me.id)
  const next = reorderBatch(orders, me.id, now)
  const forget = () => {
    if (confirm('Remove your name and number from GoodCane? Any unpaid orders that are still open will be cancelled.')) void forgetMe()
  }

  return (
    <div className="stack">
      <header>
        <h1>Hi {me.name.split(' ')[0]}</h1>
      </header>

      {last && (
        <section className="again">
          <p className="small muted">Your last order, {formatOrderNumber(last.number)}</p>
          <LinesList lines={last.lines} />
          <a className="btn btn-primary btn-block" href={href(`/order?from=${last.id}&batch=${next.id}`)}>
            Order this again for {formatDay(next.productionDate)}
          </a>
        </section>
      )}

      <section className="card">
        <h2>Orders</h2>
        {orders.length === 0 && <p className="small muted">No orders yet.</p>}
        <ul className="history">
          {orders.map((o) => (
            <li key={o.id}>
              <a href={href(`/receipt/${o.id}`)}>
                <span className="mono small muted">{formatOrderNumber(o.number)}</span>
                <span className="history-main">
                  <span>{o.lines.map((l) => productName(l.productId).replace(' Sugarcane', '')).join(', ')}</span>
                  <span className="small muted">
                    {formatDay(batchFromId(o.batchId).productionDate)} · {bottles(o.lines)} bottle{bottles(o.lines) === 1 ? '' : 's'}
                  </span>
                </span>
                <StatusPill status={o.status} customer />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Text reminders</h2>
        <label className="check">
          <input type="checkbox" checked={me.remindersOptIn} onChange={(e) => void setReminders(e.target.checked)} />
          <span>Text me before orders close each week. At most one a week.</span>
        </label>
        <p className="small muted">Order updates still come by text whatever you choose here.</p>
      </section>

      <div className="row-between small">
        <button className="link" onClick={signOut}>
          Sign out
        </button>
        <button className="link danger" onClick={forget}>
          Remove my details
        </button>
      </div>
    </div>
  )
}
