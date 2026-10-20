import { formatCutoff, formatDay, openBatches } from '../../domain/batches'
import { PRODUCTS } from '../../domain/catalog'
import { BasketBar } from '../../components/BasketBar'
import { BottleTile, FlavourTitle, Stepper } from '../../components/ui'
import { href, navigate } from '../../router'
import { useShop } from '../../shop/ShopProvider'

export function Flavour({ id }: { id: string }) {
  const { basket, setBasketQty, now } = useShop()
  const p = PRODUCTS.find((x) => x.id === id)
  if (!p) {
    return (
      <p>
        Flavour not found. <a href={href('/')}>Back to the menu</a>
      </p>
    )
  }
  const [next] = openBatches(now, 1)
  const qty = basket[p.id] ?? 0
  const others = PRODUCTS.filter((x) => x.id !== p.id)

  return (
    <div className="detail" style={{ ['--accent' as string]: p.accent, ['--tint' as string]: p.tint }}>
      <div className="detail-hero rise">
        <a className="icon-btn" href={href('/')} aria-label="Back to menu">
          ←
        </a>
        <BottleTile product={p} className="detail-bottle" alt={`${p.name} bottle`} />
      </div>

      <div className="detail-body rise" style={{ animationDelay: '60ms' }}>
        <div className="row-between top">
          <FlavourTitle product={p} as="h1" />
          <Stepper label={p.name} value={qty} onChange={(n) => setBasketQty(p.id, n)} />
        </div>
        <p className="ingredients">{p.ingredients}</p>

        <h2 className="detail-h">About</h2>
        <p className="muted">{p.about}</p>
        <ul className="facts">
          <li>No preservatives</li>
          <li>No water</li>
          <li>No added sugar</li>
        </ul>
        <p className="small muted">We confirm size and price with your order. Orders for {formatDay(next.productionDate)} close {formatCutoff(next.cutoff)}.</p>

        <button
          className="btn btn-accent btn-block"
          onClick={() => {
            if (!qty) setBasketQty(p.id, 1)
            navigate(`/order?batch=${next.id}`)
          }}
        >
          {qty ? `Continue with ${qty} bottle${qty === 1 ? '' : 's'}` : 'Add to order'}
        </button>
      </div>

      <section className="also">
        <h2 className="detail-h">More juices</h2>
        <div className="tiles-row">
          {others.map((o) => (
            <a key={o.id} href={href(`/flavour/${o.id}`)} className="mini" style={{ ['--tint' as string]: o.tint }}>
              <BottleTile product={o} />
              <span>{o.short}</span>
            </a>
          ))}
        </div>
      </section>
      <BasketBar />
    </div>
  )
}
