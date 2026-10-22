import { useEffect, useRef, useState } from 'react'
import { formatDate, openBatches } from '../../domain/batches'
import { BOTTLE_SIZE, PRODUCTS, TASTES } from '../../domain/catalog'
import { BagIcon, BellIcon, ChatIcon, FilterIcon, HeartIcon, SearchIcon, SunIcon } from '../../components/icons'
import { supabase } from '../../lib/supabase'
import { Countdown, LinesList } from '../../components/ui'
import { href, type Route } from '../../router'
import { useShop } from '../../shop/ShopProvider'
import { lastReorderable, reorderBatch } from './reorder'


export function Home({ route }: { route: Route }) {
  const { orders, now, me, basket, setBasketQty, favourites, toggleFavourite, flash } = useShop()
  const [next] = openBatches(now, 1)
  const last = me ? lastReorderable(orders, me.id) : undefined
  const again = me ? reorderBatch(orders, me.id, now) : next
  const [query, setQuery] = useState('')
  const [taste, setTaste] = useState<string>('All')
  const [onlyFavs, setOnlyFavs] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const [reserved, setReserved] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    const load = () =>
      supabase.rpc('batch_reserved', { d: next.id }).then(({ data }) => {
        if (live && typeof data === 'number') setReserved(data)
      })
    void load()
    const t = setInterval(load, 60_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [next.id])

  useEffect(() => {
    if (route.query.get('search')) search.current?.focus()
  }, [route])

  const q = query.trim().toLowerCase()
  const shown = PRODUCTS.filter(
    (p) =>
      (taste === 'All' || p.taste === taste) &&
      (!onlyFavs || favourites.includes(p.id)) &&
      (!q || `${p.name} ${p.ingredients} ${p.taste}`.toLowerCase().includes(q)),
  )

  const add = (id: string, name: string) => {
    setBasketQty(id, (basket[id] ?? 0) + 1)
    flash(`${name} added to your order`)
  }

  return (
    <div className="home">
      <section className="home-top">
        <div className="home-title">
          <div>
            <p className="greeting">Akwaaba</p>
            <h1>
              Fresh cane juice,
              <br />
              pressed just for you
            </h1>
          </div>
          <a className="round-btn" href={href('/account')} aria-label="Text reminders">
            <BellIcon />
          </a>
        </div>

        <label className="searchbar">
          <SearchIcon />
          <input
            ref={search}
            type="search"
            placeholder="Search juices"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search juices"
          />
          <button
            type="button"
            className={`icon-toggle ${onlyFavs ? 'on' : ''}`}
            onClick={() => setOnlyFavs((v) => !v)}
            aria-pressed={onlyFavs}
            aria-label="Show favourites only"
            title="Favourites only"
          >
            <FilterIcon />
          </button>
        </label>

        <a className="promo" href={href('/cart')}>
          <div className="promo-text">
            <span className="promo-kicker">Next fresh batch · {formatDate(next.productionDate)}</span>
            {reserved != null && reserved > 0 && (
              <span className="reserved">
                <span className="pulse" aria-hidden="true" />
                {reserved} bottle{reserved === 1 ? '' : 's'} reserved so far
              </span>
            )}
            <strong>
              Reserve your bottles now. Pay only when we confirm.
            </strong>
            <span className="promo-row">
              <span className="pill-btn">Order now</span>
              <span className="promo-clock">
                <Countdown until={next.cutoff} />
              </span>
            </span>
          </div>
          <div className="promo-art" aria-hidden="true">
            {[PRODUCTS[1], PRODUCTS[0], PRODUCTS[2]].map((p) => (
              <img key={p.id} src={p.bottle} alt="" />
            ))}
          </div>
        </a>
      </section>

      {last && me && (
        <section className="again">
          <div>
            <h2>Welcome back, {me.name.split(' ')[0]}</h2>
            <LinesList lines={last.lines} />
          </div>
          <a className="pill-btn dark" href={href(`/order?from=${last.id}`)}>
            Order again for {formatDate(again.productionDate)}
          </a>
        </section>
      )}

      <div className="chips" role="tablist" aria-label="Filter by taste">
        {['All', ...TASTES].map((t) => {
          const p = PRODUCTS.find((x) => x.taste === t)
          return (
            <button key={t} role="tab" aria-selected={taste === t} className={`chip ${taste === t ? 'on' : ''}`} onClick={() => setTaste(t)}>
              {p && <span className="chip-dot" style={{ background: p.accent }} />}
              {t}
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="empty">{onlyFavs ? 'Tap the heart on a juice to keep it here.' : 'No juice matches that.'}</p>
      ) : (
        <ul className="grid">
          {shown.map((p, i) => (
            <li key={p.id} className="pcard rise" style={{ animationDelay: `${i * 40}ms`, ['--accent' as string]: p.accent, ['--tint' as string]: p.tint }}>
              <button
                className={`fav ${favourites.includes(p.id) ? 'on' : ''}`}
                onClick={() => toggleFavourite(p.id)}
                aria-pressed={favourites.includes(p.id)}
                aria-label={`Favourite ${p.name}`}
              >
                <HeartIcon filled={favourites.includes(p.id)} width={18} height={18} />
              </button>
              <a className="card-link" href={href(`/flavour/${p.id}`)}>
                <span className="card-img">
                  <img src={p.bottle} alt={`${p.name} bottle`} loading="lazy" />
                </span>
                <span className="card-name">{p.short}</span>
                <span className="card-meta">{BOTTLE_SIZE}</span>
              </a>
              <button className="card-add" onClick={() => add(p.id, p.short)} aria-label={`Add ${p.name}`}>
                {basket[p.id] ? basket[p.id] : '+'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="how">
        <h2>How ordering works</h2>
        <ol>
          <li>
            <span className="how-icon">
              <BagIcon />
            </span>
            <div>
              <strong>Choose your juice</strong>
              <p>Pick your flavours and how you'd like to get them. No payment upfront.</p>
            </div>
          </li>
          <li>
            <span className="how-icon">
              <ChatIcon />
            </span>
            <div>
              <strong>We'll text you</strong>
              <p>Your order number comes by SMS straight away, and we text again once it's confirmed.</p>
            </div>
          </li>
          <li>
            <span className="how-icon">
              <SunIcon />
            </span>
            <div>
              <strong>Pressed fresh for you</strong>
              <p>Squeezed on the day, never stored. Loved it? Order the same again in one tap.</p>
            </div>
          </li>
        </ol>
        <p className="how-note">Sizes and prices are confirmed with your order.</p>
      </section>
    </div>
  )
}
