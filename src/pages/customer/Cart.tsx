import { useRef, useState } from 'react'
import { formatClose, formatDate, openBatches } from '../../domain/batches'
import { BOTTLE_SIZE, PRODUCTS } from '../../domain/catalog'
import type { Product } from '../../domain/types'
import { TrashIcon } from '../../components/icons'
import { href, type Route } from '../../router'
import { useShop } from '../../shop/ShopProvider'

/** A basket row that slides left to reveal delete, like a phone list. */
function Row({ p, qty, onQty, onRemove }: { p: Product; qty: number; onQty: (n: number) => void; onRemove: () => void }) {
  const [dx, setDx] = useState(0)
  const start = useRef<number | null>(null)
  const open = dx <= -60

  return (
    <li className="cart-row" style={{ ['--accent' as string]: p.accent }}>
      <button className="cart-delete" onClick={onRemove} aria-label={`Remove ${p.name}`} tabIndex={open ? 0 : -1}>
        <TrashIcon />
      </button>
      <div
        className="cart-row-body"
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={(e) => (start.current = e.touches[0].clientX - dx)}
        onTouchMove={(e) => {
          if (start.current == null) return
          setDx(Math.max(-84, Math.min(0, e.touches[0].clientX - start.current)))
        }}
        onTouchEnd={() => {
          start.current = null
          setDx((d) => (d < -42 ? -84 : 0))
        }}
      >
        <a className="cart-thumb" href={href(`/flavour/${p.id}`)} style={{ background: p.tint }}>
          <img src={p.bottle} alt="" />
        </a>
        <div className="cart-info">
          <a href={href(`/flavour/${p.id}`)} className="cart-name">
            {p.short}
          </a>
          <span className="cart-meta">{BOTTLE_SIZE} · sugarcane</span>
        </div>
        <div className="qty" role="group" aria-label={`Quantity of ${p.name}`}>
          <button className="qty-minus" onClick={() => onQty(qty - 1)} aria-label={`One less ${p.name}`}>
            −
          </button>
          <output>{qty}</output>
          <button className="qty-plus" onClick={() => onQty(qty + 1)} aria-label={`One more ${p.name}`} disabled={qty >= 24}>
            +
          </button>
        </div>
        <button className="cart-trash" onClick={onRemove} aria-label={`Remove ${p.name}`}>
          <TrashIcon width={18} height={18} />
        </button>
      </div>
    </li>
  )
}

export function Cart({ route }: { route: Route }) {
  const { basket, setBasketQty, clearBasket, now, flash } = useShop()
  const items = PRODUCTS.filter((p) => basket[p.id])
  const total = items.reduce((n, p) => n + basket[p.id], 0)
  const [next] = openBatches(now, 1)
  const from = route.query.get('from')
  const src = route.query.get('src')
  const checkout = `/checkout${from ? `?from=${from}${src ? `&src=${src}` : ''}` : ''}`

  return (
    <div className="cart">
      <div className="page-head">
        <h1>
          Your order <span className="count">({total})</span>
        </h1>
        {items.length > 0 && (
          <button
            className="text-btn"
            onClick={() => {
              clearBasket()
              flash('Order cleared')
            }}
          >
            Clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-bottles" aria-hidden="true">
            {PRODUCTS.slice(0, 3).map((p) => (
              <img key={p.id} src={p.bottle} alt="" />
            ))}
          </div>
          <h2>Nothing here yet</h2>
          <p>
            Pick a few juices for {formatDate(next.productionDate)}. Orders close {formatClose(next.cutoff)}.
          </p>
          <a className="pill-btn dark big" href={href('/')}>
            See the menu
          </a>
        </div>
      ) : (
        <div className="cart-grid">
          <div>
            {from && <p className="note">We've copied your last order. Change anything you like.</p>}
            <ul className="cart-list">
              {items.map((p) => (
                <Row
                  key={p.id}
                  p={p}
                  qty={basket[p.id]}
                  onQty={(n) => setBasketQty(p.id, Math.min(24, n))}
                  onRemove={() => {
                    setBasketQty(p.id, 0)
                    flash(`${p.short} removed`)
                  }}
                />
              ))}
            </ul>
            <p className="hint">Swipe a juice left to remove it.</p>
          </div>

          <aside className="summary">
            <div className="summary-line">
              <span>Bottles</span>
              <strong>{total}</strong>
            </div>
            <div className="summary-line">
              <span>Next batch</span>
              <strong>{formatDate(next.productionDate)}</strong>
            </div>
            <div className="summary-line dashed">
              <span>Payment</span>
              <strong>After we confirm</strong>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <strong>Confirmed by SMS</strong>
            </div>
            <a className="pill-btn dark big block" href={href(checkout)}>
              Checkout
            </a>
          </aside>
        </div>
      )}
    </div>
  )
}
