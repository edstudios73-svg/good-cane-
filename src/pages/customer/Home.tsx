import { formatDay, openBatches } from '../../domain/batches'
import { PRODUCTS } from '../../domain/catalog'
import { href } from '../../router'
import { useShop } from '../../shop/ShopProvider'
import { BasketBar } from '../../components/BasketBar'
import { BottleTile, Countdown, FlavourTitle, LinesList, Stepper } from '../../components/ui'
import { lastReorderable, reorderBatch } from './reorder'

const day = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long' })
const hour = (d: Date) => `${d.getHours() > 12 ? d.getHours() - 12 : d.getHours()}${d.getHours() >= 12 ? 'pm' : 'am'}`

export function Home() {
  const { orders, now, me, basket, setBasketQty } = useShop()
  const [next] = openBatches(now, 1)
  const last = me ? lastReorderable(orders, me.id) : undefined
  const again = me ? reorderBatch(orders, me.id, now) : next
  const featured = PRODUCTS[0]

  return (
    <div className="stack-lg home">
      <section className="intro rise">
        <h1>
          Fresh sugarcane juice,
          <br />
          <span className="light">pressed every {day(next.productionDate)}.</span>
        </h1>
        <p className="lede">
          Order by {day(next.cutoff)} {hour(next.cutoff)} and we'll keep your bottles aside. You only pay once we've confirmed your order.
        </p>
        <div className="batch-strip">
          <div>
            <span className="small muted">Next batch</span>
            <strong>{formatDay(next.productionDate)}</strong>
          </div>
          <div className="right">
            <span className="small muted">Orders close in</span>
            <Countdown until={next.cutoff} />
          </div>
        </div>
        <a className="btn btn-primary btn-block intro-cta" href={href(`/order?batch=${next.id}`)}>
          Start an order
        </a>
      </section>

      <nav className="cats rise" aria-label="Flavours" style={{ animationDelay: '40ms' }}>
        {PRODUCTS.map((p) => (
          <a key={p.id} href={href(`/flavour/${p.id}`)} className="cat" style={{ ['--tint' as string]: p.tint }}>
            <span className="cat-icon">
              <img src={p.bottle} alt="" />
            </span>
            <span className="cat-name">{p.short}</span>
          </a>
        ))}
      </nav>

      {last && me && (
        <section className="again rise">
          <h2>Welcome back, {me.name.split(' ')[0]}</h2>
          <p className="small muted">Your last order:</p>
          <LinesList lines={last.lines} />
          <a className="btn btn-primary btn-block" href={href(`/order?from=${last.id}&batch=${again.id}`)}>
            Order this again for {formatDay(again.productionDate)}
          </a>
        </section>
      )}

      <section
        className="featured rise"
        style={{ ['--accent' as string]: featured.accent, ['--tint' as string]: featured.tint, animationDelay: '80ms' }}
      >
        <a className="featured-art" href={href(`/flavour/${featured.id}`)} aria-label={`About ${featured.name}`}>
          <BottleTile product={featured} />
        </a>
        <div className="featured-body">
          <FlavourTitle product={featured} as="h2" />
          <p className="muted small">{featured.about}</p>
          <div className="row-between">
            <span className="ingredients">{featured.ingredients}</span>
            <Stepper label={featured.name} value={basket[featured.id] ?? 0} onChange={(n) => setBasketQty(featured.id, n)} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">The menu</h2>
        <ul className="menu-list">
          {PRODUCTS.map((p) => (
            <li key={p.id} className="menu-row" style={{ ['--accent' as string]: p.accent, ['--tint' as string]: p.tint }}>
              <div className="menu-text">
                <a href={href(`/flavour/${p.id}`)} className="menu-link">
                  <FlavourTitle product={p} />
                </a>
                <p className="small muted">{p.description}</p>
                <p className="ingredients">{p.ingredients}</p>
                <Stepper label={p.name} value={basket[p.id] ?? 0} onChange={(n) => setBasketQty(p.id, n)} />
              </div>
              <a href={href(`/flavour/${p.id}`)} className="menu-art" tabIndex={-1} aria-hidden="true">
                <BottleTile product={p} />
              </a>
            </li>
          ))}
        </ul>
        <p className="small muted fine">We confirm bottle sizes and prices when we confirm your order.</p>
      </section>

      <section className="how">
        <h2 className="section-title">How ordering works</h2>
        <div className="how-grid">
          <div>
            <strong>Order by {day(next.cutoff)}</strong>
            <p className="small muted">Pick your juices and choose pickup or delivery. Nothing to pay yet.</p>
          </div>
          <div>
            <strong>We confirm by SMS</strong>
            <p className="small muted">You get your order number straight away, then a text when it's confirmed.</p>
          </div>
          <div>
            <strong>Collect on {day(next.productionDate)}</strong>
            <p className="small muted">Pressed that morning. Want the same next week? It's one tap from My orders.</p>
          </div>
        </div>
      </section>
      <BasketBar />
    </div>
  )
}
