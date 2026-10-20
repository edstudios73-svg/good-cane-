import { useState } from 'react'
import { batchFromId, formatCutoff, isOpen, pastBatches, timeLeft } from '../../domain/batches'
import { demandForBatch, forecastBottles, forecastForProduct, historicalConfirmRate } from '../../domain/demand'
import { forecastAccuracy, pct } from '../../domain/metrics'
import { PRODUCTS } from '../../domain/catalog'
import { CountUp, FlavourDot, SampleTag, productName } from '../../components/ui'
import { href, navigate, type Route } from '../../router'
import { useStaff } from '../../staff/StaffProvider'
import { BatchPicker, useBatchOptions } from './BatchPicker'

export function Demand({ route }: { route: Route }) {
  const { state, now, saveBatchRecord } = useStaff()
  const options = useBatchOptions()
  const q = route.query.get('batch')
  const batchId = options.some((b) => b.id === q) ? q! : options[0].id
  const batch = batchFromId(batchId)
  const open = isOpen(batchId, now)

  const d = demandForBatch(state.orders, batchId, PRODUCTS)
  const pastIds = pastBatches(now, 6)
    .map((b) => b.id)
    .filter((id) => id !== batchId && state.batchRecords.some((r) => r.batchId === id))
  const rate = historicalConfirmRate(state.orders, pastIds)
  const forecast = forecastBottles(d.firmBottles, d.pendingBottles, rate)
  const record = state.batchRecords.find((r) => r.batchId === batchId)
  const maxBar = Math.max(1, ...d.byProduct.map((p) => p.bottles.requested + p.bottles.confirmed + p.bottles.paid + p.bottles.fulfilled))

  const locations = new Map<string, number>()
  for (const o of state.orders) {
    if (o.batchId !== batchId || o.status === 'cancelled') continue
    locations.set(o.location, (locations.get(o.location) ?? 0) + o.lines.reduce((n, l) => n + l.qty, 0))
  }

  return (
    <div className="stack">
      <div className="row-between wrap">
        <BatchPicker value={batchId} onChange={(id) => navigate(`/demand?batch=${id}`)} />
        <SampleTag>Sample data</SampleTag>
      </div>
      <p className="small">
        {open ? (
          <>
            Pre-orders close <strong>{formatCutoff(batch.cutoff)}</strong> ({timeLeft(batch.cutoff, now)} left). Numbers will still move.
          </>
        ) : (
          <>Pre-orders closed {formatCutoff(batch.cutoff)}.</>
        )}
      </p>

      <div className="tiles">
        <div className="tile tile-firm">
          <span className="mono small">CONFIRMED BOTTLES</span>
          <strong>
            <CountUp value={d.firmBottles} />
          </strong>
          <span className="small">
            {d.orders.confirmed + d.orders.paid + d.orders.fulfilled} orders · {d.totals.paid + d.totals.fulfilled} paid
          </span>
        </div>
        <div className="tile tile-pending">
          <span className="mono small">AWAITING CONFIRMATION</span>
          <strong>
            <CountUp value={d.pendingBottles} />
          </strong>
          <span className="small">
            {d.orders.requested} requests · <a href={href(`/orders?batch=${batchId}&status=requested`)}>review</a>
          </span>
        </div>
        <div className="tile">
          <span className="mono small">CANCELLED</span>
          <strong>{d.orders.cancelled}</strong>
          <span className="small">
            {d.totals.cancelled} bottle{d.totals.cancelled === 1 ? '' : 's'}
          </span>
        </div>
        <div className="tile tile-forecast">
          <span className="mono small">SUGGESTED BATCH</span>
          <strong>
            <CountUp value={forecast} />
          </strong>
          <span className="small">
            confirmed + {pct(rate)} of requests
          </span>
        </div>
      </div>

      <section className="card">
        <div className="row-between">
          <h2>By flavour</h2>
          <div className="legend small">
            <span className="key key-paid" /> paid
            <span className="key key-confirmed" /> confirmed
            <span className="key key-requested" /> requested
          </div>
        </div>
        <table className="demand-table">
          <thead>
            <tr>
              <th>Flavour</th>
              <th className="bar-col" aria-label="Chart" />
              <th className="num">Confirmed</th>
              <th className="num">Requested</th>
              <th className="num">Make</th>
            </tr>
          </thead>
          <tbody>
            {d.byProduct.map(({ productId, bottles: b }) => {
              const paid = b.paid + b.fulfilled
              return (
                <tr key={productId}>
                  <td>
                    <span className="flav">
                      <FlavourDot id={productId} />
                      {productName(productId)}
                    </span>
                  </td>
                  <td className="bar-col">
                    <div className="bar" role="img" aria-label={`${paid} paid, ${b.confirmed} confirmed, ${b.requested} requested`}>
                      <span className="seg seg-paid" style={{ width: `${(paid / maxBar) * 100}%` }} />
                      <span className="seg seg-confirmed" style={{ width: `${(b.confirmed / maxBar) * 100}%` }} />
                      <span className="seg seg-requested" style={{ width: `${(b.requested / maxBar) * 100}%` }} />
                    </div>
                  </td>
                  <td className="num">{paid + b.confirmed}</td>
                  <td className="num">{b.requested}</td>
                  <td className="num strong">{forecastForProduct(b, rate)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="bar-col" />
              <td className="num">{d.firmBottles}</td>
              <td className="num">{d.pendingBottles}</td>
              <td className="num strong">{forecast}</td>
            </tr>
          </tfoot>
        </table>
        <p className="small muted">
          "Make" = confirmed bottles + requested bottles × {pct(rate)}, the share of requests that were confirmed over recent weeks. Walk-in
          stock is not included — add your own buffer.
        </p>
      </section>

      <section className="card">
        <h2>Where it's going</h2>
        {locations.size === 0 ? (
          <p className="small">No active orders yet.</p>
        ) : (
          <ul className="lines">
            {[...locations].map(([loc, n]) => (
              <li key={loc}>
                <span>{loc}</span>
                <span className="mono">{n} bottles</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BatchOutcome
        key={batchId}
        batchId={batchId}
        open={open}
        forecast={forecast}
        record={record}
        onSave={(r) => saveBatchRecord({ batchId, ...r })}
      />
    </div>
  )
}

function BatchOutcome({
  open,
  forecast,
  record,
  onSave,
}: {
  batchId: string
  open: boolean
  forecast: number
  record?: { forecast?: number; produced?: number; sold?: number }
  onSave: (r: { forecast?: number; produced?: number; sold?: number }) => void
}) {
  const [produced, setProduced] = useState(record?.produced?.toString() ?? '')
  const [sold, setSold] = useState(record?.sold?.toString() ?? '')
  const toNum = (s: string) => (s.trim() === '' ? undefined : Math.max(0, Math.floor(Number(s))))
  const acc = forecastAccuracy(record?.forecast, record?.sold)

  return (
    <section className="card">
      <h2>Forecast check</h2>
      <p className="small">
        At cutoff, save the suggested number. After batch day, enter what you made and sold. This is how forecast accuracy is measured.
      </p>
      <div className="row-between wrap">
        <span>
          Saved forecast: <strong>{record?.forecast ?? '—'}</strong>
        </span>
        <button className="btn btn-sm" onClick={() => onSave({ ...record, forecast })}>
          {record?.forecast != null ? 'Update' : 'Save'} forecast ({forecast})
        </button>
      </div>
      {!open && (
        <form
          className="outcome-form"
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ ...record, produced: toNum(produced), sold: toNum(sold) })
          }}
        >
          <label className="field">
            <span>Bottles made</span>
            <input inputMode="numeric" value={produced} onChange={(e) => setProduced(e.target.value)} />
          </label>
          <label className="field">
            <span>Bottles sold</span>
            <input inputMode="numeric" value={sold} onChange={(e) => setSold(e.target.value)} />
          </label>
          <button className="btn btn-sm">Save actuals</button>
        </form>
      )}
      {acc != null && (
        <p className="small">
          Forecast accuracy for this batch: <strong>{pct(acc)}</strong> (forecast {record?.forecast} vs sold {record?.sold})
        </p>
      )}
    </section>
  )
}
