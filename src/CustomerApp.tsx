import { useEffect } from 'react'
import { BagIcon, HomeIcon, ReceiptIcon, SearchIcon, UserIcon } from './components/icons'
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
  const { orders, me, ready, fillBasket } = useShop()
  const from = orders.find((o) => o.id === route.query.get('from')) ?? (me ? lastReorderable(orders, me.id) : undefined)
  useEffect(() => {
    if (!ready) return
    if (!from) return navigate('/orders')
    fillBasket(Object.fromEntries(from.lines.map((l) => [l.productId, l.qty])))
    navigate(`/cart?from=${from.id}${route.query.get('src') ? `&src=${route.query.get('src')}` : ''}`)
  }, [ready, from, fillBasket, route])
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
          <Logo size={38} />
          <span className="brand-name">GoodCane</span>
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
        <div>
          <strong>GoodCane</strong>
          <p>Aviation Road, Adenta, Accra</p>
          <p>No preservatives. No water. No added sugar.</p>
        </div>
        <div className="foot-links">
          <a href="https://www.tiktok.com/@goodcane.co" target="_blank" rel="noreferrer">
            TikTok
          </a>
          <a href="https://www.instagram.com/sugarcanegh/" target="_blank" rel="noreferrer">
            Instagram
          </a>
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
