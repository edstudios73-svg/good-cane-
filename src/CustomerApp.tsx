import { useEffect } from 'react'
import { BagIcon, DropIcon, HomeIcon, InstagramIcon, LeafIcon, PinIcon, ReceiptIcon, SearchIcon, SparkIcon, TikTokIcon, UserIcon } from './components/icons'
import { Logo } from './components/ui'
import { bottles } from './domain/orders'
import { Account } from './pages/customer/Account'
import { Cart } from './pages/customer/Cart'
import { Flavour } from './pages/customer/Flavour'
import { Home } from './pages/customer/Home'
import { MyOrders } from './pages/customer/MyOrders'
import { OrderForm } from './pages/customer/OrderForm'
import { Receipt } from './pages/customer/Receipt'
import { lastReorderable } from './pages/customer/reorder'
import { campaignSource, href, navigate, useRoute, type Route } from './router'
import { useShop } from './shop/ShopProvider'

/** Links in reminder texts and "Order this again" land here: fill the basket with the last order. */
function Repeat({ route }: { route: Route }) {
  const { orders, me, ready, fillBasket, loadOrder } = useShop()
  const id = route.query.get('from')
  useEffect(() => {
    if (!ready) return
    let live = true
    const go = async () => {
      // Orders placed on this phone without an account still reorder through their receipt link.
      const from = orders.find((o) => o.id === id) ?? (id ? (await loadOrder(id).catch(() => null))?.order : undefined) ?? (me ? lastReorderable(orders, me.id) : undefined)
      if (!live) return
      if (!from) return navigate('/orders')
      fillBasket(Object.fromEntries(from.lines.map((l) => [l.productId, l.qty])))
      navigate(`/cart?from=${from.id}${route.query.get('src') ? `&src=${route.query.get('src')}` : ''}`)
    }
    void go()
    return () => {
      live = false
    }
  }, [ready, id, orders, me, fillBasket, loadOrder, route])
  return null
}

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, match: (a?: string) => !a || a === 'flavour' },
  { to: '/?search=1', label: 'Search', Icon: SearchIcon, match: () => false },
  { to: '/cart', label: 'Order', Icon: BagIcon, match: (a?: string) => a === 'cart' || a === 'checkout' },
  { to: '/orders', label: 'My orders', Icon: ReceiptIcon, match: (a?: string) => a === 'orders' || a === 'receipt' },
  { to: '/account', label: 'Account', Icon: UserIcon, match: (a?: string) => a === 'account' },
]

export default function CustomerApp() {
  const route = useRoute()
  const { basket, toast } = useShop()
  const count = bottles(Object.entries(basket).map(([productId, qty]) => ({ productId, qty })))
  useEffect(() => {
    campaignSource() // remember ?src= for attribution on the first page view
  }, [])

  const [, a, b] = route.path.split('/')
  let page
  if (a === 'flavour' && b) page = <Flavour id={b} />
  else if (a === 'cart') page = <Cart route={route} />
  else if (a === 'checkout') page = <OrderForm key={window.location.hash} route={route} />
  else if (a === 'order' || a === 'reorder') page = route.query.get('from') || a === 'reorder' ? <Repeat route={route} /> : <Cart route={route} />
  else if (a === 'receipt' && b) page = <Receipt id={b} route={route} />
  else if (a === 'orders') page = <MyOrders />
  else if (a === 'account') page = <Account />
  else page = <Home route={route} />

  return (
    <div className={`shop ${a ? `shop-${a}` : 'shop-home'}`}>
      <header className="shop-head">
        <a href={href('/')} className="brand" aria-label="GoodCane home">
          <Logo size={42} />
        </a>
        <nav className="head-links" aria-label="Main">
          {TABS.filter((t) => t.label !== 'Search' && t.label !== 'Order').map((t) => (
            <a key={t.to} href={href(t.to)} className={t.match(a) ? 'on' : ''}>
              {t.label === 'Home' ? 'Menu' : t.label}
            </a>
          ))}
        </nav>
        <a href={href('/cart')} className="head-cart" aria-label={`Your order, ${count} bottles`}>
          <BagIcon />
          <span>Your order</span>
          {count > 0 && <b className="badge">{count}</b>}
        </a>
      </header>

      <main className="shop-main">{page}</main>

      <footer className="shop-foot">
        <ul className="promises" aria-label="What's in the bottle">
          <li>
            <LeafIcon />
            <span>
              <strong>No preservatives</strong>Pressed fresh each week
            </span>
          </li>
          <li>
            <DropIcon />
            <span>
              <strong>No water</strong>Just cane and fruit
            </span>
          </li>
          <li>
            <SparkIcon />
            <span>
              <strong>No added sugar</strong>Sweet from the cane
            </span>
          </li>
        </ul>
        <div className="foot-main">
          <div className="foot-brand">
            <Logo size={58} />
            <div>
              <p>Turning Ghana's sugarcane into drinks people love.</p>
            </div>
          </div>
          <div className="socials">
            <a href="https://www.tiktok.com/@goodcane.co" target="_blank" rel="noreferrer" aria-label="GoodCane on TikTok">
              <TikTokIcon />
            </a>
            <a href="https://www.instagram.com/sugarcanegh/" target="_blank" rel="noreferrer" aria-label="GoodCane on Instagram">
              <InstagramIcon />
            </a>
            <a href="https://maps.google.com/?q=GoodCane+Aviation+Road+Adenta+Accra" target="_blank" rel="noreferrer" aria-label="Find the shop on Google Maps">
              <PinIcon />
            </a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>
            <PinIcon width={15} height={15} /> Aviation Road, Adenta, Accra
          </span>
          <span>
            <a href={href('/orders')}>My orders</a> · <a href={href('/account')}>Reminders</a>
          </span>
        </div>
      </footer>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, Icon, match }) => (
          <a key={label} href={href(to)} className={match(a) ? 'on' : ''} aria-label={label}>
            <Icon />
            {label === 'Order' && count > 0 && <b className="badge">{count}</b>}
          </a>
        ))}
      </nav>

      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
