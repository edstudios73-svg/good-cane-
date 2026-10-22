import { useState, type FormEvent } from 'react'
import { Logo } from './components/ui'
import { PRODUCTS } from './domain/catalog'
import { Demand } from './pages/business/Demand'
import { Messages } from './pages/business/Messages'
import { Orders } from './pages/business/Orders'
import { Results } from './pages/business/Results'
import { href, useRoute } from './router'
import { useStaff } from './staff/StaffProvider'

const TABS = [
  { id: 'demand', label: 'Demand' },
  { id: 'orders', label: 'Orders' },
  { id: 'messages', label: 'SMS' },
  { id: 'results', label: 'Results' },
] as const

function GateArt() {
  return (
    <aside className="gate-art" aria-hidden="true">
      <div className="gate-brand">
        <Logo size={56} />
      </div>
      <div className="gate-bottles">
        {[PRODUCTS[1], PRODUCTS[0], PRODUCTS[2]].map((p) => (
          <img key={p.id} src={p.bottle} alt="" />
        ))}
      </div>
      <div className="gate-copy">
        <p className="gate-kicker">Staff room</p>
        <h2>Know Saturday's batch before the cane is cut.</h2>
        <ul>
          <li>Live orders and demand</li>
          <li>Texts that send themselves</li>
          <li>Repeat customers, week on week</li>
        </ul>
      </div>
    </aside>
  )
}

function SignIn() {
  const { signIn, session, isStaff, signOut } = useStaff()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <GateArt />
      <main className="gate-side">
        {session && isStaff === false ? (
          <div className="gate-form">
            <h1>No staff access</h1>
            <p className="muted">{session.user.email} isn't on the GoodCane staff list.</p>
            <button className="btn btn-ghost btn-block" onClick={() => void signOut()}>
              Use another account
            </button>
          </div>
        ) : (
          <form className="gate-form" onSubmit={submit}>
            <h1>Welcome back</h1>
            <p className="muted">Sign in to run this week's batch.</p>
            <label className="field">
              <span>Email</span>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label className="field">
              <span>Password</span>
              <span className="pw">
                <input
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="gate-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <a className="gate-back" href="/">
              ← Back to the shop
            </a>
          </form>
        )}
      </main>
    </div>
  )
}

export default function AdminApp() {
  const route = useRoute()
  const { session, isStaff, signOut, loading } = useStaff()

  if (session && isStaff === null) return <div className="gate small muted">Loading…</div>
  if (!session || !isStaff) return <SignIn />

  const tab = route.path.split('/')[1] || 'demand'
  const active = TABS.some((t) => t.id === tab) ? tab : 'demand'

  return (
    <div className="app admin">
      <header className="topbar">
        <a href={href('/demand')} className="brand">
          <Logo />
          <span className="brand-name">
            <span className="muted">Staff</span>
          </span>
        </a>
        <div className="row-between">
          <span className={`live-dot ${loading ? 'syncing' : ''}`} title="Updates live">
            Live
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a key={t.id} href={href(`/${t.id}`)} className={active === t.id ? 'on' : ''} aria-current={active === t.id ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      <main>
        {active === 'demand' && <Demand route={route} />}
        {active === 'orders' && <Orders route={route} />}
        {active === 'messages' && <Messages />}
        {active === 'results' && <Results />}
      </main>
    </div>
  )
}
