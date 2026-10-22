import { formatOrderNumber } from '../../domain/orders'
import { BellIcon } from '../../components/icons'
import { href } from '../../router'
import { useShop } from '../../shop/ShopProvider'
import { SignIn } from './MyOrders'

export function Account() {
  const { ready, me, orders, signOut, setReminders, forgetMe, flash } = useShop()
  if (!ready) return <p className="empty">Loading…</p>
  if (!me) return <SignIn title="Sign in" />

  const forget = () => {
    if (confirm('Remove your name and number from GoodCane? Any unpaid orders that are still open will be cancelled.')) void forgetMe()
  }
  const latest = orders[0]

  return (
    <div className="account">
      <div className="page-head">
        <h1>Hi {me.name.split(' ')[0]}</h1>
      </div>

      <section className="panel profile">
        <div className="avatar" aria-hidden="true">
          {me.name.trim()[0]?.toUpperCase()}
        </div>
        <div>
          <strong>{me.name}</strong>
          <span>{me.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</span>
        </div>
      </section>

      <section className="panel">
        <div className="row-between">
          <h2>
            <BellIcon width={18} height={18} /> Weekly reminder
          </h2>
          <label className="switch-toggle">
            <input
              type="checkbox"
              checked={me.remindersOptIn}
              onChange={async (e) => {
                await setReminders(e.target.checked)
                flash(e.target.checked ? "We'll text you before orders close" : 'Reminders off')
              }}
            />
            <span aria-hidden="true" />
            <span className="sr-only">Text me before orders close</span>
          </label>
        </div>
        <p className="fine">One text before orders close each week. Order updates still come by SMS either way.</p>
      </section>

      <section className="panel links">
        <a href={href('/orders')}>
          My orders {latest && <span className="muted">· last {formatOrderNumber(latest.number)}</span>}
        </a>
        <button onClick={signOut}>Sign out on this phone</button>
        <button className="danger" onClick={forget}>
          Remove my details
        </button>
      </section>
    </div>
  )
}
