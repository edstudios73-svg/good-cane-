import { useState } from 'react'
import { batchFromId, formatDay } from '../../domain/batches'
import { STATUS_LABEL, bottles, businessActions, formatOrderNumber } from '../../domain/orders'
import type { Order, OrderStatus } from '../../domain/types'
import { LinesList, SampleTag, StatusPill } from '../../components/ui'
import { navigate, type Route } from '../../router'
import { useStaff } from '../../staff/StaffProvider'
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
  const { state, businessMove } = useStaff()
  const [notify, setNotify] = useState(true)
  const options = useBatchOptions()
  const qb = route.query.get('batch')
  const batchId = qb === 'all' || options.some((b) => b.id === qb) ? qb! : options[0].id
  const qs = route.query.get('status') as OrderStatus | 'all' | null
  const status = qs && FILTERS.includes(qs) ? qs : 'all'

  const set = (b: string, s: string) => navigate(`/orders?batch=${b}&status=${s}`)

  const list = state.orders
    .filter((o) => (batchId === 'all' || o.batchId === batchId) && (status === 'all' || o.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const [busy, setBusy] = useState<string | null>(null)
  const act = async (o: Order, to: OrderStatus) => {
    let note: string | undefined
    if (to === 'cancelled') {
      const reason = prompt(`Reason for cancelling ${formatOrderNumber(o.number)}? The customer gets a text.`, 'Sold out for this batch')
      if (reason === null) return
      note = reason || undefined
    } else if (to === 'paid' && !confirm(`Mark ${formatOrderNumber(o.number)} as paid?`)) return
    setBusy(o.id)
    try {
      await businessMove(o.id, to, note, notify)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack">
      <div className="row-between wrap">
        <BatchPicker value={batchId} onChange={(b) => set(b, status)} allowAll />
        <label className="check inline-check small">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <span>Text the customer when I change an order</span>
        </label>
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
                    <button key={to} className={`btn btn-sm ${to === 'cancelled' ? 'btn-ghost' : 'btn-primary'}`} disabled={busy === o.id} onClick={() => void act(o, to)}>
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
