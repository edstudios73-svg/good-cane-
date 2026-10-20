import { batchFromId, formatShort, pastBatches } from '../../domain/batches'
import { cancellationRate, pct, repeatOrderRate, weeklyRows } from '../../domain/metrics'
import { SampleTag } from '../../components/ui'
import { useStaff } from '../../staff/StaffProvider'

export function Results() {
  const { state, now } = useStaff()
  const ids = pastBatches(now, 6)
    .map((b) => b.id)
    .reverse()
  const rows = weeklyRows(state.orders, ids, state.batchRecords)
  const repeat = repeatOrderRate(state.orders, ids)
  const cancel = cancellationRate(state.orders, ids)
  const accs = rows.map((r) => r.forecastAccuracy).filter((x): x is number => x != null)
  const avgAcc = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : undefined
  const avgOrders = rows.length ? rows.reduce((n, r) => n + r.confirmedOrders, 0) / rows.length : 0
  const max = Math.max(1, ...rows.map((r) => r.confirmedOrders))

  return (
    <div className="stack">
      <div className="row-between wrap">
        <p className="small">Last {ids.length} batches. These are the pilot's four success measures.</p>
        <SampleTag>Sample history</SampleTag>
      </div>
      <div className="tiles">
        <div className="tile">
          <span className="mono small">REPEAT-ORDER RATE</span>
          <strong>{pct(repeat.rate)}</strong>
          <span className="small">
            {repeat.repeaters} of {repeat.customers} customers ordered in 2+ weeks
          </span>
        </div>
        <div className="tile">
          <span className="mono small">CONFIRMED ORDERS / WEEK</span>
          <strong>{avgOrders.toFixed(1)}</strong>
          <span className="small">average</span>
        </div>
        <div className="tile">
          <span className="mono small">CANCELLATION RATE</span>
          <strong>{pct(cancel)}</strong>
          <span className="small">of all orders placed</span>
        </div>
        <div className="tile">
          <span className="mono small">FORECAST ACCURACY</span>
          <strong>{pct(avgAcc)}</strong>
          <span className="small">1 − |forecast − sold| ÷ sold</span>
        </div>
      </div>

      <section className="card">
        <h2>Confirmed orders per week</h2>
        <div className="week-chart" role="img" aria-label="Confirmed orders per week, split into new and returning customers">
          {rows.map((r) => (
            <div key={r.batchId} className="week-col">
              <span className="mono small">{r.confirmedOrders}</span>
              <div className="week-bar" style={{ height: `${(r.confirmedOrders / max) * 100}%` }}>
                <span className="returning" style={{ height: `${r.confirmedOrders ? (r.returningCustomers / r.confirmedOrders) * 100 : 0}%` }} />
              </div>
              <span className="small">{formatShort(batchFromId(r.batchId).productionDate)}</span>
            </div>
          ))}
        </div>
        <div className="legend small">
          <span className="key key-returning" /> returning customers <span className="key key-new" /> new
        </div>
      </section>

      <section className="card table-wrap">
        <table className="demand-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th className="num">Placed</th>
              <th className="num">Confirmed</th>
              <th className="num">Cancelled</th>
              <th className="num">Forecast</th>
              <th className="num">Sold</th>
              <th className="num">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.batchId}>
                <td className="nowrap">{formatShort(batchFromId(r.batchId).productionDate)}</td>
                <td className="num">{r.ordersPlaced}</td>
                <td className="num">{r.confirmedOrders}</td>
                <td className="num">{r.cancelledOrders}</td>
                <td className="num">{r.forecast ?? '—'}</td>
                <td className="num">{r.sold ?? '—'}</td>
                <td className="num">{pct(r.forecastAccuracy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
