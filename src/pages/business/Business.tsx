import { href, type Route } from '../../router'
import { useStore } from '../../store'
import { Demand } from './Demand'
import { Orders } from './Orders'
import { Reminders } from './Reminders'
import { Results } from './Results'

const TABS = [
  { id: 'demand', label: 'Demand' },
  { id: 'orders', label: 'Orders' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'results', label: 'Results' },
] as const

export function Business({ tab, route }: { tab: string; route: Route }) {
  const { resetDemo } = useStore()
  const active = TABS.some((t) => t.id === tab) ? tab : 'demand'
  return (
    <div className="biz">
      <div className="biz-head">
        <div>
          <p className="eyebrow mono">GoodCane team · demo, no login</p>
          <h1>Weekly demand</h1>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => confirm('Reset all demo data to the original sample set?') && resetDemo()}
        >
          Reset demo data
        </button>
      </div>
      <nav className="tabs" aria-label="Business sections">
        {TABS.map((t) => (
          <a key={t.id} href={href(`/business/${t.id}`)} className={active === t.id ? 'on' : ''} aria-current={active === t.id ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      {active === 'demand' && <Demand route={route} />}
      {active === 'orders' && <Orders route={route} />}
      {active === 'reminders' && <Reminders />}
      {active === 'results' && <Results />}
    </div>
  )
}
