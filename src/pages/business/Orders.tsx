import { batchFromId, formatDay } from '../../domain/batches'
import { STATUS_LABEL, bottles, businessActions, formatOrderNumber } from '../../domain/orders'
import type { Order, OrderStatus } from '../../domain/types'
import { LinesList, SampleTag, StatusPill } from '../../components/ui'
import { navigate, type Route } from '../../router'
import { useStore } from '../../store'
import { BatchPicker, useBatchOptions } from './BatchPicker'

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm',
  paid: 'Mark paid',
  fulfilled: 'Mark delivered',
  cancelled: 'Cancel',
}

const FILTERS: (OrderStatus | 'all')[] = ['all', 'requested', 'confirmed', 'paid', 'fulfilled', 'cancelled']

const SOURCE_LABEL: Record<Order['source'], string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  direct: 'Direct',
  reorder: 'Same again',
  reminder: 'Reminder',
}

export function Orders({ route }: { route: Route }) {
  const { state, businessMove } = useStore()
  const options = useBatchOptions()
  const qb = route.query.get('batch')
  const batchId = qb === 'all' || options.some((b) => b.id === qb) ? qb! : options[0].id
  const qs = route.query.get('status') as OrderStatus | 'all' | null
  const status = qs && FILTERS.includes(qs) ? qs : 'all'

  const set = (b: string, s: string) => navigate(`/business/orders?batch=${b}&status=${s}`)

  const list = state.orders
    .filter((o) => (batchId === 'all' || o.batchId === batchId) && (status === 'all' || o.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const act = (o: Order, to: OrderStatus) => {
    if (to === 'cancelled') {
      const reason = prompt(`Reason for cancelling ${formatOrderNumber(o.number)}? (shared with the customer)`, 'Sold out for this batch')
      if (reason === null) return
      businessMove(o.id, to, reason || undefined)
    } else if (to === 'paid') {
      if (confirm(`Record that ${formatOrderNumber(o.number)} has been paid? (Payment is taken outside this app.)`)) businessMove(o.id, to)
    } else {
      businessMove(o.id, to)
    }
  }

  return (
    <div className="stack">
      <div className="row-between wrap">
        <BatchPicker value={batchId} onChange={(b) => set(b, status)} allowAll />
        <SampleTag />
      </div>
      <div className="chips scroll" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} className={`chip-btn ${status === f ? 'on' : ''}`} onClick={() => set(batchId, f)}>
            {f === 'all' ? 'All' : STATUS_LABEL[f]} ({state.orders.filter((o) => (batchId === 'all' || o.batchId === batchId) && (f === 'all' || o.status === f)).length})
          </button>
        ))}
      </div>

      {list.length === 0 && <p className="small">No orders match.</p>}
      <ul className="order-cards">
        {list.map((o) => {
          const c = state.customers.find((x) => x.id === o.customerId)
          const lastChange = o.history[o.history.length - 1]
          return (
            <li key={o.id} className="card order-card">
              <div className="row-between">
                <span className="mono">{formatOrderNumber(o.number)}</span>
                <StatusPill status={o.status} />
              </div>
              <p>
                <strong>{c?.name ?? 'Unknown'}</strong> <span className="muted small">{c?.phone}</span>
                {o.sample && <SampleTag>sample</SampleTag>}
              </p>
              <p className="small muted">
                {formatDay(batchFromId(o.batchId).productionDate)} · {o.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'} · {o.location} · via{' '}
                {SOURCE_LABEL[o.source]}
              </p>
              <LinesList lines={o.lines} />
              <p className="small">
                <strong>{bottles(o.lines)} bottles</strong>
                {o.note && <> · “{o.note}”</>}
              </p>
              {o.status === 'cancelled' && lastChange.status === 'cancelled' && (
                <p className="small muted">
                  Cancelled by {lastChange.by}
                  {lastChange.note ? ` — ${lastChange.note}` : ''}
                </p>
              )}
              {businessActions(o).length > 0 && (
                <div className="actions">
                  {businessActions(o).map((to) => (
                    <button key={to} className={`btn btn-sm ${to === 'cancelled' ? 'btn-ghost' : 'btn-primary'}`} onClick={() => act(o, to)}>
                      {ACTION_LABEL[to]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
