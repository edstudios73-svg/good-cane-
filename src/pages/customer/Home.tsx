import { formatCutoff, formatDay, openBatches, timeLeft } from '../../domain/batches'
import { PRODUCTS } from '../../domain/seed'
import { href } from '../../router'
import { useStore } from '../../store'
import { Bottle, LinesList, productName } from '../../components/ui'
import { lastReorderable, reorderBatch } from './reorder'

export function Home() {
  const { state, now, meCustomer } = useStore()
  const [next] = openBatches(now, 1)
  const last = meCustomer ? lastReorderable(state.orders, meCustomer.id) : undefined
  const again = meCustomer ? reorderBatch(state.orders, meCustomer.id, now) : next
  const weekday = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long' })

  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow mono">Fresh weekly batch · Made in Ghana</p>
        <h1>
          Pressed fresh.
          <br />
          Reserve yours.
        </h1>
        <p className="lede">No preservatives, no water, no added sugar. GoodCane presses one batch a week — pre-order so there's a bottle with your name on it.</p>

        <div className="batch-card">
          <div>
            <p className="mono small">NEXT BATCH</p>
            <p className="batch-day">{formatDay(next.productionDate)}</p>
            <p className="small">
              Pre-orders close <strong>{formatCutoff(next.cutoff)}</strong>
            </p>
          </div>
          <div className="countdown">
            <span className="mono small">CLOSES IN</span>
            <strong>{timeLeft(next.cutoff, now)}</strong>
          </div>
        </div>
        <a className="btn btn-primary btn-block" href={href(`/order?batch=${next.id}`)}>
          Pre-order now
        </a>
      </section>

      {last && meCustomer && (
        <section className="card again">
          <p className="mono small">WELCOME BACK, {meCustomer.name.split(' ')[0].toUpperCase()}</p>
          <h2>Same again?</h2>
          <LinesList lines={last.lines} />
          <a className="btn btn-pink btn-block" href={href(`/order?from=${last.id}&batch=${again.id}`)}>
            Same again for {formatDay(again.productionDate)}
          </a>
          <a className="link small" href={href('/orders')}>
            See all my orders
          </a>
        </section>
      )}

      <section>
        <h2 className="section-title">How it works</h2>
        <ol className="steps">
          <li>
            <strong>Pre-order by {weekday(next.cutoff)} {next.cutoff.getHours()}:00.</strong> Pick flavours and pickup or delivery. No payment yet.
          </li>
          <li>
            <strong>GoodCane confirms.</strong> You get a WhatsApp message to confirm and arrange payment.
          </li>
          <li>
            <strong>Collect fresh on {weekday(next.productionDate)}.</strong> Then reorder in one tap next week.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="section-title">This week's flavours</h2>
        <div className="menu">
          {PRODUCTS.map((p) => (
            <a key={p.id} className="menu-item" href={href(`/order?batch=${next.id}&add=${p.id}`)}>
              <Bottle colour={p.colour} />
              <div>
                <h3>{productName(p.id)}</h3>
                <p className="small">{p.description}</p>
                <p className="small muted">Price confirmed by GoodCane</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {!meCustomer && (
        <p className="center small">
          Ordered before? <a href={href('/orders')}>Find my orders</a>
        </p>
      )}
    </div>
  )
}
