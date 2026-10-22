import { useState, type FormEvent } from 'react'
import { batchFromId, formatDay } from '../../domain/batches'
import { bottles, formatOrderNumber, isValidPhone } from '../../domain/orders'
import { LinesList, StatusPill, productById, productName } from '../../components/ui'
import { href } from '../../router'
import { useShop } from '../../shop/ShopProvider'
import { lastReorderable } from './reorder'

export function SignIn({ title = 'My orders' }: { title?: string }) {
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
        <h1>{title}</h1>
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
  const { ready, orders, me } = useShop()
  if (!ready) return <p className="empty">Loading…</p>
  if (!me) return <SignIn />

  const last = lastReorderable(orders, me.id)

  return (
    <div className="orders-page">
      <div className="page-head">
        <h1>My orders</h1>
        <a className="text-btn" href={href('/account')}>
          {me.name.split(' ')[0]}
        </a>
      </div>

      {last && (
        <section className="again">
          <div>
            <h2>Your usual</h2>
            <LinesList lines={last.lines} />
          </div>
          <a className="pill-btn dark" href={href(`/order?from=${last.id}`)}>
            Order this again
          </a>
        </section>
      )}

      {orders.length === 0 ? (
        <p className="empty">No orders yet.</p>
      ) : (
        <ul className="order-list">
          {orders.map((o) => {
            const first = productById(o.lines[0]?.productId ?? '')
            return (
              <li key={o.id}>
                <a href={href(`/receipt/${o.id}`)} className="order-item">
                  <span className="cart-thumb" style={{ background: first?.tint }}>
                    {first && <img src={first.bottle} alt="" />}
                  </span>
                  <span className="order-item-main">
                    <strong>
                      {formatOrderNumber(o.number)} · {formatDay(batchFromId(o.batchId).productionDate)}
                    </strong>
                    <span>
                      {o.lines.map((l) => productName(l.productId).replace(' Sugarcane', '')).join(', ')} · {bottles(o.lines)} bottle
                      {bottles(o.lines) === 1 ? '' : 's'}
                    </span>
                  </span>
                  <StatusPill status={o.status} customer />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
