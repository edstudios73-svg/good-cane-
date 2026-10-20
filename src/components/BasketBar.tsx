import { formatDay, openBatches } from '../domain/batches'
import { PRODUCTS } from '../domain/catalog'
import { href } from '../router'
import { useShop } from '../shop/ShopProvider'

/** Floating summary of bottles picked from the menu, leading to the pre-order form. */
export function BasketBar() {
  const { basket, now } = useShop()
  const total = Object.values(basket).reduce((n, q) => n + q, 0)
  if (!total) return null
  const [next] = openBatches(now, 1)
  const picked = PRODUCTS.filter((p) => basket[p.id])
  return (
    <div className="basket-bar rise" role="region" aria-label="Your order">
      <div className="basket-thumbs" aria-hidden="true">
        {picked.slice(0, 3).map((p) => (
          <span key={p.id} style={{ background: p.tint }}>
            <img src={p.bottle} alt="" />
          </span>
        ))}
      </div>
      <div className="basket-text">
        <strong>
          {total} bottle{total === 1 ? '' : 's'}
        </strong>
        <span className="small">for {formatDay(next.productionDate)}</span>
      </div>
      <a className="btn btn-primary btn-sm" href={href(`/order?batch=${next.id}`)}>
        Checkout
      </a>
    </div>
  )
}
