import { useEffect } from 'react'
import { Logo } from './components/ui'
import { Business } from './pages/business/Business'
import { Home } from './pages/customer/Home'
import { MyOrders } from './pages/customer/MyOrders'
import { OrderForm } from './pages/customer/OrderForm'
import { Receipt } from './pages/customer/Receipt'
import { lastReorderable, reorderBatch } from './pages/customer/reorder'
import { campaignSource, href, navigate, useRoute, type Route } from './router'
import { useStore } from './store'

/** Reminder links land here: open "Same again?" if we know the customer, otherwise ask who they are. */
function Reorder({ route }: { route: Route }) {
  const { state, now, meCustomer } = useStore()
  const last = meCustomer ? lastReorderable(state.orders, meCustomer.id) : undefined
  useEffect(() => {
    if (last) navigate(`/order?from=${last.id}&batch=${reorderBatch(state.orders, last.customerId, now).id}&src=${route.query.get('src') ?? ''}`)
  }, [last, now, route, state.orders])
  return last ? null : <MyOrders />
}

export default function App() {
  const route = useRoute()
  const isBusiness = route.path.startsWith('/business')
  useEffect(() => {
    campaignSource() // remember ?src= for attribution on the first page view
  }, [])

  let page
  const [, a, b] = route.path.split('/')
  if (a === 'order') page = <OrderForm key={window.location.hash} route={route} />
  else if (a === 'receipt' && b) page = <Receipt id={b} route={route} />
  else if (a === 'orders') page = <MyOrders />
  else if (a === 'reorder') page = <Reorder route={route} />
  else if (a === 'business') page = <Business tab={b ?? 'demand'} route={route} />
  else page = <Home />

  return (
    <div className={isBusiness ? 'app app-wide' : 'app'}>
      <div className="sample-banner" role="note">
        Prototype · sample data only · no payments or messages are sent
      </div>
      <header className="topbar">
        <a href={href('/')} aria-label="GoodCane home">
          <Logo />
        </a>
        <nav className="switch" aria-label="View">
          <a href={href('/')} className={!isBusiness ? 'on' : ''}>
            Customer
          </a>
          <a href={href('/business/demand')} className={isBusiness ? 'on' : ''}>
            GoodCane team
          </a>
        </nav>
      </header>
      {!isBusiness && (
        <nav className="custnav" aria-label="Customer">
          <a href={href('/')} className={!a ? 'on' : ''}>
            Home
          </a>
          <a href={href('/order')} className={a === 'order' ? 'on' : ''}>
            Pre-order
          </a>
          <a href={href('/orders')} className={a === 'orders' || a === 'receipt' ? 'on' : ''}>
            My orders
          </a>
        </nav>
      )}
      <main>{page}</main>
      <footer className="foot small">Built for the CODED × GoodCane gig. Independent prototype — not an official GoodCane service.</footer>
    </div>
  )
}
