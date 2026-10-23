import { useRef, useState } from 'react'
import { formatClose, formatDate, openBatches } from '../../domain/batches'
import { formatPrice, useMenu } from '../../lib/menu'
import { ArrowsIcon, BackIcon, HeartIcon, ShareIcon } from '../../components/icons'
import { Stepper } from '../../components/ui'
import { href, navigate } from '../../router'
import { useShop } from '../../shop/ShopProvider'

export function Flavour({ id }: { id: string }) {
  const { basket, setBasketQty, now, favourites, toggleFavourite, flash } = useShop()
  const menu = useMenu()
  const index = menu.findIndex((x) => x.id === id)
  const p = menu[index]
  const [qty, setQty] = useState(1)
  const [turn, setTurn] = useState<'left' | 'right' | null>(null)
  const touch = useRef<number | null>(null)

  if (!p) {
    return (
      <p className="empty">
        We couldn't find that juice. <a href={href('/')}>Back to the menu</a>
      </p>
    )
  }
  const [next] = openBatches(now, 1)
  const inOrder = basket[p.id] ?? 0

  const go = (dir: 1 | -1) => {
    setTurn(dir === 1 ? 'left' : 'right')
    const n = menu[(index + dir + menu.length) % menu.length]
    navigate(`/flavour/${n.id}`)
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: `GoodCane ${p.name}`, url })
      else {
        await navigator.clipboard.writeText(url)
        flash('Link copied')
      }
    } catch {
      // closed the share sheet
    }
  }

  const add = () => {
    setBasketQty(p.id, inOrder + qty)
    flash(`${qty} × ${p.short} added to your order`)
  }

  return (
    <div className="detail" style={{ ['--accent' as string]: p.accent, ['--tint' as string]: p.tint }}>
      <div className="detail-bar">
        <a className="round-btn" href={href('/')} aria-label="Back to the menu">
          <BackIcon />
        </a>
        <span className="detail-bar-title">Juice details</span>
        <button className="round-btn" onClick={() => void share()} aria-label="Share">
          <ShareIcon />
        </button>
      </div>

      <div className="detail-grid">
        <div
          className="stage"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current == null) return
            const dx = e.changedTouches[0].clientX - touch.current
            touch.current = null
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
          }}
        >
          <img key={p.id} className={`stage-bottle ${turn ? `from-${turn}` : ''}`} src={p.bottle} alt={`${p.name} bottle`} />
          <div className="turntable" aria-hidden="true" />
          <div className="turn-controls">
            <button onClick={() => go(-1)} aria-label="Previous juice" />
            <span className="turn-knob">
              <ArrowsIcon />
            </span>
            <button onClick={() => go(1)} aria-label="Next juice" />
          </div>
        </div>

        <div className="detail-info">
          <div className="detail-name">
            <h1>{p.name}</h1>
            <button
              className={`fav big ${favourites.includes(p.id) ? 'on' : ''}`}
              onClick={() => toggleFavourite(p.id)}
              aria-pressed={favourites.includes(p.id)}
              aria-label="Favourite"
            >
              <HeartIcon filled={favourites.includes(p.id)} />
            </button>
          </div>
          <p className="detail-about">{p.about}</p>

          <p className="detail-label">Flavour</p>
          <div className="swatches">
            {menu.map((x) => (
              <a
                key={x.id}
                href={href(`/flavour/${x.id}`)}
                className={`swatch ${x.id === p.id ? 'on' : ''}`}
                style={{ background: x.accent }}
                aria-label={x.name}
                aria-current={x.id === p.id ? 'true' : undefined}
                title={x.short}
              />
            ))}
          </div>

          <ul className="facts">
            <li>{p.ingredients}</li>
            <li>No preservatives</li>
            <li>No added sugar</li>
          </ul>

          <div className="detail-qty">
            <span className="detail-label">How many?</span>
            <Stepper label={p.name} value={qty} onChange={(n) => setQty(Math.max(1, n))} />
          </div>

          <div className="buy-row">
            {p.price != null ? (
              <div className="size priced">
                {formatPrice(p.price)}
                <small>{p.size} bottle</small>
              </div>
            ) : (
              <div className="size">
                {(p.size ?? '500 ml').split(' ')[0]}
                <small> {(p.size ?? '500 ml').split(' ').slice(1).join(' ')}</small>
              </div>
            )}
            <button className="pill-btn dark big" onClick={add}>
              Add to order
            </button>
          </div>
          <p className="fine">
            {inOrder > 0 ? `${inOrder} in your order · ` : ''}For {formatDate(next.productionDate)}, orders close {formatClose(next.cutoff)}.{p.price == null ? ' Price confirmed by SMS.' : ' You pay when we confirm.'}
          </p>
          {inOrder > 0 && (
            <a className="link" href={href('/cart')}>
              View your order
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
