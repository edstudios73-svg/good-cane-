import { useEffect } from 'react'
import { Logo } from './components/ui'
import { Flavour } from './pages/customer/Flavour'
import { Home } from './pages/customer/Home'
import { MyOrders } from './pages/customer/MyOrders'
import { OrderForm } from './pages/customer/OrderForm'
import { Receipt } from './pages/customer/Receipt'
import { lastReorderable, reorderBatch } from './pages/customer/reorder'
import { campaignSource, href, navigate, useRoute, type Route } from './router'
import { useShop } from './shop/ShopProvider'

/** Links in reminder texts land here: open the last order to repeat, or ask who they are. */
function Reorder({ route }: { route: Route }) {
  const { orders, now, me } = useShop()
  const last = me ? lastReorderable(orders, me.id) : undefined
  useEffect(() => {
    if (last) navigate(`/order?from=${last.id}&batch=${reorderBatch(orders, last.customerId, now).id}&src=${route.query.get('src') ?? ''}`)
  }, [last, now, route, orders])
  return last ? null : <MyOrders />
}

export default function CustomerApp() {
  const route = useRoute()
  useEffect(() => {
    campaignSource() // remember ?src= for attribution on the first page view
  }, [])

  let page
  const [, a, b] = route.path.split('/')
  if (a === 'order') page = <OrderForm key={window.location.hash} route={route} />
  else if (a === 'flavour' && b) page = <Flavour id={b} />
  else if (a === 'receipt' && b) page = <Receipt id={b} route={route} />
  else if (a === 'orders') page = <MyOrders />
  else if (a === 'reorder') page = <Reorder route={route} />
  else page = <Home />

  return (
    <div className={`app shop ${a ? 'app-narrow' : ''}`}>
      <header className="topbar">
        <a href={href('/')} className="brand" aria-label="GoodCane home">
          <Logo />
          <span className="brand-name">GoodCane</span>
        </a>
        <nav className="shopnav" aria-label="Main">
          <a href={href('/')} className={!a || a === 'flavour' ? 'on' : ''}>
            Menu
          </a>
          <a href={href('/orders')} className={a === 'orders' || a === 'receipt' ? 'on' : ''}>
            My orders
          </a>
          <a href={href('/order')} className="btn btn-primary btn-sm">
            Order
          </a>
        </nav>
      </header>
      <main>{page}</main>
      <footer className="foot">
        <div>
          <strong>GoodCane</strong>
          <p>Aviation Road, Adenta, Accra</p>
          <p>No preservatives. No water. No added sugar.</p>
        </div>
        <div className="foot-links">
          <a href={href('/orders')}>My orders</a>
          <a href="https://www.tiktok.com/@goodcane.co" target="_blank" rel="noreferrer">
            TikTok
          </a>
          <a href="https://www.instagram.com/sugarcanegh/" target="_blank" rel="noreferrer">
            Instagram
          </a>
        </div>
      </footer>
    </div>
  )
}
