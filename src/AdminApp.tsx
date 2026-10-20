import { useState, type FormEvent } from 'react'
import { Logo } from './components/ui'
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

function SignIn() {
  const { signIn, session, isStaff, signOut } = useStaff()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  if (session && isStaff === false) {
    return (
      <div className="gate">
        <div className="card gate-card">
          <Logo size={56} />
          <h1>No staff access</h1>
          <p className="small muted">{session.user.email} isn't on the GoodCane staff list.</p>
          <button className="btn btn-ghost btn-block" onClick={() => void signOut()}>
            Use another account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="gate">
      <form className="card gate-card" onSubmit={submit}>
        <Logo size={56} />
        <h1>GoodCane staff</h1>
        <p className="small muted">Orders, demand and customer texts.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
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
            GoodCane <span className="muted">Staff</span>
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
